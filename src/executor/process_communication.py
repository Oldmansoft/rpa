from __future__ import annotations
from typing import Callable, Tuple, Dict
from abc import ABC

from sys import __stdin__, __stdout__, argv
from subprocess import Popen, PIPE
from datetime import datetime, timedelta
from threading import Thread, Event
from struct import unpack, pack
from json import loads, dumps
from inspect import getmembers, isfunction
from traceback import format_exc
from os.path import isfile
from os import pipe, write, read, close, O_RDONLY
from msvcrt import get_osfhandle, open_osfhandle
from ctypes import windll, WinError, c_void_p, c_uint
from io import StringIO
from traceback import print_exc

from .log2 import logger

__version__ = "1.0.0"

class PipeCreator(object):
    def __init__(self) -> None:
        # 设置句柄继承性
        def _set_handle_inheritable(handle, inheritable):
            kernel32 = windll.kernel32
            kernel32.SetHandleInformation.argtypes = (
                c_void_p,
                c_uint,
                c_uint,
            )
            HANDLE_FLAG_INHERIT = 0x00000001
            flags = HANDLE_FLAG_INHERIT if inheritable else 0
            result = kernel32.SetHandleInformation(c_void_p(handle), HANDLE_FLAG_INHERIT, flags)
            if not result:
                raise WinError()
        # 创建匿名管道
        self.out_read_pipe, self.out_write_pipe = pipe()
        self.in_read_pipe, self.in_write_pipe = pipe()
        # 获取 Windows 文件句柄
        self.out_read_handle = get_osfhandle(self.out_read_pipe)
        # out_write_handle = get_osfhandle(out_write_pipe)
        # in_read_handle = get_osfhandle(in_read_pipe)
        self.in_write_handle = get_osfhandle(self.in_write_pipe)
        _set_handle_inheritable(self.out_read_handle, True)
        _set_handle_inheritable(self.in_write_handle, True)

    def __enter__(self) -> "PipeCreator":
        return self

    def __exit__(self, exc_type, exc_value, exc_trace) -> None:
        close(self.out_read_pipe)  # 关闭父进程的读端
        close(self.in_write_pipe)  # 关闭父进程的写端

    def get_read_write_handles(self) -> Tuple[str, str]:
        return (
            str(self.out_read_handle),
            str(self.in_write_handle),
        )

    def get_read_write_pipes(self) -> Tuple[int, int]:
        return self.in_read_pipe, self.out_write_pipe


class Communication(object):
    def __init__(
        self, in_pipe: int, out_pipe: int, log_name: str, encoding: str = "utf-8"
    ) -> None:
        self._in_pipe = in_pipe
        self._out_pipe = out_pipe
        self._log_name = log_name
        self.encoding = encoding

    def write(self, text: str = None) -> None:
        if text:
            text_length_pack = pack("I", len(text))
            text_encode = text.encode(self.encoding)
            logger.debug(
                f"{self._log_name}发送",
                len(text),
                text_length_pack,
                text_encode,
            )
            write(self._out_pipe, text_length_pack)
            write(self._out_pipe, text_encode)
        else:
            logger.debug(f"{self._log_name}发送 0")
            write(self._out_pipe, pack("I", 0))

    def read(self) -> Tuple[bool, str]:
        length_bytes = read(self._in_pipe, 4)
        if not length_bytes:
            logger.debug(f"{self._log_name}接收", length_bytes)
            return False, None
        length = unpack("I", length_bytes)[0]
        if length == 0:
            logger.debug(f"{self._log_name}接收", length_bytes)
            return True, ""
        content_bytes = read(self._in_pipe, length)
        logger.debug(f"{self._log_name}接收", length_bytes, content_bytes)
        return True, content_bytes.decode(self.encoding)


