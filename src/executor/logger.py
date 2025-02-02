from datetime import datetime
from os.path import join, exists, split, isdir, getmtime
from os import remove
from sys import path as sys_path, argv as sys_argv
from traceback import print_exc
from io import StringIO
from ctypes import windll
from json import dumps

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
    def __init__(
        self,
        name: str,
        filename: str = "",
        folder: str = None,
        new_content: bool = True,
        console_print: bool = True,
        file_date_group: bool = False,
    ) -> None:
        self.console_debug_color = FOREGROUND_GREY
        self.console_info_color = FOREGROUND_WATER | FOREGROUND_GREY
        self.console_warning_color = FOREGROUND_YELLOW | FOREGROUND_GREY
        self.console_error_color = FOREGROUND_RED | FOREGROUND_GREY
        self.console_fatal_color = FOREGROUND_PURPLE | FOREGROUND_GREY
        self.__file_date_group = file_date_group
        self.__filename = filename
        self.__folder = folder

        if self.__folder == None:
            self.__folder = _caller_folder_path
        if not isdir(self.__folder):
            raise NotADirectoryError(f"不存在指定目录 {self.__folder}。")
        if self.__filename == None:
            self._file_path = None
        else:
            if self.__filename == "":
                self.__filename = split(sys_argv[0])[1]
            if self.__file_date_group:
                self.__filename = f'{self.__filename}_{datetime.now().strftime("%Y-%m-%d")}'
            self._file_path = join(self.__folder, f"{self.__filename}.log")
        self.name = name

        if new_content:
            self.reset()
        elif self._file_path != None:
            if exists(self._file_path):
                self.date = datetime.fromtimestamp(getmtime(self._file_path)).date()
            else:
                self.date = datetime.now().date()
                if not self.__file_date_group:
                    with open(self._file_path, "a", encoding="utf-8") as file:
                        file.write(datetime.now().strftime("%Y-%m-%d"))
                        file.write("\n")
        self.console_print = console_print

    def reset(self) -> None:
        self.date = datetime.now().date()
        if self._file_path == None:
            return
        if exists(self._file_path):
            remove(self._file_path)
        if not self.__file_date_group:
            with open(self._file_path, "a", encoding="utf-8") as file:
                file.write(datetime.now().strftime("%Y-%m-%d"))
                file.write("\n")

    def __file__write_list(self, level, text) -> None:
        """文件写入列表
        格式化列表的内容写入到文件中。
        :param level: 级别。
        :param text: 写入文件内容列表。
        """
        if self._file_path == None:
            return
        if self.__file_date_group and self.date != datetime.now().date():
            self.__filename = f'{self.__filename}_{datetime.now().strftime("%Y-%m-%d")}'
            self._file_path = join(self.__folder, f"{self.__filename}.log")

        with open(self._file_path, "a", encoding="utf-8") as file:
            if self.date != datetime.now().date():
                self.date = datetime.now().date()
                file.write(datetime.now().strftime("%Y-%m-%d"))
                file.write("\n")
            file.write(f"{level}  ")
            file.write(datetime.now().strftime("%H:%M:%S"))
            if not type(text) == tuple:
                text = (text,)
            for i in range(len(text)):
                file.write(" ")
                file.write(str(text[i]))
            file.write("\n")

    def debug(self, *text: str):
        """调试级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        if self.console_print:
            print_set_color(self.console_debug_color)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
            print(*text)
            print_reset_color()

    def info(self, *text: str):
        """消息级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        self.__file__write_list("info", text)
        if self.console_print:
            print_set_color(self.console_info_color)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
            print(*text)
            print_reset_color()

    def warning(self, *text: str):
        """警告级日志
        :param text: 日志内容。
        """
        if text == None or len(text) == 0:
            return

        self.__file__write_list("warn", text)
        if self.console_print:
            print_set_color(self.console_warning_color)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
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
        if self.console_print:
            print_set_color(self.console_error_color)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
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
        if self.console_print:
            print_set_color(self.console_fatal_color)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
            if type(text) == tuple:
                print(*text)
            else:
                print(text)
            print_reset_color()

def json_format(data: any) -> str:
    return dumps(data, ensure_ascii=False)