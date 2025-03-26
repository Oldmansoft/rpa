from sys import argv
from executor.process_pipe import ServerProcess, ProcessCommand, CommandHandle
from executor.component import ActionComponent, ContainerComponent, CompositionComponent
from executor.log2 import logger
from os.path import isdir, join, split
from os import listdir
from json import load
import studio.project


class Designer(CommandHandle):
    def GetAllComponents(self) -> list:
        groups = []
        items = []
        classes = ActionComponent.__subclasses__()
        classes.extend(ContainerComponent.__subclasses__())
        classes.extend(CompositionComponent.__subclasses__())
        for class_type in classes:
            items.append(class_type().get_definition_content())

        program = {"category": "group", "id": "Program", "name": "程序设计", "list": items}
        groups.append(program)
        return groups

    def GetFileTree(self, path: str) -> list:
        if path is None or path == "":
            raise ValueError("path 不能为空")
        result = []
        for dir in listdir(path):
            dir_path = join(path, dir)
            if isdir(dir_path):
                result.append({"name": dir, "children": self.GetFileTree(dir_path)})
            else:
                result.append({"name": dir})
        return result

    def GetProjectAppContent(self, app_path: str) -> dict:
        if app_path is None or app_path == "":
            raise ValueError("app_path 不能为空")
        with open(app_path, mode="r", encoding="utf-8") as file:
            result = load(file)
            result["path"], result["name"] = split(app_path.replace("\\", "/"))
            result["path"] = f"{result['path']}/"
            return result

    def GetProjectJsonContent(self, path: str, file_path: str) -> dict:
        if path is None or path == "":
            raise ValueError("path 不能为空")
        if file_path is None or file_path == "":
            raise ValueError("file_path 不能为空")
        with open(join(path, file_path), mode="r", encoding="utf-8") as file:
            return load(file)
    
    def GetProjectTextContent(self, path: str, file_path: str) -> list:
        if path is None or path == "":
            raise ValueError("path 不能为空")
        if file_path is None or file_path == "":
            raise ValueError("file_path 不能为空")
        with open(join(path, file_path), mode="r", encoding="utf-8") as file:
            return file.readlines()

    def Create(self, path: str, name: str) -> dict:
        if not isdir(path):
            return {"result": False, "message": f"不存在目录 {path}"}
        folder_path = join(path, name)
        if isdir(folder_path):
            return {"result": False, "message": f"目录 {path} 已经存在 {name}"}
        try:
            studio.project.create(path, name)
        except Exception as ex:
            return {"result": False, "message": f"创建项目发生错误 {ex}"}

        return {"result": True, "path": folder_path}

    def Open(self, path: str) -> dict:
        return studio.project.Project.Open(path)

    def Run(self, path: str) -> None:
        return studio.project.Project.Current.run(path)


def on_command(command: ProcessCommand) -> tuple:
    logger.warning("未处理命令", command.name, command.method, command.content)
    return command.name, command.method


def main() -> None:
    if len(argv) < 3:
        print("Missing pipe handle.")
        return

    # 获取传递的管道句柄
    in_read_handle = int(argv[1])
    out_write_handle = int(argv[2])
    process = ServerProcess()
    process.on_command = on_command
    process.register_command_handle(Designer())
    process.bind(in_read_handle, out_write_handle)


main()