class ProcessCommand(object):
    def __init__(self, name: str, method: str, content: dict = None) -> None:
        self.name = name
        self.method = method
        self.content = content
        self.ask = None

    def text(self):
        if self.content is None:
            return dumps({"name": self.name, "method": self.method, "ask": self.ask})
        return dumps({"name": self.name, "method": self.method, "content": self.content, "ask": self.ask})

    def __str__(self):
        return self.text()

    def is_same(self, command: ProcessCommand) -> bool:
        if command is None:
            return False
        return command.name == self.name and command.method == self.method
    
    def create_same(self, content: dict = None) -> ProcessCommand:
        return ProcessCommand(self.name, self.method, content)

    def call(self, communication: Communication) -> Tuple[bool, any]:
        self.ask = True
        communication.write(self.text())
        result, text = communication.read()
        if not result:
            return False, None
        call_result = loads(text)
        if call_result["error"]:
            raise CommandException(call_result["error"])
        return True, call_result["result"]
    
    def send(self, communication: Communication) -> None:
        self.ask = False
        communication.write(self.text())

    @staticmethod
    def parse(text: str) -> "ProcessCommand":
        data = loads(text)
        if "content" in data:
            result = ProcessCommand(data["name"], data["method"], data["content"])
        else:
            result = ProcessCommand(data["name"], data["method"])
        result.ask = data["ask"]
        return result


class ProcessException(Exception):
    def __init__(self, *args):
        super().__init__(*args)


class CommandException(ProcessException):
    def __init__(self, *args):
        super().__init__(*args)


class ProcessTaskQuitException(BaseException):
    pass


class CommandHandle(ABC):
    pass


_inner_command_name = "#inner"
_ProcessCommand_TaskReady = ProcessCommand(_inner_command_name, "task_ready")
_ProcessCommand_TaskClose = ProcessCommand(_inner_command_name, "task_close")


class ProcessExecutorCommandHandle(CommandHandle):
    def __init__(self, executor: ProcessExecutor) -> None:
        self.executor = executor

    def task_ready(self, name: str, version: str) -> dict:
        if self.executor._on_task_start:
            self.executor._on_task_start({
                "name": name,
                "version": version
            })
        return self.executor._start_parameters
    
    def task_close(self, is_quit: bool, values: list, error: str) -> None:
        self.executor._finish_content = {
            "quit": is_quit,
            "values": values,
            "error": error
        }


