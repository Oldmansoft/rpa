from os import mkdir, listdir
from os.path import join, isdir, isfile, splitext
from json import dump, load
from datetime import datetime

import executor.component
from executor.log2 import logger

class Project:
    Current = None
    Output: executor.component.Output = executor.component.ConsoleOutput()

    def __init__(self, path:str, data:any) -> None:
        logger.info('打开项目', path)
        self.project_path = path
        self.data = data

    def run(self, file_path) -> None:
        path = join(self.project_path, file_path)
        logger.info('运行流程', path)
        with open(path, mode='r', encoding='utf-8') as file:
            component_data = load(file)
        procedure = executor.component.builder.create(Project.Output, component_data)
        procedure.execute()

    @staticmethod
    def Open(project_path) -> dict:
        if not isdir(project_path):
            return {
                'result': False,
                'message': f'无法找到应用目录 {project_path}'
            }
        app_path = join(project_path, 'App.proj')
        if not isfile(app_path):
            return {
                'result': False,
                'message': f'无效的应用目录 {project_path}，缺少 App.proj 文件。'
            }
        data = {}
        with open(app_path, mode='r') as file:
            data['App'] = load(file)

        main_file = data['App']['project']['main']
        main_path = join(project_path, main_file)
        if not isfile(main_path):
            return {
                'result': False,
                'message': f'无效的应用目录 {project_path}，缺少主运行 {main_file} 文件。'
            }
        with open(main_path, mode='r') as file:
            data['Main'] = load(file)

        data['Folders'] = []
        data['Files'] = []
        for item in listdir(project_path):
            item_path = join(project_path, item)
            if isfile(item_path):
                _, ext_name = splitext(item)
                data['Files'].append(item)
            elif isdir(item_path):
                data['Folders'].append(item)
        
        Project.Current = Project(project_path, data)
        return {
            'result': True,
            'data': data
        }
        

def create(path:str, name:str):
    folder_path = join(path, name)
    mkdir(folder_path)
    
    project_path = join(folder_path, 'App.proj')
    app_data = {
        'project': {
            'name': name,
            'version': '1.0.0',
            'create': datetime.now().strftime('%Y-%m-%d'),
            'main': 'Main.scs',
            'parameter': []
        },
        'studio': {
            'version': 'dev'
        }
    }
    with open(project_path, 'w') as file:
        dump(app_data, file, ensure_ascii=False)

    main_path = join(folder_path, 'Main.scs')
    fs_data = {
        'local': [],
        'parameter': {
            'in': [],
            'out': []
        },
        'body': []
    }
    with open(main_path, 'w', encoding='utf-8') as file:
        dump(fs_data, file, ensure_ascii=False)
    return join(folder_path, "App.proj")
