import { useLocation, useNavigate } from "react-router"
import Button from '../components/Button'
import Layout, { Vertical, Horizontal, Workspace, Top, Bottom, Left, Right, Tab, TabItem } from '../components/Layout'
import { communication } from '../components/Communication'
import TreeViewer, { TreeNode } from '../components/TreeViewer'
import { get_designer_component_datas, get_designer_file_tree_data } from "../components/DataSource"
import { useEffect, useRef, useState } from "react"
import LogViewer from "../components/LogViewer"
import Editor, { EditorRef } from "../components/Editor"

const Work = () => {
    const [componentDatas, setComponetDatas] = useState<TreeNode[]>([])
    const [treeDatas, setTreeDatas] = useState<TreeNode[]>([])
    const [appPath, setAppPath] = useState<string>("")
    const location = useLocation()
    const navigate = useNavigate()
    const editorRef = useRef<EditorRef>(null)
    const path = location.state["path"]

    useEffect(() => {
        (async () => {
            const app = await communication.Executor.Designer.GetProjectAppContent(path)
            setAppPath(app["path"])
            editorRef.current?.add(app["project"]["main"])
            setTreeDatas(await get_designer_file_tree_data(app["path"]))
            setComponetDatas(await get_designer_component_datas())
        })()
    }, [path])

    const handleOpenClick = async () => {
        const app_file_path = await communication.FileSystem.OpenFileDialog("应用工程|*.proj")
        if (app_file_path != null) {
            navigate("/work", { state: { path: app_file_path } })
        }
    }

    return (
        <Layout>
            <Top>
                <Button text="打开" className="icon-[mingcute--open-door-line]" onClick={handleOpenClick} />
            </Top>
            <Vertical>
                <Left><TreeViewer source={componentDatas} dragKey="editor"></TreeViewer></Left>
                <Horizontal>
                    <Workspace>
                        <Editor path={appPath} ref={editorRef}></Editor>
                    </Workspace>
                    <Bottom>
                        <Tab>
                            <TabItem title="日志"><LogViewer></LogViewer></TabItem>
                        </Tab>
                    </Bottom>
                </Horizontal>
                <Right><TreeViewer source={treeDatas} dragKey="file" dropKey="file"></TreeViewer></Right>
            </Vertical>
        </Layout>
    )
}

export default Work