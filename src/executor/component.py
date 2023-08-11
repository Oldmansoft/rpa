from .base_define import *

class Assign(SequenceComponent):
    '''分配'''

    def param_definition(self) -> ParameterDefinition:
        return ParameterDefinition().append('name', VariableValue).append('value', FormatValue)

    def set_param(self, *args) -> None:
        self.var_name = args[0].get_value()
        self.var_value = args[1]
        self.set_display(f'{self.var_name} = {self.var_value.content}')
        
    def execute(self) -> None:
        if not self.var_name in self.procedure.local_values: raise NameComponentError(f'变量 {self.var_name} 未定义')
        self.procedure.local_values[self.var_name] = self.var_value.get_value()

class Print(SequenceComponent):
    '''打印'''

    def param_definition(self) -> ParameterDefinition:
        return ParameterDefinition().append('content', FormatValue)

    def set_param(self, *args) -> None:
        self.content = args[0]
        self.set_display(self.content.content)
        
    def execute(self) -> None:
        print('\033[0;34;40m', end='')
        print(self.content.get_value())
        print('\033[0m', end='')

class If(CompositionComponent):
    '''条件判断'''

    else_action: UnconditionalComponent = None
    conditions: List[ConditionalComponent] = []

    def param_definition(self) -> ParameterDefinition:
        return ParameterDefinition().append('If', ConditionalComponent).append('ElseIf', ConditionalComponentGroup).append('Else', UnconditionalComponent)

    def set_param(self, *args) -> None:
        self.conditions.append(args[0])
        for item in args[1]:
            self.conditions.append(item)
        self.else_action = args[2]

    def set_procedure(self, procedure: Procedure) -> None:
        pass

    def execute(self) -> None:
        for condition in self.conditions:
            condition.log_output()
            if condition.compute():
                condition.action.execute()
                return
        if self.else_action != None:
            self.else_action.log_output()
            self.else_action.execute()

class While(CompositionComponent):
    '''循环'''

    def param_definition(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', ConditionalComponent)

    def set_param(self, *args) -> None:
        self.condition:ConditionalComponent = args[0]
    
    def execute(self) -> None:
        self.condition.log_output()
        while self.condition.compute():
            self.condition.action.execute()
            self.condition.log_output()

def info():
    result = {}
    classes = SequenceComponent.__subclasses__()
    for item in classes:
        if ABC in item.__bases__: continue
        if ActionContainer in item.__bases__: continue
        result[item.__name__] = item().param_definition().info()
    
    classes = CompositionComponent.__subclasses__()
    for item in classes:
        result[item.__name__] = item().param_definition().info()
    
    return result

class Builder:
    def __init__(self) -> None:
        self.component_classes = {}

        classes = SequenceComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
        
        classes = CompositionComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
    
    def __create_component(self, name) -> SequenceComponent:
        if name in self.component_classes:
            return self.component_classes[name]()
        raise NotFoundComponentError(name)

    def create_component(self, name, params:dict, procedure:Procedure) -> SequenceComponent:
        result = self.__create_component(name)
        result.set_procedure(procedure)
        definitions = result.param_definition().value
        parameters = []
        for key in definitions:
            if not key in params: raise NotFoundComponentError(key)
            param = params[key]
            if definitions[key].__base__ == Value:
                parameters.append(Value.create(param['type'], param['value'], procedure))
            elif definitions[key] == ConditionalComponent:
                condition = self.create_component('ConditionalComponent', param, procedure)
                condition.set_log_name(key)
                condition.action = self.create_action(procedure, param['action'])
                parameters.append(condition)
            elif definitions[key] == ConditionalComponentGroup:
                group = []
                for param_item in param:
                    condition = self.create_component('ConditionalComponent', param_item, procedure)
                    condition.set_log_name(key)
                    condition.action = self.create_action(procedure, param_item['action'])
                    group.append(condition)
                parameters.append(group)
            elif definitions[key] == UnconditionalComponent:
                condition = UnconditionalComponent()
                condition.set_procedure(procedure)
                condition.set_log_name(key)
                condition.action = self.create_action(procedure, param['action'])
                parameters.append(condition)
        result.set_param(*parameters)
        return result
    
    def create_action(self, procedure:Procedure, nodes:list):
        action = Action()
        for node in nodes:
            component = self.create_component(node['id'], node['params'], procedure)
            action.append(component)
        return action
    
    def create(self, data:dict) -> Procedure:
        procedure = Procedure()
        local_variables = data['local']
        for local_variable_name in local_variables:
            local_variable = local_variables[local_variable_name]
            procedure.define(local_variable_name, Value.create(local_variable['type'], local_variable['value'], procedure))
        
        procedure.action = self.create_action(procedure, data['action'])
        return procedure

builder = Builder()