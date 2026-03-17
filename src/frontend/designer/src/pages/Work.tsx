import { useLocation, useNavigate } from "react-router"
import Button from '../components/Button'
import Layout, { Vertical, Horizontal, Top, Bottom, Left, Right, Tab, TabItem, TabRef } from '../components/Layout'
import { communication } from '../components/Communication'
import TreeViewer, { TreeNode } from '../components/TreeViewer'
import { get_designer_components_raw_and_tree, get_designer_file_tree_data } from "../components/DataSource"
import { useEffect, useRef, useState } from "react"
import LogViewer, { LogViewerRef } from "../components/LogViewer"
import { set_data_num_index } from "../containers/Editor/CodeEditor"
import {Format} from "../containers/EditorContext"
import Editor, { EditorRef, UpdateContentCategory } from "../containers/Editor"
import { useProject } from "../containers/Project"
import About from './About'
import RenameProject from './RenameProject'
import { Counter } from "../components/Utils"
import { codeDrager, CodeChooseCategory } from "../containers/Editor/Utils"
import CodePaneBody from "../containers/Editor/CodePaneBody"
import CodePaneVariable from "../containers/Editor/CodePaneVariable"
import CodePaneParameter from "../containers/Editor/CodePaneParameter"
import { ContextMenu, showContextMenu, MenuItem } from '../components/ContextMenu'
import { DialogAlert, DialogAlertRef, DialogConfirm, DialogConfirmRef } from "../components/Modal"

type PropertyContent = {
    category: CodeChooseCategory,
    data: any,
    variables?: string[]
}