class ProcessExecutor(object):
    def __init__(self) -> None:
        self._on_error = None
        self._on_task_error = None
        self._on_task_start = None
        self._on_task_finish = None
        self._running = False
        self._task_error = None
        self._task_kill = False
        self.task_result = ProcessTaskResult(False, False, False, None, 0)
        self._command_handle_objects: Dict[str, dict] = {}
        self._event = Event()
        self.__register_command_handle(ProcessExecutorCommandHandle(self), _inner_command_name)

    def on_error(self, func: Callable[[str], None]) -> None:
        self._on_error = func

    def on_task_error(self, func: Callable[[str], None]) -> None:
        self._on_task_error = func

    def on_task_start(self, func: Callable[[dict], None]) -> None:
        self._on_task_start = func

    def on_task_finish(self, func: Callable[[ProcessTaskResult], None]) -> None:
        self._on_task_finish = func

    def __execute_start(self, executor_file_path: str, code_file_path: str, parameters: dict) -> None:
        if self._running:
            raise Exception("子进程运行中，无法同时启动多个子进程。")
        self._running = True
        self._start_parameters = parameters
        self._finish_content = None

        with PipeCreator() as listener:
            listener_in_read_pipe, listener_out_write_pipe = listener.get_read_write_pipes()
            listener_out_read_handle, listener_in_write_handle = listener.get_read_write_handles()

            self._process = Popen(
                [
                    executor_file_path,
                    code_file_path,
                    str(listener_out_read_handle),
                    str(listener_in_write_handle),
                ],
                close_fds=False,
            )

        self._communication_listener = Communication(listener_in_read_pipe, listener_out_write_pipe, "father-listener")

    def execute_start(self, executor_file_path: str, code_file_path: str, parameters: dict) -> ProcessExecuting:
        if not isfile(code_file_path):
            raise FileNotFoundError(code_file_path)
        self.__execute_start(executor_file_path, code_file_path, parameters)
        Thread(target=self.__execute).start()
        return ProcessExecuting(self)

    def execute(self, executor_file_path: str, code_file_path: str, parameters: dict) -> ProcessTaskResult:
        self.__execute_start(executor_file_path, code_file_path, parameters)
        self.__execute()
        return self.task_result

    def __execute(self) -> None:
        self.start_time = datetime.now()
        try:
            while True:
                read_result, read_value = self._communication_listener.read()
                if not read_result:
                    break
                command = ProcessCommand.parse(read_value)
                if not self.__execute_command(command):
                    break

            finish_quit = False
            finish_values = None
            if self._finish_content:
                finish_quit = self._finish_content["quit"]
                finish_values = self._finish_content["values"]
                if self._finish_content["error"]:
                    self._task_error = self._finish_content["error"]
                    if self._on_task_error:
                        self._on_task_error(self._task_error)
            self.task_result = ProcessTaskResult(self._task_error, self._task_kill, finish_quit, finish_values, datetime.now() - self.start_time)
            if self._on_task_finish:
                self._on_task_finish(self.task_result)
            self._running = False
            self._event.set()
        except:
            self._running = False
            self._event.set()
            if self._on_error is None:
                raise
            self._on_error(format_exc()[0:-1])

    def __execute_command(self, command: ProcessCommand) -> bool:
        return_content = {"error": None, "result": None}
        try:
            return_content["error"], return_content["result"] = self.__try_command_handle(command)
        except:
            file = StringIO()
            print_exc(file=file)
            return_content["error"] = file.getvalue()
        
        if command.ask:
            self._communication_listener.write(dumps(return_content))
        elif not return_content["error"] is None:
            self._process.kill()
            self._task_error = return_content["error"]
            self._task_kill = True
            if self._on_task_error:
                self._on_task_error(self._task_error)
            return False
        return True

    def __try_command_handle(self, command: ProcessCommand) -> Tuple[str, any]:
        if not command.name in self._command_handle_objects:
            return f"ProcessExecutor 没有对象处理命令 {command.name}.{command.method}", None

        response_object = self._command_handle_objects[command.name]
        if not command.method in response_object["methods"]:
            return f"ProcessExecutor 命令处理对象 {command.name} 不存在方法 {command.method}。", None

        args_defines = response_object["methods"][command.method]
        if command.content == None:
            command.content = {}
        for key in command.content:
            if not key in args_defines:
                return f"ProcessExecutor 命令处理对象 {command.name} 的方法 {command.method} 没有参数 {key}。", None

        method = getattr(response_object["target"], command.method)
        return None, method(**command.content)

    def register_command_handle(self, handle_object: CommandHandle) -> None:
        self.__register_command_handle(handle_object)

    def __register_command_handle(self, handle_object: CommandHandle, class_name: str = None) -> None:
        response_class = handle_object.__class__
        if not isinstance(handle_object, CommandHandle):
            raise TypeError(f"参数类型 {response_class.__name__} 必须是 CommandHandle 的子类。")

        if class_name is None:
            class_name = response_class.__name__
        methods = {}
        for item in getmembers(response_class, predicate=isfunction):
            method_name = item[0]
            method_args = item[1].__code__.co_varnames
            if len(method_args) == 0 or method_args[0] != "self":
                raise TypeError(
                    f"参数类型 {response_class.__name__} 的方法 {method_name} 缺少 self。"
                )
            methods[method_name] = method_args
        self._command_handle_objects[class_name] = {
            "target": handle_object,
            "methods": methods,
        }

    @property
    def running(self) -> bool:
        return self._running


class ProcessExecuting(object):
    def __init__(self, executor: ProcessExecutor) -> None:
        self._executor = executor

    def wait(self) -> None:
        if self._executor.running:
            self._executor._event.wait()

    def kill(self) -> None:
        if self._executor.running:
            self._executor._process.kill()


