from sys import argv
from executor.process_communication import ProcessServer, ServerCommandHandle, ProcessServerLauncherProxy
from executor.component import ActionComponent, ContainerComponent, CompositionComponent, Output, builder
from executor.log2 import logger
from executor.block_file import BlockFile, BlockMode, Writer
from os.path import isdir, join, split
from os import listdir, mkdir
from json import load
from datetime import datetime
import studio.project
logger.set("temp")

class OutputFileAndNotice:
    def __init__(self, writer: Writer, notice: str, launcher: ProcessServerLauncherProxy):
        self.writer = writer
        self.notice = notice
        self.launcher = launcher
        
    def write(self, text: str) -> None:
        self.writer.append(text.encode())
        self.launcher.send("ExecutorCommandHandle", "SendMessage", {"key": self.notice, "content": str(self.writer.count())})


class FontendOutput(Output):
    def __init__(self, terminal_output: OutputFileAndNotice, execute_output: OutputFileAndNotice):
        self.terminal_output = terminal_output
        self.execute_output = execute_output

    def write(self, index: int, content: str, name: str) -> None:
        if content is None:
            logger.info(index, name)
            self.execute_output.write(f"{datetime.now().strftime('%H:%M:%S')} {index} {name}")
        else:
            logger.info(index, name, content)
            self.execute_output.write(f"{datetime.now().strftime('%H:%M:%S')} {index} {name} {content}")
    
    def print(self, content: str) -> None:
        self.terminal_output.write(f"{datetime.now().strftime('%H:%M:%S')} {content}")


class ServerContext:
    def __init__(self):
        self.app_directory = None
    
    def on_start(self, parameters: dict):
        self.app_directory = join(parameters["AppDirectory"], "data")
        if not isdir(self.app_directory):
            mkdir(self.app_directory)


class Designer(ServerCommandHandle):
    def __init__(self, context: ServerContext):
        self.context = context

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
    
    def GetComponentData(self, id: str) -> dict:
        classes = ActionComponent.__subclasses__()
        classes.extend(ContainerComponent.__subclasses__())
        classes.extend(CompositionComponent.__subclasses__())
        for class_type in classes:
            if class_type.__name__ == id:
                return class_type().get_data_content()

    def GetComponentOptional(self, id: str, optional_id: str) -> dict:
        classes = CompositionComponent.__subclasses__()
        for class_type in classes:
            if class_type.__name__ == id:
                return class_type().define_optional().get_item(optional_id).get_data_content()

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

    def SetProjectTextContent(self, path: str, file_path: str, content: str) -> None:
        if path is None or path == "":
            raise ValueError("path 不能为空")
        if file_path is None or file_path == "":
            raise ValueError("file_path 不能为空")
        with open(join(path, file_path), mode="w", encoding="utf-8") as file:
            file.write(content)

    def RunProjectAppTarget(self, path: str, file_path: str) -> str:
        output_execute_file = BlockFile(self.context.app_directory, "execute.run", BlockMode.Write)
        output_execute_file.clear()
        output_terminal_file = BlockFile(self.context.app_directory, "terminal.run", BlockMode.Write)
        output_terminal_file.clear()

        with output_terminal_file as output_terminal_writer:
            terminal_output = OutputFileAndNotice(output_terminal_writer, "TerminalOutput", self.launcher)
            terminal_output.write(f"{datetime.now().strftime('%H:%M:%S')} 开始执行流程 {file_path}")
            with open(join(path, file_path), mode='r', encoding='utf-8') as file:
                component_data = load(file)
            with output_execute_file as output_execute_writer:
                execute_output = OutputFileAndNotice(output_execute_writer, "ExecuteOutput", self.launcher)
                procedure = builder.create(FontendOutput(terminal_output, execute_output), component_data)
                try:
                    procedure.execute()
                except Exception as e:
                    terminal_output.write(str(e))
            terminal_output.write(f"{datetime.now().strftime('%H:%M:%S')} 完成结束流程")
    
    def ReadOutput(self, category: str) -> list:
        with BlockFile(self.context.app_directory, f"{category}.run", BlockMode.Read) as reader:
            result = []
            for item in reader.list():
                result.append(item.decode())
            return result

    def CreateProject(self, path: str, name: str) -> dict:
        if not isdir(path):
            return {"result": False, "message": f"不存在目录 {path}"}
        folder_path = join(path, name)
        if isdir(folder_path):
            return {"result": False, "message": f"目录 {path} 已经存在 {name}"}
        try:
            app_path = studio.project.create(path, name)
        except Exception as ex:
            return {"result": False, "message": f"创建项目发生错误 {ex}"}

        return {"result": True, "path": app_path}


def main() -> None:
    if len(argv) < 4:
        print("Missing pipe handle.")
        return
    context = ServerContext()
    process = ProcessServer()
    process.on_start(context.on_start)
    process.register_command_handle(Designer(context))
    process.listen_with_argv()


main()
