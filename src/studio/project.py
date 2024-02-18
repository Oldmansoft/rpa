from os import mkdir
from os.path import join
from json import dump
from datetime import datetime

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
    with open(main_path, 'w') as file:
        dump(fs_data, file, ensure_ascii=False)