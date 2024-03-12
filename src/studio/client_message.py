from os import listdir, stat
from os.path import expanduser, join, isdir, isfile
from win32api import RegOpenKey, RegQueryValueEx
from win32con import HKEY_CURRENT_USER, KEY_READ
from psutil import disk_partitions

import studio.project

def get_diskes():
    result = []
    for disk in disk_partitions():
        if not 'rw' in disk.opts:
            continue
        result.append(disk.device)
    return result

def get_shell_folder(name):
    key = RegOpenKey(HKEY_CURRENT_USER, r'Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders', 0, KEY_READ)
    return RegQueryValueEx(key, name)[0]

class Message(object):
    pass

class ProjectMessage(Message):
    @staticmethod
    def Create(path, name):
        if not isdir(path):
            return {
                'result': False,
                'message': f'不存在目录 {path}'
            }
        folder_path = join(path, name)
        if isdir(folder_path):
            return {
                'result': False,
                'message': f'目录 {path} 已经存在 {name}'
            }
        try:
            studio.project.create(path, name)
        except Exception as ex:
            return {
                'result': False,
                'message': f'创建项目发生错误 {ex}'
            }

        return {
            'result': True,
            'path': folder_path
        }
    
    @staticmethod
    def Open(path):
        return studio.project.Project.Open(path)
        
    @staticmethod
    def Run(path):
        return studio.project.Project.Current.run(path)

class SystemMessage(Message):
    CurrentFolderPath = expanduser('~')

    @staticmethod
    def GetFolders(path=''):
        if path == None or path == '':
            path = SystemMessage.CurrentFolderPath
        if not isdir(path):
            path = expanduser('~')
        folders = []
        for item in listdir(path):
            item_path = join(path, item)
            if stat(item_path).st_file_attributes & 2:
                continue
            if isdir(item_path):
                folders.append(item)
        return folders
    
    @staticmethod
    def GetFolderPathInfo(name, path, category='folder'):
        result = {
            'name': name,
            'type': category,
            'path': path,
            'more': False
        }
        try:
            dirs = listdir(path)
        except PermissionError:
            return None

        for item in dirs:
            item_path = join(path, item)
            if stat(item_path).st_file_attributes & 2:
                continue
            if isdir(item_path):
                result['more'] = True
                break
        return result

    @staticmethod
    def GetFolderList(path=''):
        result = []
        if path == None or path == '':
            result.append(SystemMessage.GetFolderPathInfo('桌面', get_shell_folder('Desktop'), 'desktop'))
            result.append(SystemMessage.GetFolderPathInfo('文档', get_shell_folder('Personal'), 'documents'))
            for disk in get_diskes():
                result.append(SystemMessage.GetFolderPathInfo(disk.replace('\\', ''), disk, 'hard-driver'))
            return result
        
        for item in listdir(path):
            item_path = join(path, item)
            if stat(item_path).st_file_attributes & 2:
                continue
            if not isdir(item_path):
                continue
            path_info = SystemMessage.GetFolderPathInfo(item, item_path, 'folder')
            if path_info == None:
                continue
            result.append(path_info)
        return result

messages = {}
for subclass in Message.__subclasses__():
    name = subclass.__name__.replace('Message', '')
    messages[name] = subclass