from __future__ import annotations

from typing import List, Dict, Type
from abc import ABC, abstractmethod

from .error import *

class Logger(ABC):
    '''终端输出'''

    @abstractmethod
    def write(self, index: int, content: str, name: str) -> None:
        '''写入'''
    
    @abstractmethod
    def print(self, content:str) -> None:
        '''打印'''

class PrintLogger(Logger):
    '''打印输出'''

    def write(self, index: int, content: str, name: str) -> None:
        print('\033[0;33;40m', end='')
        print(index, end=' ')
        print('\033[0m', end='')
        print('\033[0;35;40m', end='')
        if content != None:
            print(name, end=' ')
        else:
            print(name)
        print('\033[0m', end='')
        if content != None:
            print(content)
    
    def print(self, content: str) -> None:
        print('\033[0;34;40m', end='')
        print(content)
        print('\033[0m', end='')

class Component(ABC):
    '''组件基类'''

    @abstractmethod
    def execute(self) -> None:
        '''执行'''

class Value(ABC):
    '''值基类'''

    def set(self, content: str, procedure: Procedure) -> None:
        self.content = content
        self.procedure = procedure

    @abstractmethod
    def get(self) -> any:
        '''执行'''

class Parameter(object):
    '''参数'''

    def __init__(self, id: str, name: str, value_type: type) -> None:
        self.id = id
        self.name = name
        self.value_type: Type[Value] = value_type
    
    def get_value_type(self):
        return self.value_type.__name__.replace('Value', '')

class ParameterDefinition(object):
    '''参数定义'''

    def __init__(self) -> None:
        self.value:List[Parameter] = []

    def append(self, id: str, name: str, value_type: type) -> ParameterDefinition:
        self.value.append(Parameter(id, name, value_type))
        return self
    
    def get_definition_content(self) -> List[dict]:
        result = []
        for definition in self.value:
            param = {
                'id': definition.id,
                'name': definition.name,
                'type': definition.get_value_type()
            }
            result.append(param)
        return result
    
    def get_data_content(self) -> dict:
        result = {}
        for definition in self.value:
            result[definition.id] = ""
        return result
    

class SequenceComponent(Component):
    '''序列组件'''

    def __init__(self) -> None:
        self.__display_content: str = None
        self.__name: str = None
        self.__format: str = None

    @abstractmethod
    def define_parameter(self) -> ParameterDefinition:
        pass

    @abstractmethod
    def set_parameter(self, *args) -> None:
        pass

    def set_procedure(self, procedure: Procedure) -> None:
        self.procedure = procedure
        self.index = procedure.get_line_number()
    
    def set_log_display(self, content: str) -> None:
        self.__display_content = content

    def set_name(self, name: str) -> None:
        self.__name = name
    
    def get_name(self) -> str:
        if self.__name == None:
            return self.__class__.__name__
        return self.__name
    
    def set_format(self, format: str) -> None:
        self.__format = format
    
    def get_format(self) -> str:
        return self.__format

    def get_type(self) -> str:
        return 'unit'

    def log_output(self) -> None:
        self.procedure.logger.write(self.index, self.__display_content, self.get_name())
    
    def get_definition_content(self) -> dict:
        return {
            'category': 'item',
            'id': self.__class__.__name__,
            'type': self.get_type(),
            'name': self.get_name(),
            'params': self.define_parameter().get_definition_content(),
            'format': self.get_format()
        }
    
    def get_data_content(self) -> dict:
        return {
            "id": self.__class__.__name__,
            "params": self.define_parameter().get_data_content()
        }

class MultiSequenceComponent(Component):
    '''多个序列组件'''

    def __init__(self) -> None:
        self.components: List[SequenceComponent] = []

    def append(self, component: SequenceComponent) -> None:
        self.components.append(component)
    
    def execute(self) -> None:
        for component in self.components:
            component.log_output()
            component.execute()

class StackKeyValue(object):
    '''栈 键值'''

    def __init__(self) -> None:
        self.names: List[str] = []
        self.values: List[any] = []

    def push(self, name: str) -> None:
        self.names.append(name)
        self.values.append(None)
    
    def pop(self) -> None:
        self.names.pop()
        self.values.pop()
    
    def set(self, value: any) -> None:
        self.values[-1] = value
    
    def peek(self) -> dict:
        if len(self.names) == 0:
            return {}
        return {
            self.names[-1]: self.values[-1]
        }

class Procedure(Component):
    '''流程'''

    def __init__(self, logger: Logger) -> None:
        self.logger = logger
        self.line_number: int = 0
        self.local_values: Dict[str,any] = {}
        self.stack_values = []
        self.loop_values = StackKeyValue()
        self.body: Component = None
     
    def get_line_number(self) -> int:
        self.line_number += 1
        return self.line_number
    
    def define(self, name: str, value: Value = None) -> None:
        '''定义变量
        格式化列表的内容写入到文件中。
        :param name: 变量名称。
        :param value: 值。
        '''
        if name in self.local_values:
            raise NameDefinitionError(f'{name} 已经存在，不能重新定义。')
        if value == None:
            self.local_values[name] = None
        else:
            self.local_values[name] = value.get()
    
    def assign(self, name: str, value: any) -> None:
        if not name in self.local_values:
            raise NameDefinitionError(f'变量 {name} 未定义')
        self.local_values[name] = value

    def get_all_values(self) -> Dict[str,any]:
        result = self.local_values.copy()
        result.update(self.loop_values.peek())
        return result
    
    def execute(self) -> None:
        if self.body == None: return
        try:
            self.body.execute()
        except ReturnFunction:
            pass

class Project(Component):
    '''程序'''

    @staticmethod
    def Create(name: str, folder_path: str) -> None:
        pass

    @staticmethod
    def Load(file_path: str) -> Project:
        pass

    def execute(self) -> None:
        try:
            super().execute()
        except QuitFunction:
            pass