class ProcessTaskResult(object):
    def __init__(self, task_error: str, task_kill: bool, task_quit: bool, values: list, used_time: timedelta) -> None:
        self.task_error = task_error
        self.task_kill = task_kill
        self.task_quit = task_quit
        self.values = values
        self.used_time = used_time


class ProcessTask(object):
    def __init__(
        self,
        name: str,
        version: str
    ) -> None:
        if len(argv) > 2:
            sender_in_read_handle = int(argv[1])
            sender_out_write_handle = int(argv[2])

            self._communication_sender = Communication(
                open_osfhandle(sender_in_read_handle, O_RDONLY),
                open_osfhandle(sender_out_write_handle, O_RDONLY),
                "child-sender",
            )
        else:
            raise ProcessException("argv 参数不足")

        self._result = []
        self.parameters = None
        command = _ProcessCommand_TaskReady.create_same({"name": name, "version": version})
        call_result, call_value = command.call(self._communication_sender)
        if not call_result:
            return
        self.parameters = call_value

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        if exc_type == ProcessTaskQuitException:
            self.__close(True, None)
            return True
        else:
            self.__close(False, f'File "{exc_traceback.tb_frame.f_code.co_filename}", line {exc_traceback.tb_lineno}\n{exc_type.__name__}: {exc_value}')
        return exc_type is None

    def __close(self, has_quit: bool, error: str) -> None:
        command = _ProcessCommand_TaskClose.create_same({"is_quit": has_quit, "values": self._result, "error": error})
        command.send(self._communication_sender)

    def quit(self, *paras) -> None:
        if len(paras) > 0:
            self.result(*paras)
        raise ProcessTaskQuitException()

    def call(self, name: str, method: str, content: dict = None) -> any:
        _, result = ProcessCommand(name, method, content).call(self._communication_sender)
        return result
    
    def send(self, name: str, method: str, content: dict = None) -> None:
        ProcessCommand(name, method, content).send(self._communication_sender)

    def result(self, *paras) -> None:
        self._result = paras


_ProcessCommand_ServerClose = ProcessCommand(_inner_command_name, "#close")
_ProcessCommand_ServerError = ProcessCommand(_inner_command_name, "server_error")


class ProcessLauncherCommandHandle(CommandHandle):
    def __init__(self, launcher: ProcessLauncher) -> None:
        self.launcher = launcher

    def server_error(self, content: str) -> None:
        if self.launcher._on_error:
            self.launcher._on_error(content)


class ProcessLauncher(object):
    def __init__(self, executor_file_path: str = "python") -> None:
        self._on_error = None
        self._python_path = executor_file_path
        self._command_handle_objects: Dict[str, dict] = {}
        self.__register_command_handle(ProcessLauncherCommandHandle(self), _inner_command_name)

    def connect(self, code_file_path: str) -> ProcessLauncherServerProxy:
        if not isfile(code_file_path):
            raise FileNotFoundError(code_file_path)
        return ProcessLauncherServerProxy(self, code_file_path)

    def __try_command_handle(self, command: ProcessCommand) -> Tuple[str, any]:
        if not command.name in self._command_handle_objects:
            return f"ProcessLauncher 没有对象处理命令 {command.name}.{command.method}。", None

        response_object = self._command_handle_objects[command.name]
        if not command.method in response_object["methods"]:
            return f"ProcessLauncher 命令处理对象 {command.name} 不存在方法 {command.method}。", None

        args_defines = response_object["methods"][command.method]
        if command.content == None:
            command.content = {}
        for key in command.content:
            if not key in args_defines:
                return f"ProcessLauncher 命令处理对象 {command.name} 的方法 {command.method} 没有参数 {key}。", None

        method = getattr(response_object["target"], command.method)
        return None, method(**command.content)

    def register_command_handle(self, handle_object: CommandHandle) -> None:
        self.__register_command_handle(handle_object)

    def __register_command_handle(self, handle_object: CommandHandle, class_name: str = None) -> None:
        response_class = handle_object.__class__
        if not isinstance(handle_object, CommandHandle):
            raise TypeError(f"参数类型 {response_class.__name__} 必须是 CommandHandle 的子类。")

        if class_name is None:
            class_name = response_class.__name__
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

    @property
    def on_error(self) -> Callable[[str], None]:
        return self._on_error

    @on_error.setter
    def on_error(self, func: Callable[[str], None]) -> None:
        self._on_error = func


