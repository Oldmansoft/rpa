class ComponentError(Exception):
    '''组件错误'''

class NameComponentError(ComponentError):
    '''名称错误'''

class SyntaxComponentError(ComponentError):
    '''语法错误'''

class NotFoundComponentError(ComponentError):
    '''缺少错误'''