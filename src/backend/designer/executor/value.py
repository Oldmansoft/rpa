from simpleeval import simple_eval

from .base_define import *

class StringValue(Value):
    '''字符串'''

    def get(self) -> any:
        '''获取值
        :return: 字符串'''
        return self.content

class VariableValue(Value):
    '''变量'''

    def get(self) -> any:
        '''获取值
        :return: 字符串'''
        return self.content

class ExpressionValue(Value):
    '''表达式'''

    def get(self) -> any:
        '''获取值
        :return: 表达式结果'''
        return eval(self.content, None, self.procedure.get_all_values())

class Delimiter:
    def __init__(self):
        self.char = None
        self.closed = True
    
    def is_close(self) -> bool:
        return self.closed
    
    def set_state(self, char: str) -> bool:
        if self.is_close():
            self.char = char
            self.closed = False
        elif char == self.char:
            self.closed = True

def is_alone_expression(text: str) -> bool:
    if text is None:
        return False
    if text == "":
        return False
    if text[0] != "{" or text[-1] != "}":
        return False
    delimiter = Delimiter()
    i = 1
    length = len(text) - 1
    while i < length:
        char = text[i]
        if char == "\\" and i + 2 < length:
            i += 2
        char = text[i]
        if char in ['"', "'"]:
            delimiter.set_state(char)
        elif char == "}":
            if delimiter.is_close():
                return False
        i += 1
    return True

class FormatValue(Value):
    '''格式化字符串'''

    def get(self) -> any:
        '''获取表达式的值
        :return: 表达式的对应值
        '''
        expression = self.content
        expression = expression.replace('\\', '\\\\')
        expression = expression.replace('\r', '\\r')
        expression = expression.replace('\n', '\\n')
        expression = expression.replace('\'', '\\\'')
        return simple_eval(f"f'{expression}'", names=self.procedure.get_all_values())