class ProcessLauncherServerProxy(object):
    def __init__(self, launcher: ProcessLauncher, code_file_path: str) -> None:
        self._launcher = launcher
        with PipeCreator() as sender, PipeCreator() as listener:
            sender_in_read_pipe, sender_out_write_pipe = sender.get_read_write_pipes()
            sender_out_read_handle, sender_in_write_handle = sender.get_read_write_handles()

            listener_in_read_pipe, listener_out_write_pipe = listener.get_read_write_pipes()
            listener_out_read_handle, listener_in_write_handle = listener.get_read_write_handles()

            self._process = Popen(
                [
                    self._launcher._python_path,
                    code_file_path,
                    str(sender_out_read_handle),
                    str(sender_in_write_handle),
                    str(listener_out_read_handle),
                    str(listener_in_write_handle),
                ],
                close_fds=False,
            )

        self._communication_sender = Communication(
            sender_in_read_pipe, sender_out_write_pipe, "father-sender"
        )
        self._communication_listener = Communication(
            listener_in_read_pipe, listener_out_write_pipe, "father-listener"
        )
        thread = Thread(target=self.__execute_thread, daemon=True)
        self._executing_thread = True
        self._event = Event()
        thread.start()
        self._event.wait()

    def __execute_thread(self) -> None:
        read_result, _ = self._communication_sender.read()
        if not read_result:
            # 目标进程退出
            self._executing_thread = False
            self._event.set()
            return

        self._event.set()

        while True:
            read_result, read_value = self._communication_listener.read()
            if not read_result:
                # 目标进程退出
                break

            command = ProcessCommand.parse(read_value)
            return_content = {"error": None, "result": None}
            try:
                return_content["error"], return_content["result"] = self._launcher.__try_command_handle(command)
            except:
                file = StringIO()
                print_exc(file=file)
                return_content["error"] = file.getvalue()

            if command.ask:
                self._communication_listener.write(dumps(return_content))
            elif not return_content["error"] is None and not self._launcher._on_error is None:
                self._launcher._on_error(return_content["error"])


        #self._process.wait()  # 客户端发送 close 请求后才会执行下面内容
        self._executing_thread = False
        logger.debug("father", "服务进程退出")

    def call(self, name: str, method: str, content:dict = None) -> any:
        if not self._executing_thread:
            raise ProcessException(
                "子进程没有在运行，请查看是否启用 connect 或者子进程已经退出。"
            )
        command = ProcessCommand(name, method, content)
        _, call_value = command.call(self._communication_sender)
        return call_value
    
    def send(self, name: str, method: str, content:dict = None) -> None:
        if not self._executing_thread:
            raise ProcessException(
                "子进程没有在运行，请查看是否启用 connect 或者子进程已经退出。"
            )
        command = ProcessCommand(name, method, content)
        command.send(self._communication_sender)

    def close(self) -> bool:
        if self._executing_thread:
            _ProcessCommand_ServerClose.send(self._communication_sender)
            return True
        return False

    def kill(self) -> bool:
        self._process.kill()


