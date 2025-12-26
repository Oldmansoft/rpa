import { useNavigate } from 'react-router'
import Button from '../components/Button'
import { Loading, LoadingRef } from '../components/Modal'
import { useRef, useState } from 'react'
import Layout, { Top } from '../components/Layout'
import { communication } from '../components/Communication'
import CreateProject from './CreateProject'
import About from './About'

const Start = () => {
    const loading = useRef<LoadingRef>(null)
    const navigate = useNavigate()
    const [showCreateProject, setShowCreateProject] = useState(false)
    const [showAbout, setShowAbout] = useState(false)

    const handleCreateProjectClick = () => {
        setShowCreateProject(true)
    }
    const handleCreateProjectClose = () => {
        setShowCreateProject(false)
    }
    const handleOpenClick = async () => {
        const app_file_path = await communication.FileSystem.OpenFileDialog("应用工程|*.proj")
        if (app_file_path != null) {
            navigate("/work", { state: { path: app_file_path } })
        }
    }
    const handleImportClick = async () => {
    }
    const handleAboutClick = () => {
        setShowAbout(true)
    }
    const handleAboutClose = () => {
        setShowAbout(false)
    }
    return (
        <Layout>
            <Top>
                <Button text="创建" className="icon-[ion--compose]" onClick={handleCreateProjectClick} />
                <Button text="打开" className="icon-[mingcute--open-door-line]" onClick={handleOpenClick} />
                <Button text="导入" className="icon-[lets-icons--import-fill]" onClick={handleImportClick} />
                <Button text="关于" className="icon-[ix--about]" onClick={handleAboutClick} />

                {showCreateProject && <CreateProject onClose={handleCreateProjectClose}></CreateProject>}
                {showAbout && <About onClose={handleAboutClose}></About>}
                <Loading ref={loading}></Loading>
            </Top>
        </Layout>
    )
}

export default Start