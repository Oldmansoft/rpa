class ComponentError(Exception):
    '''组件错误'''

class DefinitionError(Exception):
    '''定义错误'''

class NameDefinitionError(DefinitionError):
    '''名称错误'''

class SyntaxDefinitionError(DefinitionError):
    '''语法错误'''

class NotFoundDefinitionError(DefinitionError):
    '''缺少错误'''

class ComponentFunction(Exception):
    '''组件功能'''

class BreakFunction(ComponentFunction):
    '''跳出结束循环'''

class ContinueFunction(ComponentFunction):
    '''跳过继续循环'''

class ReturnFunction(ComponentFunction):
    '''返回流程'''

class QuitFunction(ComponentFunction):
    '''退出程序'''