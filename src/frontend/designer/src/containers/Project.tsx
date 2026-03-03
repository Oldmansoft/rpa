import { createContext, useContext, ReactNode } from 'react'
import { communication } from '../components/Communication'

export class Project {
    private path: string
    private mainFile: string
    private components: any

    constructor() {
        this.path = ""
        this.mainFile = ""
        this.components = {}
    }

    async init(components: any, app_file_path: string): Promise<void> {
        this.components = components

        const app_content = await communication.Executor.Designer.GetProjectAppContent(app_file_path)
        if (app_content == null || typeof app_content !== "object") {
            this.path = ""
            this.mainFile = ""
            return
        }
        this.path = app_content["path"] ?? ""
        this.mainFile = (app_content["project"] != null && typeof app_content["project"] === "object")
            ? (app_content["project"]["main"] ?? "")
            : ""
    }

    getAppPath(): string {
        return this.path
    }

    getMainFile(): string {
        return this.mainFile
    }

    getComponents(): any {
        return this.components
    }
}

const defaultProject = new Project()

export const ProjectContext = createContext<Project>(defaultProject)

export function ProjectProvider({
    children,
    project: projectProp,
}: {
    children: ReactNode
    project?: Project
}) {
    const value = projectProp ?? defaultProject
    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    )
}

export function useProject(): Project {
    return useContext(ProjectContext)
}

/** @deprecated 优先使用 useProject()，便于测试与多实例；此处保留兼容 */
export const project = defaultProject