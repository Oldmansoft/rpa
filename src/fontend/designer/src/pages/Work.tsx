import { useLocation, useNavigate } from "react-router"
import Button from '../components/Button'
import Layout, { Vertical, Horizontal, Top, Bottom, Left, Right, Tab, TabItem } from '../components/Layout'
import { communication } from '../components/Communication'
import TreeViewer, { TreeNode } from '../components/TreeViewer'
import { get_designer_component_datas, get_designer_file_tree_data } from "../components/DataSource"
import { useEffect, useRef, useState } from "react"
import LogViewer from "../components/LogViewer"
import Editor, { EditorRef } from "../containers/Editor"
import { project } from "../containers/Project"
import About from './About'

const Work = () => {
    const location = useLocation()
    const navigate = useNavigate()
    const editorRef = useRef<EditorRef>(null)
    const [componentDatas, setComponetDatas] = useState<TreeNode[]>([])
    const [treeDatas, setTreeDatas] = useState<TreeNode[]>([])
    const [showAbout, setShowAbout] = useState(false)
    const path = location.state["path"]

    useEffect(() => {
        (async () => {
            const [componentDatas, componentTreeNodes] = await get_designer_component_datas()
            await project.init(componentDatas, path)
            editorRef.current?.add(project.getMainFile())
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
    const handleComponentTreeClick = (_: string) => {
        
    }
    const handleFileTreeClick = (fullname: string) => {
        editorRef.current?.add(fullname)
    }
    const handleAboutClick = async () => {
        setShowAbout(true)
    }
    const handleAboutClose = async () => {
        setShowAbout(false)
    }

    return (
        <Layout>
            <Top>
                <Button text="打开" className="icon-[mingcute--open-door-line]" onClick={handleOpenClick} />
                <Button text="关于" className="icon-[ix--about]" onClick={handleAboutClick} />
                {showAbout && <About onClose={handleAboutClose}></About>}
            </Top>
            <Vertical>
                <Left><TreeViewer source={componentDatas} dragKey="editor" onClick={handleComponentTreeClick}></TreeViewer></Left>
                <Horizontal>
                    <Editor ref={editorRef}></Editor>
                    <Bottom>
                        <Tab>
                            <TabItem title="日志"><LogViewer></LogViewer></TabItem>
                        </Tab>
                    </Bottom>
                </Horizontal>
                <Right><TreeViewer source={treeDatas} dragKey="file" dropKey="file" onClick={handleFileTreeClick}></TreeViewer></Right>
            </Vertical>
        </Layout>
    )
}

export default Work