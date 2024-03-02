from os import mkdir
from os.path import join, isdir, isfile, split
from json import dump, load
from datetime import datetime

import executor.component

class Project:
    Current = None
    def __init__(self, path:str, data:any) -> None:
        print(path)
        self.project_path = path
        self.data = data

    def run(self, file_path):
        path = join(self.project_path, file_path)
        print(self.project_path, file_path, path)
        with open(path, mode='r', encoding='utf-8') as file:
            component_data = load(file)
        procedure = executor.component.builder.create(component_data)
        procedure.execute()

    @staticmethod
    def open(project_path):
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
            'main': 'main.scs',
            'parameters': {}
        },
        'studio': {
            'version': 'dev'
        }
    }
    with open(project_path, 'w') as file:
        dump(app_data, file, ensure_ascii=False)

    main_path = join(folder_path, 'Main.scs')
    fs_data = {
        'local': {},
        'parameters': {
            'in': {},
            'out': {}
        },
        'body': []
    }
    with open(main_path, 'w', encoding='utf-8') as file:
        dump(fs_data, file, ensure_ascii=False)