class ProcessServer(object):
    def __init__(self) -> None:
        self._command_handle_objects: Dict[str, dict] = {}
        self._communication_listener = None
        self._communication_sender = None
        self._proxy = ProcessServerLauncherProxy(self)

    def listen(
        self,
        listener_in_read_handle: int,
        listener_out_write_handle: int,
        sender_in_read_handle: int = None,
        sender_out_write_handle: int = None,
    ) -> None:
        self._communication_listener = Communication(
            open_osfhandle(listener_in_read_handle, O_RDONLY),
            open_osfhandle(listener_out_write_handle, O_RDONLY),
            "child-listener",
        )
        if not (sender_in_read_handle is None or sender_out_write_handle is None):
            self._communication_sender = Communication(
                open_osfhandle(sender_in_read_handle, O_RDONLY),
                open_osfhandle(sender_out_write_handle, O_RDONLY),
                "child-sender",
            )
        self.__execute()

    def listen_with_argv(self) -> None:
        if len(argv) > 4:
            listener_in_read_handle = int(argv[1])
            listener_out_write_handle = int(argv[2])
            sender_in_read_handle = int(argv[3])
            sender_out_write_handle = int(argv[4])
            self.listen(listener_in_read_handle, listener_out_write_handle, sender_in_read_handle, sender_out_write_handle)
        elif len(argv) > 2:
            listener_in_read_handle = int(argv[1])
            listener_out_write_handle = int(argv[2])
            self.listen(listener_in_read_handle, listener_out_write_handle)
        else:
            raise ProcessException("argv 参数不足")

    def __execute(self) -> None:
        self._communication_listener.write()
        while True:
            read_result, read_value = self._communication_listener.read()
            if not read_result:
                # 主进程退出
                break

            command = ProcessCommand.parse(read_value)
            if _ProcessCommand_ServerClose.is_same(command):
                break

            return_content = {"error": None, "result": None}
            try:
                return_content["error"], return_content["result"] = self.__try_command_handle(command)
            except:
                file = StringIO()
                print_exc(file=file)
                return_content["error"] = file.getvalue()

            if command.ask:
                self._communication_listener.write(dumps(return_content))
            elif not return_content["error"] is None:
                _ProcessCommand_ServerError.create_same({"content": return_content["error"]}).send(self._communication_sender)

    def __try_command_handle(self, command: ProcessCommand) -> Tuple[str, any]:
        if not command.name in self._command_handle_objects:
            return f"ProcessServer 没有对象处理命令 {command.name}.{command.method}。", None

        response_object = self._command_handle_objects[command.name]
        if not command.method in response_object["methods"]:
            return f"ProcessServer 命令处理对象 {command.name} 不存在方法 {command.method}。", None

        args_defines = response_object["methods"][command.method]
        if command.content == None:
            command.content = {}
        for key in command.content:
            if not key in args_defines:
                return f"ProcessServer 命令处理对象 {command.name} 的方法 {command.method} 没有参数 {key}。", None

        method = getattr(response_object["target"], command.method)
        return None, method(**command.content)

    def register_command_handle(self, handle_object: ServerCommandHandle) -> None:
        response_class = handle_object.__class__
        class_name = response_class.__name__
        if not isinstance(handle_object, ServerCommandHandle):
            raise TypeError(
                f"参数类型 {class_name} 必须是 ServerCommandHandle 的子类。"
            )

        methods = {}
        for item in getmembers(response_class, predicate=isfunction):
            method_name = item[0]
            method_args = item[1].__code__.co_varnames
            if len(method_args) == 0 or method_args[0] != "self":
                raise TypeError(
                    f"参数类型 {class_name} 的方法 {method_name} 缺少 self。"
                )
            methods[method_name] = method_args

        handle_object._set_response_object(self._proxy)
        self._command_handle_objects[class_name] = {
            "target": handle_object,
            "methods": methods,
        }


class ProcessServerLauncherProxy(object):
    def __init__(self, server: ProcessServer) -> None:
        self._server = server

    def send(self, name: str, method: str, content:dict = None) -> None:
        if self._server._communication_sender is None:
            raise ProcessException("缺少父进程的接收通道。")
        command = ProcessCommand(name, method, content)
        command.send(self._server._communication_sender)
    
    def call(self, name: str, method: str, content:dict = None) -> any:
        if self._server._communication_sender is None:
            raise ProcessException("缺少父进程的接收通道。")
        command = ProcessCommand(name, method, content)
        _, call_value = command.call(self._server._communication_sender)
        return call_value


class ServerCommandHandle(ABC):
    def _set_response_object(self, proxy_object: ProcessServerLauncherProxy) -> None:
        self.launcher = proxy_object
