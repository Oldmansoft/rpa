from typing import Callable
import os
import subprocess
import msvcrt
import ctypes

from threading import Thread, Event
from abc import ABC
from io import StringIO
from traceback import print_exc
from json import loads, dumps
from struct import unpack, pack
from inspect import getmembers, isfunction

from .log2 import Logger

logger = Logger("pipe", None)

# 设置句柄继承性
def _set_handle_inheritable(handle, inheritable):
    kernel32 = ctypes.windll.kernel32
    kernel32.SetHandleInformation.argtypes = (ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint)
    HANDLE_FLAG_INHERIT = 0x00000001
    flags = HANDLE_FLAG_INHERIT if inheritable else 0
    result = kernel32.SetHandleInformation(ctypes.c_void_p(handle), HANDLE_FLAG_INHERIT, flags)
    if not result:
        raise ctypes.WinError()

class CommandHandle(ABC):
    pass

class ProcessCommand(object):
    def __init__(self, name: str, method: str, content: dict = None) -> None:
        self.name = name
        self.method = method
        self.content = content
    
    def text(self):
        return dumps({
            "name": self.name, 
            "method": self.method,
            "content": self.content
        })
    
    def __str__(self):
        return self.text()
    
    @staticmethod
    def parse(text: bytes) -> "ProcessCommand":
        data = loads(text)
        return ProcessCommand(data["name"], data["method"], data["content"])

class SystemCommand(ProcessCommand):
    _Name = "system"
    _Close = "close"
    def __init__(self, method: str):
        super().__init__(self._Name, method)

    @staticmethod
    def close() -> ProcessCommand:
        return SystemCommand(SystemCommand._Close)
    
    @staticmethod
    def is_close(command: ProcessCommand) -> bool:
        return command.name == SystemCommand._Name and command.method == SystemCommand._Close

class ProcessException(Exception):
    def __init__(self, *args):
        super().__init__(*args)

class CommandException(ProcessException):
    def __init__(self, *args):
        super().__init__(*args)

class ClientProcess(object):
    def __init__(self) -> None:
        self._executing_thread = False
        
    def connect(self, execute_file_path: str) -> None:
        if self._executing_thread:
            raise ProcessException("已经连接。")
        if not os.path.isfile(execute_file_path):
            raise FileNotFoundError(execute_file_path)
        # 创建匿名管道
        out_read_pipe, out_write_pipe = os.pipe()
        in_read_pipe, in_write_pipe = os.pipe()
        # 获取 Windows 文件句柄
        out_read_handle = msvcrt.get_osfhandle(out_read_pipe)
        out_write_handle = msvcrt.get_osfhandle(out_write_pipe)
        #in_read_handle = msvcrt.get_osfhandle(in_read_pipe)
        in_write_handle = msvcrt.get_osfhandle(in_write_pipe)
        _set_handle_inheritable(out_read_handle, True)
        _set_handle_inheritable(in_write_handle, True)
        self._process = subprocess.Popen(
            ["python", execute_file_path, str(out_read_handle), str(in_write_handle)],
            close_fds = False
        )
        os.close(out_read_pipe)  # 关闭父进程的读端
        os.close(in_write_pipe)  # 关闭父进程的写端
        self._out_write_pipe = out_write_pipe
        self._in_read_pipe = in_read_pipe

        self._thread = Thread(target=self.__execute_thread, daemon=True)
        self._executing_thread = True
        self._event = Event()
        self._thread.start()
        self._event.wait()
    
    def __execute_thread(self) -> None:
        content_length_bytes = os.read(self._in_read_pipe, 4)
        if not content_length_bytes:
            # 目标进程退出
            self._executing_thread = False
            self._event.set()
            return

        self._event.set()
        self._process.wait()
        self._executing_thread = False
    
    def call(self, command: ProcessCommand) -> any:
        if not self._executing_thread:
            raise ProcessException("子进程没有在运行，请查看是否启用 connect 或者已经调用 close。")

        text = command.text()
        logger.debug("client 发送", len(text), pack("I", len(text)), text.encode("GBK"))
        os.write(self._out_write_pipe, pack("I", len(text)))
        os.write(self._out_write_pipe, text.encode("GBK"))
        content_length_bytes = os.read(self._in_read_pipe, 4)
        if not content_length_bytes:
            #logger.warning("client过程接收空") 子进程结束
            return None
        content_length = unpack("I", content_length_bytes)[0]
        content_bytes = os.read(self._in_read_pipe, content_length)
        logger.debug("client 接收", content_length, content_length_bytes, content_bytes)
        call_result = loads(content_bytes)
        if call_result["error"]:
            raise CommandException(call_result["error"])
        return call_result["result"]

    def close(self) -> None:
        if self._executing_thread:
            self.call(SystemCommand.close())

