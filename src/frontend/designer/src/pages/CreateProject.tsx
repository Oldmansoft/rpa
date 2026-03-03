import { useNavigate } from 'react-router'
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { communication } from '../components/Communication'

const CreateProject = ({onClose}: {onClose: () => void}) => {
    const navigate = useNavigate()
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [name, setName] = useState("")
    const [location, setLocation] = useState("")

    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setName(event.target.value)
    }

    const handleLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setLocation(event.target.value)
    }

    const handleBrowseClick = async () => {
        const folder_path = await communication.FileSystem.FolderBrowserDialog("创建工程")
        setLocation(folder_path)
    }

    const handleConfirmClick = async () => {
        const result = await communication.Executor.Designer.CreateProject(location, name)
        if (result["result"]) {
            onClose()
            navigate("/work", { state: { path: result["path"] } })
        } else {
            alert(result["message"])
        }
    }

    const confirmDisabled = name == "" || location == ""

    return createPortal(
        <dialog ref={dialogRef}>
            <div><label>名称 <input value={name} placeholder="填写工程名称" onChange={handleNameChange} /></label></div>
            <div><label>位置 <input value={location} placeholder="填写工程存在路径" onChange={handleLocationChange} /><button onClick={handleBrowseClick}>浏览</button></label></div>
            <div>
                <button onClick={onClose}>取消</button>
                <button onClick={handleConfirmClick} disabled={confirmDisabled}>确定</button>
            </div>
        </dialog>,
        document.body
    )
}

export default CreateProject