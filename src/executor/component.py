from .sequence import *

class Assign(ActionComponent):
    '''分配变量'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('分配变量')
        self.set_icon('ion--compose')
        self.set_format('将{name}设置为{value}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('name', '变量', VariableValue).append('value', '值', FormatValue)

    def set_parameter(self, *args) -> None:
        self.var_name = args[0].get()
        self.var_value: Value = args[1]
        self.set_log_display(f'{self.var_name} = {self.var_value.content}')
        
    def execute(self) -> None:
        self.procedure.assign(self.var_name, self.var_value.get())

class Print(ActionComponent):
    '''调试打印'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('调试打印')
        self.set_format('{content}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('content', '内容', FormatValue)

    def set_parameter(self, *args) -> None:
        self.content: Value = args[0]
        self.set_log_display(self.content.content)
        
    def execute(self) -> None:
        self.procedure.output.print(self.content.get())

class If(CompositionComponent):
    '''条件判断'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('如果')
        self.set_icon('ion--git-branch')
        self.set_format('{condition}')
        self.else_action: EmptyParametersComponent = None
        self.conditions: List[ConditionalParametersComponent] = []

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', '条件', ExpressionValue)

    def set_parameter(self, *args) -> None:
        self.condition: ExpressionValue = args[0]
        self.set_log_display(self.condition.content)
    
    def define_optional(self) -> OptionalDefinition:
        result = OptionalDefinition()
        result.append(OptionalCategory.Boundary, 'ElseIf', '则如', ConditionalParametersComponent)
        result.append(OptionalCategory.Last, 'Else', '否则', EmptyParametersComponent)
        return result
    
    def set_optional(self, action: SequenceComponent):
        self.conditions.append(action)

    def set_last(self, action):
        self.else_action = action

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

class While(ContainerComponent):
    '''条件循环'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('条件循环')
        self.set_format('{condition}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('condition', '条件', ExpressionValue)
    
    def set_parameter(self, *args) -> None:
        self.condition: ExpressionValue = args[0]
        self.set_log_display(self.condition.content)
    
    def execute(self) -> None:
        while self.condition.get():
            try:
                self.body.execute()
            except ContinueFunction:
                pass
            except BreakFunction:
                break
            self.log_output()

class For(ContainerComponent):
    '''遍历循环'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('遍历循环')
        self.set_format('{item} in {collection}')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition().append('item', '项', VariableValue).append('collection', '集合', ExpressionValue)
    
    def set_parameter(self, *args) -> None:
        self.item: VariableValue = args[0]
        self.collection: ExpressionValue = args[1]
        self.set_log_display(f'{self.item.content} in {self.collection.content}')
    
    def execute(self) -> None:
        self.procedure.loop_values.push(self.item.get())
        for item in self.collection.get():
            self.procedure.loop_values.set(item)
            try:
                self.body.execute()
            except ContinueFunction:
                pass
            except BreakFunction:
                break
        self.procedure.loop_values.pop()

class Break(ActionComponent):
    '''跳出结束循环'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('跳出结束循环')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition()

    def set_parameter(self, *args) -> None:
        pass
        
    def execute(self) -> None:
        raise BreakFunction()

class Continue(ActionComponent):
    '''跳过继续循环'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('跳过继续循环')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition()

    def set_parameter(self, *args) -> None:
        pass
        
    def execute(self) -> None:
        raise ContinueFunction()

class Return(ActionComponent):
    '''返回流程'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('返回流程')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition()

    def set_parameter(self, *args) -> None:
        pass
        
    def execute(self) -> None:
        raise ReturnFunction()

class Quit(ActionComponent):
    '''退出应用'''

    def __init__(self) -> None:
        super().__init__()
        self.set_name('退出应用')

    def define_parameter(self) -> ParameterDefinition:
        return ParameterDefinition()

    def set_parameter(self, *args) -> None:
        pass
        
    def execute(self) -> None:
        raise QuitFunction()

class Builder:
    def __init__(self) -> None:
        self.component_classes = {}

        classes = ActionComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
        
        classes = ContainerComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item

        classes = CompositionComponent.__subclasses__()
        for item in classes:
            if ABC in item.__bases__: continue
            self.component_classes[item.__name__] = item
    
    def create_sequence_component_by_classname(self, name: str) -> SequenceComponent:
        if name in self.component_classes:
            return self.component_classes[name]()
        raise NotFoundDefinitionError(name)

    def set_sequence_component_params(self, result: SequenceComponent, params: dict, procedure: Procedure):
        parameters = []
        for definition in result.define_parameter().value:
            if not definition.id in params:
                raise NotFoundDefinitionError(definition.id)
            if definition.value_type.__base__ == Value:
                value = definition.value_type()
                value.set(params[definition.id], procedure)
                parameters.append(value)
        result.set_parameter(*parameters)

    def set_sequence_component(self, component: SequenceComponent, node: dict, procedure: Procedure) -> SequenceComponent:
        component.set_procedure(procedure)
        if 'params' in node:
            self.set_sequence_component_params(component, node['params'], procedure)
        if component.__class__.__base__ == ActionBodyComponent:
            group: ActionBodyComponent = component
            group.set_body(self.create_body(procedure, node['body']))
        if component.__class__.__base__ == ContainerComponent:
            group: ContainerComponent = component
            group.set_body(self.create_body(procedure, node['body']))
            procedure.get_line_number()
        elif component.__class__.__base__ == CompositionComponent:
            mgroup: CompositionComponent = component
            mgroup.set_body(self.create_body(procedure, node['body']))
            definitions = mgroup.define_optional().to_dict()
            if 'optional' in node:
                for optional in node['optional']:
                    definition = definitions[optional['id']]
                    optional_component = definition.optional_component_type()
                    optional_component.set_name(definition.name)
                    self.set_sequence_component(optional_component, optional, procedure)
                    mgroup.set_optional(optional_component)
            if 'last' in node:
                definition = definitions[node['last']['id']]
                else_component = definition.optional_component_type()
                else_component.set_name(definition.name)
                self.set_sequence_component(else_component, node['last'], procedure)
                mgroup.set_last(else_component)
            procedure.get_line_number()
    
    def create_body(self, procedure: Procedure, nodes: List[dict]):
        result = MultiSequenceComponent()
        for node in nodes:
            component = self.create_sequence_component_by_classname(node['id'])
            self.set_sequence_component(component, node, procedure)
            result.append(component)
        return result
    
    def create(self, output: Output, data: dict) -> Procedure:
        procedure = Procedure(output)
        local_variables = data['local']
        for local_variable in local_variables:
            value = FormatValue()
            value.set(local_variable["value"], procedure)
            procedure.define(local_variable["name"], value)
        
        procedure.body = self.create_body(procedure, data['body'])
        return procedure

builder = Builder()