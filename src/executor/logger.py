from datetime import datetime
from os.path import join, exists, split, isdir, getmtime
from os import getcwd, makedirs, remove
from traceback import print_exc
from io import StringIO
from ctypes import windll
from sys import argv


STD_OUTPUT_HANDLE= windll.kernel32.GetStdHandle(-11)
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
    def __init__(self, name:str, filename: str = None, folder: str = None, new_content: bool = True, console_print = True) -> None:
        if folder == None:
            folder = split(argv[0])[0]
        if filename == None:
            filename = split(argv[0])[1]
        if not isdir(folder):
            raise NotADirectoryError(f"不存在指定目录 {folder}。")
        self._file_path = join(folder, f"{filename}.log")
        self.name = name
        
        if new_content:
            self.reset()
        else:
            if exists(self._file_path):
                self.date = datetime.fromtimestamp(getmtime(self._file_path)).date()
            else:
                self.date = datetime.now().date()
                with open(self._file_path, "a", encoding="utf-8") as file:
                    file.write(datetime.now().strftime("%Y-%m-%d"))
        self.console_print = console_print

    def reset(self) -> None:
        self.date = datetime.now().date()
        if exists(self._file_path):
            remove(self._file_path)
        with open(self._file_path, "a", encoding="utf-8") as file:
                file.write(datetime.now().strftime("%Y-%m-%d"))

    def __file__write_list(self, level, text) -> None:
        """文件写入列表
        格式化列表的内容写入到文件中。
        :param level: 级别。
        :param text: 写入文件内容列表。
        """
        with open(self._file_path, "a", encoding="utf-8") as file:
            if self.date != datetime.now().date():
                self.date = datetime.now().date()
                file.write("\n")
                file.write(datetime.now().strftime("%Y-%m-%d"))
            file.write(f"\n{level}  ")
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
        
        if self.console_print:
            print_set_color(FOREGROUND_GREY)
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
            print_set_color(FOREGROUND_WATER | FOREGROUND_GREY)
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
            print_set_color(FOREGROUND_YELLOW | FOREGROUND_GREY)
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
            print_set_color(FOREGROUND_RED | FOREGROUND_GREY)
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
            print_set_color(FOREGROUND_PURPLE | FOREGROUND_GREY)
            print(self.name, datetime.now().strftime("%H:%M:%S"), end=" ")
            if type(text) == tuple:
                print(*text)
            else:
                print(text)
            print_reset_color()