from __future__ import annotations
from typing import List, Dict
from abc import ABC, abstractmethod

from .error import *

class ParameterDefinition(object):
    '''参数定义'''

    def __init__(self) -> None:
        self.value:Dict[str, type] = {}

    def append(self, key: str, definition:type) -> ParameterDefinition:
        self.value[key] = definition
        return self
    
    def info(self):
        result = {}
        for key in self.value:
            result[key] = self.value[key].__name__
        return result

class Component(ABC):
    '''组件基类'''

    @abstractmethod
    def execute(self) -> None:
        '''执行'''

class ActionContainer(Component, ABC):
    action: Action = None

    def execute(self) -> None:
        if self.action == None: return
        self.action.execute()

class SequenceComponent(Component):
    '''序列组件'''

    __display_content: str = None
    __log_name: str = None

    @abstractmethod
    def param_definition(self) -> ParameterDefinition:
        pass

    @abstractmethod
    def set_param(self, *args) -> None:
        pass

    def set_procedure(self, procedure:Procedure) -> None:
        self.procedure = procedure
        self.index = procedure.get_line_number()
    
    def set_display(self, content:str) -> None:
        self.__display_content = content

    def set_log_name(self, name:str) -> None:
        self.__log_name = name

    def log_output(self) -> None:
        if self.__log_name == None:
            self.__log_name = self.__class__.__name__
        print('\033[0;33;40m', end='')
        print(self.index, end=' ')
        print('\033[0m', end='')
        print('\033[0;35;40m', end='')
        if self.__display_content != None:
            print(self.__log_name, end=' ')
        else:
            print(self.__log_name)
        print('\033[0m', end='')
        if self.__display_content != None:
            print(self.__display_content)

class ConditionalComponent(ActionContainer, SequenceComponent):
    def param_definition(self) -> ParameterDefinition:
        return ParameterDefinition().append('expression', ExpressionValue)
    
    def set_param(self, *args) -> None:
        self.expression = args[0].get_value()
        self.set_display(self.expression)

    def compute(self) -> bool:
        return eval(self.expression, self.procedure.local_values)

class UnconditionalComponent(ActionContainer, SequenceComponent):
    def param_definition(self) -> ParameterDefinition:
        return []
    
    def set_param(self, *args) -> None:
        pass

class ConditionalComponentGroup(List[ConditionalComponent]):
    '''条件动作段列表'''

class CompositionComponent(SequenceComponent, ABC):
    def log_output(self) -> None:
        pass

class Action(Component):
    '''动作段'''

    def __init__(self) -> None:
        self.components: List[SequenceComponent] = []

    def append(self, component:SequenceComponent) -> None:
        self.components.append(component)
    
    def execute(self) -> None:
        for component in self.components:
            component.log_output()
            component.execute()

class Value(ABC):
    '''值基类'''

    def __init__(self, content:str, procedure:Procedure) -> None:
        self.content = content
        self.procedure = procedure

    @abstractmethod
    def get_value(self) -> any:
        '''执行'''
    
    @staticmethod
    def create(type:str, value:str, procedure:Procedure) -> Value:
        if type == 'string':
            return StringValue(value, procedure)
        if type == 'variable':
            return VariableValue(value, procedure)
        if type == 'format':
            return FormatValue(value, procedure)
        if type == 'expression':
            return ExpressionValue(value, procedure)
        raise NotFoundComponentError(f'不存在值类型：{type}')

class StringValue(Value):
    '''字符串'''

    def get_value(self) -> any:
        '''获取值
        :return: 字符串'''
        return self.content

class VariableValue(Value):
    '''变量'''

    def get_value(self) -> any:
        '''获取值
        :return: 字符串'''
        return self.content

class ExpressionValue(Value):
    '''表达式'''

    def get_value(self) -> any:
        '''获取值
        :return: 字符串'''
        return self.content

class FormatValue(Value):
    '''格式化字符串'''

    def get_value(self) -> any:
        '''获取表达式的值
        :return: 表达式的对应值
        '''
        expression = self.content.replace('\'', '\\\'')
        return eval(f"f'{expression}'", None, self.procedure.local_values)

class Procedure(ActionContainer):
    '''流程'''

    def __init__(self) -> None:
        super().__init__()
        self.line_number: int = 0
        self.local_values: Dict[str, any] = {}
     
    def get_line_number(self) -> int:
        self.line_number += 1
        return self.line_number
    
    def define(self, name:str, value:Value=None) -> None:
        '''定义变量
        格式化列表的内容写入到文件中。
        :param name: 变量名称。
        :param value: 值。
        '''
        if name in self.local_values: raise NameComponentError(f'{name} 已经存在，不能重新定义。')
        if value == None:
            self.local_values[name] = None
        else:
            self.local_values[name] = value.get_value()