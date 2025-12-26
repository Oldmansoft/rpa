import { useLocation, useNavigate } from "react-router"
import Button from '../components/Button'
import Layout, { Vertical, Horizontal, Top, Bottom, Left, Right, Tab, TabItem, TabRef } from '../components/Layout'
import { communication } from '../components/Communication'
import TreeViewer, { TreeNode } from '../components/TreeViewer'
import { get_designer_component_datas, get_designer_file_tree_data } from "../components/DataSource"
import { useEffect, useRef, useState } from "react"
import LogViewer, { LogViewerRef } from "../components/LogViewer"
import { set_data_num_index } from "../containers/Editor/CodeEditor"
import Editor, { EditorRef, Format, UpdateContentCategory } from "../containers/Editor"
import { project } from "../containers/Project"
import About from './About'
import { Counter } from "../components/Utils"
import { codeDrager, CodeChooseCategory } from "../containers/Editor/Utils"
import CodePaneBody from "../containers/Editor/CodePaneBody"
import CodePaneVariable from "../containers/Editor/CodePaneVariable"
import CodePaneParameter from "../containers/Editor/CodePaneParameter"

type PropertyContent = {
    category: CodeChooseCategory,
    data: any
}

const Work = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const editorRef = useRef<EditorRef>(null)
    const terminalOutputRef = useRef<LogViewerRef>(null)
    const executeOutputRef = useRef<LogViewerRef>(null)
    const rightTabRef = useRef<TabRef>(null)
    const [componentDatas, setComponetDatas] = useState<TreeNode[]>([])
    const [treeDatas, setTreeDatas] = useState<TreeNode[]>([])
    const [showAbout, setShowAbout] = useState(false)
    const [codePropertyData, setCodePropertyData] = useState<PropertyContent>()
    const path = location.state["path"]

    useEffect(() => {
        (async () => {
            communication.host_message_register("TerminalOutput", (_: string) => {
                terminalOutputRef.current?.reload()
            })
            communication.host_message_register("ExecuteOutput", (_: string) => {
                executeOutputRef.current?.reload()
            })
            const [componentDatas, componentTreeNodes] = await get_designer_component_datas()
            await project.init(componentDatas, path)
            handleFileTreeClick(project.getMainFile())
            setTreeDatas(await get_designer_file_tree_data(project.getAppPath()))
            setComponetDatas(componentTreeNodes)
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
        if (extName == "scs") {
            const fileContent = await communication.Executor.Designer.GetProjectJsonContent(project.getAppPath(), filePath)
            set_data_num_index(fileContent["body"], new Counter())
            editorRef.current!.open(filePath, Format.Code, fileContent)
        } else if (extName == "txt") {
            const fileContent = await communication.Executor.Designer.GetProjectTextContent(project.getAppPath(), filePath)
            editorRef.current!.open(filePath, Format.Text, fileContent)
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
        if (rightTabRef.current) {
            rightTabRef.current.active(1)
            setCodePropertyData({
                category: category,
                data: data
            })
        }
    }
    const handlePropertyChange = (num: number, key: string, value: string) => {
        const data = editorRef.current?.updateContent(UpdateContentCategory.Body, num, key, value)
        setCodePropertyData({
            category: CodeChooseCategory.Body,
            data: data
        })
    }
    const handleVariableChange = (index: number, key: string, value: string) => {
        const data = editorRef.current?.updateContent(UpdateContentCategory.Variable, index, key, value)
        data.index = index
        setCodePropertyData({
            category: CodeChooseCategory.Variable,
            data: data
        })
    }

    const handleParameterChange = (direction: "in" | "out", index: number, key: string, value: string) => {
        if (direction == "in") {
            const data = editorRef.current?.updateContent(UpdateContentCategory.ParameterIn, index, key, value)
            data.index = index
            setCodePropertyData({
                category: CodeChooseCategory.ParameterIn,
                data: data
            })
        } else {
            const data = editorRef.current?.updateContent(UpdateContentCategory.ParameterOut, index, key, value)
            data.index = index
            setCodePropertyData({
                category: CodeChooseCategory.ParameterOut,
                data: data
            })
        }
    }

    return (
        <Layout>
            <Top>
                <Button text="打开" className="icon-[mingcute--open-door-line]" onClick={handleOpenClick} />
                <Button text="保存" className="icon-[mono-icons--save]" onClick={handleSaveClick} />
                <Button text="运行" className="icon-[material-symbols--play-circle-outline]" onClick={handleRunClick} />
                <Button text="关于" className="icon-[ix--about]" onClick={handleAboutClick} />
                {showAbout && <About onClose={handleAboutClose}></About>}
            </Top>
            <Vertical>
                <Left><TreeViewer source={componentDatas} dragKey="editor" expand="Program" onClick={handleComponentTreeClick} onDragStart={handleComponentDragStart} OnDragEnd={handleComponentDragEnd}></TreeViewer></Left>
                <Horizontal>
                    <Editor onPropertiesPaneOpen={handlePropertiesPaneOpen} ref={editorRef}></Editor>
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
                            <TreeViewer source={treeDatas} dragKey="file" dropKey="file" onClick={handleFileTreeClick}></TreeViewer>
                        </TabItem>
                        <TabItem title="属性">
                            {codePropertyData && codePropertyData.category == CodeChooseCategory.Body && <CodePaneBody data={codePropertyData.data} onChange={handlePropertyChange}></CodePaneBody>}
                            {codePropertyData && codePropertyData.category == CodeChooseCategory.Variable &&  <CodePaneVariable data={codePropertyData.data} onChange={handleVariableChange}></CodePaneVariable>}
                            {codePropertyData && codePropertyData.category == CodeChooseCategory.ParameterIn &&  <CodePaneParameter data={codePropertyData.data} direction="in" onChange={handleParameterChange}></CodePaneParameter>}
                            {codePropertyData && codePropertyData.category == CodeChooseCategory.ParameterOut &&  <CodePaneParameter data={codePropertyData.data} direction="out" onChange={handleParameterChange}></CodePaneParameter>}
                        </TabItem>
                    </Tab>
                </Right>
            </Vertical>
        </Layout>
    )
}

export default Work