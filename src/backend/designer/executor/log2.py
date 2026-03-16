from typing import Dict
from datetime import datetime
from os.path import join, isfile, split, splitext, isdir, getmtime
from os import remove
from sys import path as sys_path, argv as sys_argv
from traceback import print_exc
from io import StringIO
from ctypes import windll
from json import dumps
from enum import Enum

class ContentMode(Enum):
    Restart = 1
    Persistence = 2
    DateGroup = 3

_caller_folder_path = sys_path[0]

STD_OUTPUT_HANDLE = windll.kernel32.GetStdHandle(-11)
FOREGROUND_BLACK = 0x0
FOREGROUND_BLUE = 0x01
FOREGROUND_GREEN = 0x02
FOREGROUND_WATER = 0x03
FOREGROUND_RED = 0x04
FOREGROUND_PURPLE = 0x05
FOREGROUND_YELLOW = 0x06
FOREGROUND_WHITE = 0x07
FOREGROUND_GREY = 0x08


def print_set_color(color):
    windll.kernel32.SetConsoleTextAttribute(STD_OUTPUT_HANDLE, color)


def print_reset_color():
    print_set_color(FOREGROUND_RED | FOREGROUND_GREEN | FOREGROUND_BLUE)


class Logger:
    __context: Dict[str, "Logger"] = {}

    def __init__(
        self,
        name: str,
        filename: str = "",
        folder: str = None,
        mode: ContentMode = ContentMode.Restart,
        console_print: bool = True
    ) -> None:
        self.console_debug_color = FOREGROUND_GREY
        self.console_info_color = FOREGROUND_WATER | FOREGROUND_GREY
        self.console_warning_color = FOREGROUND_YELLOW | FOREGROUND_GREY
        self.console_error_color = FOREGROUND_RED | FOREGROUND_GREY
        self.console_fatal_color = FOREGROUND_PURPLE | FOREGROUND_GREY
        
        self._name = name
        self._init_file = True
        self.set(filename, folder, mode, console_print)
       
    def set(
        self,
        filename: str = "",
        folder: str = None,
        mode: ContentMode = ContentMode.Restart,
        console_print: bool = True,
        ) -> None:
        self._filename = filename
        self._folder = folder
        self._mode = mode
        self._console_print = console_print

        if self._folder is None:
            self._folder = _caller_folder_path
        if not isdir(self._folder):
            raise NotADirectoryError(f"不存在指定目录 {self._folder}。")
        if self._filename == "":
            self._filename = splitext(split(sys_argv[0])[1])[0]

    def __file__write_list(self, level, text) -> None:
        """文件写入列表
        格式化列表的内容写入到文件中。
        :param level: 级别。
        :param text: 写入文件内容列表。
        """
        if self._filename is None:
            return
        
        if self._init_file:
            self._init_file = False
            self._current_date = datetime.now().date()
            if self._mode == ContentMode.DateGroup:
                self._file_path = join(self._folder, f"{self._filename}_{self._current_date.strftime('%Y-%m-%d')}.log")
            else:
                self._file_path = join(self._folder, f"{self._filename}.log")

            if isfile(self._file_path):
                if self._mode == ContentMode.Restart:
                    remove(self._file_path)
                else:
                    self._current_date = datetime.fromtimestamp(getmtime(self._file_path)).date()

            if self._mode != ContentMode.DateGroup and not isfile(self._file_path):
                with open(self._file_path, "a", encoding="utf-8") as file:
                    file.write(" ")
                    file.write(self._current_date.strftime("%Y-%m-%d"))

        if self._current_date != datetime.now().date():
            self._current_date = datetime.now().date()
            if self._mode == ContentMode.DateGroup:
                self._filename = f'{self._filename}_{self._current_date.strftime("%Y-%m-%d")}'
                self._file_path = join(self._folder, f"{self._filename}.log")
            else:
                with open(self._file_path, "a", encoding="utf-8") as file:
                    file.write("\n ")
                    file.write(datetime.now().strftime("%Y-%m-%d"))

        with open(self._file_path, "a", encoding="utf-8") as file:
            file.write("\n")
            file.write(f"{level} ")
            file.write(datetime.now().strftime("%H:%M:%S"))
            if not type(text) == tuple:
                text = (text,)
            for i in range(len(text)):
                file.write(" ")
                file.write(str(text[i]))

    def debug(self, *text: str):
        """调试级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        if self._console_print:
            print_set_color(self.console_debug_color)
            print(self._name, datetime.now().strftime("%H:%M:%S"), end=" ")
            print(*text)
            print_reset_color()

    def info(self, *text: str):
        """消息级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        self.__file__write_list("info", text)
        if self._console_print:
            print_set_color(self.console_info_color)
            print(self._name, datetime.now().strftime("%H:%M:%S"), end=" ")
            print(*text)
            print_reset_color()

    def warning(self, *text: str):
        """警告级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        self.__file__write_list("warn", text)
        if self._console_print:
            print_set_color(self.console_warning_color)
            print(self._name, datetime.now().strftime("%H:%M:%S"), end=" ")
            print(*text)
            print_reset_color()

    def error(self, *text: str):
        """错误级日志
        :param text: 日志内容，不填写则自动读取详细错误内容。
        """
        if text == None or len(text) == 0:
            file = StringIO()
            print_exc(file=file)
            text = file.getvalue()

        self.__file__write_list("error", text)
        if self._console_print:
            print_set_color(self.console_error_color)
            print(self._name, datetime.now().strftime("%H:%M:%S"), end=" ")
            if type(text) == tuple:
                print(*text)
            else:
                print(text)
            print_reset_color()

    def fatal(self, *text: str):
        """致命级日志
        :param text: 日志内容，不填写则自动读取详细错误内容。
        """
        if text == None or len(text) == 0:
            file = StringIO()
            print_exc(file=file)
            text = file.getvalue()

        self.__file__write_list("fatal", text)
        if self._console_print:
            print_set_color(self.console_fatal_color)
            print(self._name, datetime.now().strftime("%H:%M:%S"), end=" ")
            if type(text) == tuple:
                print(*text)
            else:
                print(text)
            print_reset_color()

    @staticmethod
    def get(name: str = None) -> "Logger":
        if name is None:
            name = ""
        else:
            name = name.strip()

        if name in Logger.__context:
            return Logger.__context[name]
        result = Logger(name, None)
        Logger.__context[name] = result
        return result

def json_format(data: any) -> str:
    return dumps(data, ensure_ascii=False)

logger = Logger.get()