class ServerProcess(object):
    def __init__(self) -> None:
        self._executing_thread = False
        self._command_handle_objects = {}
        self._on_command = None
    
    @property
    def on_command(self) -> Callable[[ProcessCommand], any]:
        return self._on_command

    @on_command.setter
    def on_command(self, on_command: Callable[[ProcessCommand], any]) -> None:
        self._on_command = on_command
    
    def bind(self, in_read_handle: int, out_write_handle: int) -> None:
        if self._executing_thread:
            raise ProcessException("已经绑定。")
        
        self._in_read_pipe = msvcrt.open_osfhandle(in_read_handle, os.O_RDONLY)
        self._out_write_pipe = msvcrt.open_osfhandle(out_write_handle, os.O_RDONLY)
        self._event = Event()
        self._thread = Thread(target=self.__execute_thread, daemon=True)
        self._executing_thread = True
        self._thread.start()
        self._event.wait()

    def __execute_thread(self) -> None:
        self.__send()
        while self._executing_thread:
            content_length_bytes = os.read(self._in_read_pipe, 4)
            if not content_length_bytes:
                self._executing_thread = False
                continue

            content_length = unpack("I", content_length_bytes)[0]
            content_bytes = os.read(self._in_read_pipe, content_length)
            #logger.debug("server 接收", content_length, content_length_bytes, content_bytes)
            command = ProcessCommand.parse(content_bytes)
            if SystemCommand.is_close(command):
                self._executing_thread = False
                continue
            
            return_content = {
                "error": None,
                "result": None
            }
            try:
                if self.__has_command_handle(command):
                    return_content["result"] = self.__command_handle(command)
                elif self._on_command:
                    return_content["result"] = self._on_command(command)
                else:
                    return_content["error"] = f"没有程序处理命令 {command.name}"
            except:
                file = StringIO()
                print_exc(file=file)
                return_content["error"] = file.getvalue()

            self.__send(return_content)

        self._event.set()
    
    def __send(self, content: any = None) -> None:
        if content:
            text = dumps(content)
            logger.debug("server 发送", len(text), pack("I", len(text)), text.encode("GBK"))
            os.write(self._out_write_pipe, pack("I", len(text)))
            os.write(self._out_write_pipe, text.encode("GBK"))
        else:
            os.write(self._out_write_pipe, pack("I", 0))

    def __has_command_handle(self, command: ProcessCommand) -> bool:
        return command.name in self._command_handle_objects

    def __command_handle(self, command: ProcessCommand) -> any:
        if not command.name in self._command_handle_objects:
            raise CommandException(f"命令处理对象不存在类型 {command.name}。")

        response_objects = self._command_handle_objects[command.name]
        if not command.method in response_objects["methods"]:
            raise CommandException(f"命令处理对象 {command.name} 不存在方法 {command.method}。")
        
        args_defines = response_objects["methods"][command.method]
        if command.content == None:
            command.content = {}
        for key in command.content:
            if not key in args_defines:
                raise CommandException(f"命令处理对象 {command.name} 的方法 {command.method} 没有参数 {key}。")

        method = getattr(response_objects["target"], command.method)
        return method(**command.content)

    def register_command_handle(self, handle_object: CommandHandle) -> None:
        response_class = handle_object.__class__
        class_name = response_class.__name__
        if not isinstance(handle_object, CommandHandle):
            raise TypeError(f"参数类型 {class_name} 必须是 CallHandle 的子类。")
        
        methods = {}
        for item in getmembers(response_class, predicate=isfunction):
            method_name = item[0]
            method_args = item[1].__code__.co_varnames
            if len(method_args) == 0 or method_args[0] != "self":
                raise TypeError(
                    f"参数类型 {class_name} 的方法 {method_name} 缺少 self。"
                )
            methods[method_name] = method_args
        self._command_handle_objects[class_name] = {
            "target": handle_object,
            "methods": methods,
        }