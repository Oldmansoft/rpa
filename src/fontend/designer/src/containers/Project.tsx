import { communication } from '../components/Communication'

class Project  {
    private path: string
    private mainFile: string
    private components: any

    constructor() {
        this.path = ""
        this.mainFile = ""
        this.components = {}
    }

    async init(components: any, app_file_path: string) {
        this.components = components

        const app_content = await communication.Executor.Designer.GetProjectAppContent(app_file_path)
        this.path = app_content["path"]
        this.mainFile = app_content["project"]["main"]
    }

    getAppPath() {
        return this.path
    }

    getMainFile() {
        return this.mainFile
    }

    getComponents(){
        return this.components
    }
}

export const project = new Project()