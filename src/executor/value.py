from abc import ABC, abstractmethod

from .base_define import *

def create_value(type:str, value:str, procedure) -> Value:
    if type == 'String':
        return StringValue(value, procedure)
    if type == 'Variable':
        return VariableValue(value, procedure)
    if type == 'Format':
        return FormatValue(value, procedure)
    if type == 'Expression':
        return ExpressionValue(value, procedure)
    raise NotFoundComponentError(f'不存在值类型：{type}')

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
        return eval(self.content, None, self.procedure.local_values)

class FormatValue(Value):
    '''格式化字符串'''

    def get(self) -> any:
        '''获取表达式的值
        :return: 表达式的对应值
        '''
        expression = self.content.replace('\'', '\\\'')
        expression = expression.replace('\n', '\\n')
        #TODO: 其它转义符
        return eval(f"f'{expression}'", None, self.procedure.local_values)