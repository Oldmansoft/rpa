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

class Browser extends CommunicationProxy {

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

    async Call<T>(name: string, method: string, content: any): Promise<T> {
        const command = {
            name: name,
            method: method,
            content: content,
            ask: true
        }
        const command_text = JSON.stringify(command)
        const return_value = await this.communication.webview2.Executor.CallCommand(command_text)
        const result = JSON.parse(return_value)
        if (return_value == null) {
            return result
        }
        if (result["error"] != null) {
            throw new Error(result["error"])
        }
        return result["result"]
    }

    Send(name: string, method: string, content: any): void {
        const command = {
            name: name,
            method: method,
            content: content,
            ask: false
        }
        const command_text = JSON.stringify(command)
        this.communication.webview2.Executor.CallCommand(command_text)
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
        return this.executor.Call(this.name, this.GetAllComponents.name, null)
    }

    GetComponentData(id: string): Promise<any> {
        return this.executor.Call(this.name, this.GetComponentData.name, { id: id })
    }

    GetComponentOptional(id: string, optional_id: string): Promise<any> {
        return this.executor.Call(this.name, this.GetComponentOptional.name, { id: id, optional_id: optional_id })
    }

    GetFileTree(path: string): Promise<any> {
        return this.executor.Call(this.name, this.GetFileTree.name, { path: path })
    }

    GetProjectAppContent(app_path: string): Promise<any> {
        return this.executor.Call(this.name, this.GetProjectAppContent.name, { app_path: app_path })
    }

    GetProjectJsonContent(path: string, file_path: string): Promise<any> {
        return this.executor.Call(this.name, this.GetProjectJsonContent.name, { path: path, file_path: file_path })
    }

    GetProjectTextContent(path: string, file_path: string): Promise<string[]> {
        return this.executor.Call(this.name, this.GetProjectTextContent.name, { path: path, file_path: file_path })
    }

    SetProjectTextContent(path: string, file_path: string, content: string): Promise<void> {
        return this.executor.Call(this.name, this.SetProjectTextContent.name, { path: path, file_path: file_path, content: content })
    }

    RunProjectAppTarget(path: string, file_path: string): void {
        this.executor.Send(this.name, this.RunProjectAppTarget.name, { path: path, file_path: file_path })
    }

    ReadOutput(category: string): Promise<string[]> {
        return this.executor.Call(this.name, this.ReadOutput.name, { category: category })
    }

    CreateProject(path: string, name: string): Promise<any> {
        return this.executor.Call(this.name, this.CreateProject.name, { path: path, name: name })
    }

    RenameProject(path: string, name: string): Promise<any> {
        return this.executor.Call(this.name, this.RenameProject.name, { path: path, name: name })
    }

    CreateFolder(path: string, folder: string): Promise<any> {
        return this.executor.Call(this.name, this.CreateFolder.name, { path: path, folder: folder })
    }

    CreateFlowFile(path: string, name: string): Promise<any> {
        return this.executor.Call(this.name, this.CreateFlowFile.name, { path: path, name: name })
    }
}

export type Callback = (result: any) => void

class Communication {
    webview2: any
    Browser: Browser
    FileSystem: FileSystem
    Executor: Executor
    AsyncResultDealers: any
    HostMessageDealer: any

    constructor() {
        this.webview2 = window.chrome.webview.hostObjects.webview2
        this.Browser = new Browser(this, "Browser")
        this.FileSystem = new FileSystem(this, "FileSystem")
        this.Executor = new Executor(this, "Executor")

        const asyncResultDealers: any = {}
        this.AsyncResultDealers = asyncResultDealers
        const hostMessageDealer: any = {}
        this.HostMessageDealer = hostMessageDealer
        
        window.communication = {}
        window.communication.host_call_result = function (key: string) {
            asyncResultDealers[key].apply(window, Array.from(arguments).slice(1))
        }
        window.communication.host_send_message = function(key: string, content: string) {
            hostMessageDealer[key].apply(window, [content])
        }
        window.communication.host_call_message = function(key: string, content: string) {
            return hostMessageDealer[key].apply(window, [content])
        }
    }

    async_result<T>(name: string, method: string): Promise<T> {
        return new Promise((resolve) => {
            const key = `${name}.${method}`
            if (key in this.AsyncResultDealers) {
                delete this.AsyncResultDealers[key]
            }
            this.AsyncResultDealers[key] = resolve
        })
    }

    host_message_register(key: string, callback: Callback) {
        if (key in this.HostMessageDealer) {
            delete this.HostMessageDealer[key]
        }
        this.HostMessageDealer[key] = callback
    }
}

export const communication = new Communication()