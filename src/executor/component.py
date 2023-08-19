from .sequence import *

class Assign(ActionComponent):
    '''分配'''

    def __init__(self) -> None:
        self.set_name('分配')
        self.set_format('将{name}设置为{value}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('name', '变量', VariableValue).append('value', '值', FormatValue)

    def set_parameter(self, *args) -> None:
        self.var_name = args[0].get()
        self.var_value:Value = args[1]
        self.set_log_display(f'{self.var_name} = {self.var_value.content}')
        
    def execute(self) -> None:
        if not self.var_name in self.procedure.local_values: raise NameComponentError(f'变量 {self.var_name} 未定义')
        self.procedure.local_values[self.var_name] = self.var_value.get()

class Print(ActionComponent):
    '''打印'''

    def __init__(self) -> None:
        self.set_name('打印')
        self.set_format('{content}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('content', '内容', FormatValue)

    def set_parameter(self, *args) -> None:
        self.content:Value = args[0]
        self.set_log_display(self.content.content)
        
    def execute(self) -> None:
        print('\033[0;34;40m', end='')
        print(self.content.get())
        print('\033[0m', end='')

class If(MultiActionGroupComponent):
    '''条件判断'''

    else_action: EmptyParametersComponent = None
    conditions: List[ConditionalParametersComponent] = []

    def __init__(self) -> None:
        self.set_name('如果')
        self.set_format('{condition}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', '条件', ExpressionValue)

    def set_parameter(self, *args) -> None:
        self.condition:ExpressionValue = args[0]
        self.set_log_display(self.condition.content)
    
    def define_optional(self) -> OptionalDefinition:
        result = OptionalDefinition()
        result.append(OptionalCategory.Boundary, 'ElseIf', '如果', ConditionalParametersComponent)
        result.append(OptionalCategory.Last, 'Else', '否则', EmptyParametersComponent)
        return result
    
    def set_optional(self, id: str, action: SequenceComponent):
        if id == 'Else':
            self.else_action = action
        elif id == 'ElseIf':
            self.conditions.append(action)

    def execute(self) -> None:
        if self.condition.get():
            self.body.execute()
            return
        
        for condition in self.conditions:
            condition.log_output()
            if condition.compute():
                condition.execute()
                return
            
        if self.else_action != None:
            self.else_action.log_output()
            self.else_action.execute()

class While(ActionGroupComponent):
    '''循环'''

    def __init__(self) -> None:
        self.set_name('循环')
        self.set_format('{condition}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', '条件', ExpressionValue)
    
    def set_parameter(self, *args) -> None:
        self.condition:ExpressionValue = args[0]
        self.set_log_display(self.condition.content)
    
    def execute(self) -> None:
        while self.condition.get():
            self.body.execute()
            self.log_output()

class For(ActionGroupComponent):
    '''遍历'''

    def __init__(self) -> None:
        self.set_name('遍历')
        self.set_format('{item} in {collection}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('item', '项', VariableValue).append('collection', '集合', ExpressionValue)
    
    def set_parameter(self, *args) -> None:
        self.item:VariableValue = args[1]
        self.collection:ExpressionValue = args[1]
        self.set_log_display(f'{self.item.content} in {self.collection.content}')
    
    def execute(self) -> None:
        for item in self.collection.get():
            self.body.execute()
            self.log_output()

class Builder:
    def __init__(self) -> None:
        self.component_classes = {}

        classes = ActionComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
        
        classes = ActionGroupComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item

        classes = MultiActionGroupComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
    
    def create_sequence_component_by_classname(self, name) -> SequenceComponent:
        if name in self.component_classes:
            return self.component_classes[name]()
        raise NotFoundComponentError(name)

    def set_sequence_component_params(self, result:SequenceComponent, params:dict, procedure:Procedure):
        parameters = []
        for definition in result.define_parameter().value:
            if not definition.id in params: raise NotFoundComponentError(definition.id)
            param = params[definition.id]
            if definition.value_type.__base__ == Value:
                parameters.append(create_value(param['type'], param['value'], procedure))
        result.set_parameter(*parameters)

    def set_sequence_component(self, component:SequenceComponent, node:dict, procedure:Procedure) -> SequenceComponent:
        component.set_procedure(procedure)
        if 'params' in node:
            self.set_sequence_component_params(component, node['params'], procedure)
        if component.__class__.__base__ == ContainerComponent:
            group:ContainerComponent = component
            group.set_body(self.create_body(procedure, node['body']))
        if component.__class__.__base__ == ActionGroupComponent:
            group:ActionGroupComponent = component
            group.set_body(self.create_body(procedure, node['body']))
        elif component.__class__.__base__ == MultiActionGroupComponent:
            mgruop:MultiActionGroupComponent = component
            mgruop.set_body(self.create_body(procedure, node['body']))
            definitions = mgruop.define_optional().to_dict()
            if 'optional' in node:
                for optional in node['optional']:
                    optional_component = definitions[optional['id']].optional_component_type()
                    optional_component.set_name(definitions[optional['id']].name)
                    self.set_sequence_component(optional_component, optional, procedure)
                    mgruop.set_optional(optional['id'], optional_component)
    
    def create_body(self, procedure:Procedure, nodes:List[dict]):
        result = MultiSequenceComponent()
        for node in nodes:
            component = self.create_sequence_component_by_classname(node['id'])
            self.set_sequence_component(component, node, procedure)
            result.append(component)
        return result
    
    def create(self, data:dict) -> Procedure:
        procedure = Procedure()
        local_variables = data['local']
        for local_variable_name in local_variables:
            local_variable = local_variables[local_variable_name]
            procedure.define(local_variable_name, create_value(local_variable['type'], local_variable['value'], procedure))
        
        procedure.body = self.create_body(procedure, data['body'])
        return procedure

builder = Builder()