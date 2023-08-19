from __future__ import annotations

from typing import Type
from enum import Enum

from .value import *

class ContainerComponent(SequenceComponent, ABC):
    '''容器组件'''

    body:Component = None

    def set_body(self, body:Component):
        '''设置执行组'''
        self.body = body
    
    def execute(self) -> None:
        if self.body == None: return
        self.body.execute()

class ConditionalParametersComponent(ContainerComponent):
    '''条件组件'''

    def __init__(self) -> None:
        self.set_format('{condition}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', '条件', ExpressionValue)

    def set_parameter(self, *args) -> None:
        self.expression:ExpressionValue = args[0]
        self.set_log_display(self.expression.content)

    def compute(self) -> bool:
        return self.expression.get()

class EmptyParametersComponent(ContainerComponent):
    '''无参数组件'''

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition()
    
    def set_parameter(self, *args) -> None:
        pass

class ActionComponent(SequenceComponent, ABC):
    '''单语句'''

class ActionGroupComponent(ContainerComponent, ABC):
    '''语句组'''
    
    def get_type(self) -> str:
        return 'composition'

class OptionalCategory(Enum):
    '''可选项类型'''

    Boundary = 0
    Last = 1

class Optional(object):
    '''可选项'''

    def __init__(self, category:OptionalCategory, id:str, name:str, optional_component_type:Type[ContainerComponent]) -> None:
        self.category = category
        self.id = id
        self.name = name
        self.optional_component_type = optional_component_type
        self.parameter_definition = optional_component_type().define_parameter()

class OptionalDefinition(object):
    '''可选项定义'''

    def __init__(self) -> None:
        self.value:List[Optional] = []
    
    def append(self, category:OptionalCategory, id:str, name:str, optional_component_type:Type[ContainerComponent]) -> OptionalDefinition:
        self.value.append(Optional(category, id, name, optional_component_type))
        return self
    
    def to_dict(self) -> Dict[str, Optional]:
        result = {}
        for item in self.value:
            result[item.id] = item
        return result
    
    def get_definition_content(self) -> List[dict]:
        result = []
        for definition in self.value:
            item = definition.optional_component_type().get_definition_content()
            item['id'] = definition.id
            item['name'] = definition.name
            item['category'] = definition.category.name
            result.append(item)
        return result

class MultiActionGroupComponent(ContainerComponent, ABC):
    '''多语句组'''

    def get_type(self) -> str:
        return 'composition'
    
    def get_definition_content(self) -> dict:
        result = super().get_definition_content()
        result['optional'] = self.define_optional().get_definition_content()
        return result

    @abstractmethod
    def define_optional(self) -> OptionalDefinition:
        pass

    @abstractmethod
    def set_optional(self, id:str, action:SequenceComponent) -> None:
        pass