const Work = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const project = useProject()
    const editorRef = useRef<EditorRef>(null)
    const terminalOutputRef = useRef<LogViewerRef>(null)
    const executeOutputRef = useRef<LogViewerRef>(null)
    const rightTabRef = useRef<TabRef>(null)
    const dialogAlertRef = useRef<DialogAlertRef>(null)
    const dialogConfirmRef = useRef<DialogConfirmRef>(null)
    const [componentDatas, setComponentDatas] = useState<TreeNode[]>([])
    const [treeDatas, setTreeDatas] = useState<TreeNode[]>([])
    const [showAbout, setShowAbout] = useState(false)
    const [showRenameProject, setShowRenameProject] = useState(false)
    const [codePropertyData, setCodePropertyData] = useState<PropertyContent>()
    const path = location.state?.path

    useEffect(() => {
        if (path == null) {
            navigate("/")
            return
        }
        (async () => {
            editorRef.current!.reset()
            clearCodePropertyData()
            communication.host_message_register("TerminalOutput", (_: string) => {
                terminalOutputRef.current?.reload()
            })
            communication.host_message_register("ExecuteOutput", (_: string) => {
                executeOutputRef.current?.reload()
            })
            const [componentDatas, componentTreeNodes] = await get_designer_components_raw_and_tree()
            await project.init(componentDatas, path)
            handleFileTreeClick(project.getMainFile())
            setTreeDatas(await get_designer_file_tree_data(project.getAppName(), project.getAppPath()))
            setComponentDatas(componentTreeNodes)
        })()
    }, [path])

    const handleOpenClick = async () => {
        const app_file_path = await communication.FileSystem.OpenFileDialog("应用工程|*.proj")
        if (app_file_path != null) {
            navigate("/work", { state: { path: app_file_path } })
        }
    }

    const handleSaveClick = () => {
        editorRef.current?.save(project.getAppPath())
    }

    const handleRunClick = () => {
        editorRef.current?.run(project.getAppPath())
    }

    const handleComponentTreeClick = (_: string) => {

    }
    const handleComponentDragStart = (fullId: string) => {
        codeDrager.start_choose(fullId)
    }
    const handleComponentDragEnd = async (fullId: string) => {
        const ids = fullId.split("/")
        const position = codeDrager.finish()
        const component_data = await communication.Executor.Designer.GetComponentData(ids[ids.length - 1])
        if (component_data != null) {
            if (position == null) {
                editorRef.current!.insertContent(null, component_data)
            } else {
                editorRef.current!.insertContent(position.target, component_data)
            }
        }
    }

    const handleFileTreeClick = async (filePath: string) => {
        const extName = filePath.substring(filePath.lastIndexOf(".") + 1)
        const relativePath = filePath.substring(1)
        if (extName == "scs") {
            const fileContent = await communication.Executor.Designer.GetProjectJsonContent(project.getAppPath(), relativePath)
            set_data_num_index(fileContent["body"], new Counter())
            editorRef.current!.open(relativePath, Format.Code, fileContent)
        } else if (extName == "txt") {
            const fileContent = await communication.Executor.Designer.GetProjectTextContent(project.getAppPath(), relativePath)
            editorRef.current!.open(relativePath, Format.Text, fileContent)
        } else {
            return
        }

    }
    const handleAboutClick = () => {
        setShowAbout(true)
    }
    const handleAboutClose = () => {
        setShowAbout(false)
    }
    const handlePropertiesPaneOpen = (category: CodeChooseCategory, data: any) => {
        const variables =
            category === CodeChooseCategory.Body
                ? (editorRef.current?.getBodyVariables() ?? [])
                : category === CodeChooseCategory.Variable
                    ? (editorRef.current?.getVariableVariables() ?? [])
                    : category === CodeChooseCategory.ParameterIn || category === CodeChooseCategory.ParameterOut
                        ? (editorRef.current?.getParameterOutVariables() ?? [])
                        : undefined
        if (rightTabRef.current) {
            rightTabRef.current.active(1)
            setCodePropertyData({ category, data, variables })
        }
    }
    const handlePropertyChange = (num: number, key: string, value: string) => {
        const data = editorRef.current?.updateContent(UpdateContentCategory.Body, num, key, value)
        setCodePropertyData(prev => prev ? { ...prev, data: data! } : undefined)
    }
    const handleVariableChange = (index: number, key: string, value: string) => {
        const data = editorRef.current?.updateContent(UpdateContentCategory.Variable, index, key, value)
        data!.index = index
        setCodePropertyData(prev => prev ? { ...prev, data: data! } : undefined)
    }

    const handleParameterChange = (direction: "in" | "out", index: number, key: string, value: string) => {
        if (direction == "in") {
            const data = editorRef.current?.updateContent(UpdateContentCategory.ParameterIn, index, key, value)
            data!.index = index
            setCodePropertyData(prev => prev ? { ...prev, data: data! } : undefined)
        } else {
            const data = editorRef.current?.updateContent(UpdateContentCategory.ParameterOut, index, key, value)
            data!.index = index
            setCodePropertyData(prev => prev ? { ...prev, data: data! } : undefined)
        }
    }

    const clearCodePropertyData = () => {
        setCodePropertyData(undefined)
    }

    const handleFileTreeDrop = async (sourceFullId: string, targetFolderFullId: string, _isSourceDir: boolean) => {
        const source_relative = sourceFullId.startsWith("/") ? sourceFullId.slice(1) : sourceFullId
        const target_folder_relative = targetFolderFullId.startsWith("/") ? targetFolderFullId.slice(1) : targetFolderFullId
        const result = await communication.Executor.Designer.MoveFile(project.getAppPath(), source_relative, target_folder_relative)
        if (!result["result"]) {
            dialogAlertRef.current?.show(result["message"])
            return
        }
        setTreeDatas(await get_designer_file_tree_data(project.getAppName(), project.getAppPath()))
    }

    return (
        <Layout>
            <DialogAlert ref={dialogAlertRef} />
            <DialogConfirm ref={dialogConfirmRef} />
            <ContextMenu></ContextMenu>
            <Top>
                <Button text="打开" className="icon-[mingcute--open-door-line]" onClick={handleOpenClick} />
                <Button text="保存" className="icon-[mono-icons--save]" onClick={handleSaveClick} />
                <Button text="运行" className="icon-[material-symbols--play-circle-outline]" onClick={handleRunClick} />
                <Button text="关于" className="icon-[ix--about]" onClick={handleAboutClick} />
                {showAbout && <About onClose={handleAboutClose}></About>}
                {showRenameProject && (
                    <RenameProject
                        onClose={() => setShowRenameProject(false)}
                        currentPath={project.getAppPath()}
                        currentName={project.getAppName()}
                        onSuccess={async (newName) => {
                        project.setName(newName)
                        setTreeDatas(await get_designer_file_tree_data(newName, project.getAppPath()))
                    }}
                    />
                )}
            </Top>
            <Vertical>
                <Left><TreeViewer source={componentDatas} dragKey="editor" expand="Program" onClick={handleComponentTreeClick} onDragStart={handleComponentDragStart} onDragEnd={handleComponentDragEnd}></TreeViewer></Left>
                <Horizontal>
                    <Editor onPropertiesPaneOpen={handlePropertiesPaneOpen} onTabChange={clearCodePropertyData} ref={editorRef}></Editor>
                    <Bottom>
                        <Tab>
                            <TabItem title="终端输出"><LogViewer category="terminal" ref={terminalOutputRef}></LogViewer></TabItem>
                            <TabItem title="执行输出"><LogViewer category="execute" ref={executeOutputRef}></LogViewer></TabItem>
                        </Tab>
                    </Bottom>
                </Horizontal>
                <Right>
                    <Tab ref={rightTabRef}>
                        <TabItem title="项目管理">
                            <TreeViewer
                                source={treeDatas}
                                dragKey="file"
                                dropKey="file"
                                expand=""
                                onClick={handleFileTreeClick}
                                onDrop={handleFileTreeDrop}
                                isNodeHidden={(fullId) => fullId === "/App.proj"}
                                canAcceptDrop={(sourceFullId, sourceIsDir, targetFullId) => {
                                    if (sourceFullId === "/Main.scs") return false
                                    if (!sourceIsDir) return true
                                    if (targetFullId === sourceFullId) return false
                                    if (targetFullId.startsWith(sourceFullId + "/")) return false
                                    return true
                                }}
                                onContextMenu={(e, _fullId, _node) => {
                                    const items: MenuItem[] = []

                                    if (_node.children != null) {
                                        if (_fullId == "") {
                                            items.push({ display: "项目重命名", callback: () => { setShowRenameProject(true) } })
                                        }
                                        items.push({
                                            display: "新建文件夹",
                                            callback: async () => {
                                                const folder = await dialogConfirmRef.current?.show("新建文件夹名称") ?? null
                                                if (folder == null || folder.trim() === "") {
                                                    return
                                                }
                                                const parentPath = _fullId === ""
                                                    ? project.getAppPath()
                                                    : project.getAppPath() + _fullId.substring(1)
                                                const result = await communication.Executor.Designer.CreateFolder(parentPath, folder.trim())
                                                if (!result["result"]) {
                                                    dialogAlertRef.current?.show(result["message"])
                                                    return
                                                }
                                                setTreeDatas(await get_designer_file_tree_data(project.getAppName(), project.getAppPath()))
                                            }
                                        })
                                        items.push({
                                            display: "新建流程",
                                            callback: async () => {
                                                const name = await dialogConfirmRef.current?.show("新建流程名称") ?? null
                                                if (name == null || name.trim() === "") {
                                                    return
                                                }
                                                const parentPath = _fullId === ""
                                                    ? project.getAppPath()
                                                    : project.getAppPath() + _fullId.substring(1)
                                                const result = await communication.Executor.Designer.CreateFlowFile(parentPath, name.trim())
                                                if (!result["result"]) {
                                                    dialogAlertRef.current?.show(result["message"])
                                                    return
                                                }
                                                setTreeDatas(await get_designer_file_tree_data(project.getAppName(), project.getAppPath()))
                                            }
                                        })
                                    } else {
                                        items.push({ display: "打开", callback: () => { handleFileTreeClick(_fullId) } })
                                        if (_fullId == "/Main.scs" || _fullId == "/App.proj") {
                                            items.push({ display: "删除"})
                                        } else {
                                            items.push({ display: "删除", callback: () => {} })
                                        }
                                    }
                                    showContextMenu(e, items)
                                }}
                            />
                        </TabItem>
                        <TabItem title="属性">
                            <div className="code-pane-properties">
                                {codePropertyData && codePropertyData.category == CodeChooseCategory.Body && <CodePaneBody data={codePropertyData.data} onChange={handlePropertyChange} variables={codePropertyData.variables}></CodePaneBody>}
                                {codePropertyData && codePropertyData.category == CodeChooseCategory.Variable &&  <CodePaneVariable data={codePropertyData.data} onChange={handleVariableChange} variables={codePropertyData.variables}></CodePaneVariable>}
                                {codePropertyData && codePropertyData.category == CodeChooseCategory.ParameterIn &&  <CodePaneParameter data={codePropertyData.data} direction="in" onChange={handleParameterChange} variables={codePropertyData.variables}></CodePaneParameter>}
                                {codePropertyData && codePropertyData.category == CodeChooseCategory.ParameterOut &&  <CodePaneParameter data={codePropertyData.data} direction="out" onChange={handleParameterChange} variables={codePropertyData.variables}></CodePaneParameter>}
                            </div>
                        </TabItem>
                    </Tab>
                </Right>
            </Vertical>
        </Layout>
    )
}

export default Work