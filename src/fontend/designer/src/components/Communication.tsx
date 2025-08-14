declare const window: {
    chrome: any,
    communication: any,
    communication_debug: Communication
} & Window

class CommunicationProxy {
    communication: Communication
    name: string

    constructor(communication: Communication, name: string) {
        this.communication = communication
        this.name = name
    }
}

class FileSystem extends CommunicationProxy {
    FolderBrowserDialog(description: string): Promise<string> {
        this.communication.webview2.FileSystem.FolderBrowserDialog(description)
        return this.communication.async_result(this.name, this.FolderBrowserDialog.name)
    }

    OpenFileDialog(filter: string): Promise<string> {
        this.communication.webview2.FileSystem.OpenFileDialog(filter, false)
        return this.communication.async_result(this.name, this.OpenFileDialog.name)
    }
}

class Executor extends CommunicationProxy {
    Designer: Designer = new Designer(this, "Designer")

    async CallCommand<T>(name: string, method: string, content: any): Promise<T> {
        const command = {
            name: name,
            method: method,
            content: content,
            ask: true
        }
        const command_text = JSON.stringify(command)
        console.info(command_text)
        const return_value = await this.communication.webview2.Executor.CallCommand(command_text)
        console.info(return_value)
        const result = JSON.parse(return_value)
        if (result["error"] != null) {
            throw new Error(result["error"])
        }
        return result["result"]
    }
}

class ExecutorProxy {
    executor: Executor
    name: string
    constructor(executor: Executor, name: string) {
        this.executor = executor
        this.name = name
    }
}

class Designer extends ExecutorProxy {
    GetAllComponents(): Promise<any> {
        return this.executor.CallCommand(this.name, this.GetAllComponents.name, null)
    }

    GetComponentData(id: string): Promise<any> {
        return this.executor.CallCommand(this.name, this.GetComponentData.name, { id: id })
    }

    GetFileTree(path: string): Promise<any> {
        return this.executor.CallCommand(this.name, this.GetFileTree.name, { path: path })
    }

    GetProjectAppContent(app_path: string): Promise<any> {
        return this.executor.CallCommand(this.name, this.GetProjectAppContent.name, { app_path: app_path })
    }

    GetProjectJsonContent(path: string, file_path: string): Promise<any> {
        return this.executor.CallCommand(this.name, this.GetProjectJsonContent.name, { path: path, file_path: file_path })
    }

    GetProjectTextContent(path: string, file_path: string): Promise<string[]> {
        return this.executor.CallCommand(this.name, this.GetProjectTextContent.name, { path: path, file_path: file_path })
    }

    SetProjectTextContent(path: string, file_path: string, content: string): Promise<void> {
        return this.executor.CallCommand(this.name, this.SetProjectTextContent.name, { path: path, file_path: file_path, content: content})
    }
}

export type Callback = (result: any) => void

class Communication {
    webview2: any
    FileSystem: FileSystem
    Executor: Executor

    constructor() {
        this.webview2 = window.chrome.webview.hostObjects.webview2
        window.communication = {}
        window.communication.async_result = {}
        window.communication.callback = {}
        window.communication.host_call_result = function (key: string) {
            window.communication.async_result[key].apply(window, Array.from(arguments).slice(1))
        }
        window.communication.host_callback = function (key: string, result: any) {
            window.communication.callback[key](result)
        }
        window.communication_debug = this

        this.FileSystem = new FileSystem(this, "FileSystem")
        this.Executor = new Executor(this, "Executor")
    }

    private nothing(_: any) {
    }

    async_result<T>(name: string, method: string): Promise<T> {
        return new Promise((resolve) => {
            window.communication.async_result[`${name}.${method}`] = resolve
        })
    }

    callback_regisiter(key: string, callback: Callback) {
        window.communication.callback[key] = callback
    }
    callback_unregister(key: string) {
        window.communication.callback[key] = this.nothing
    }
}

export const communication = new Communication()