import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { communication } from '../components/Communication'

const RenameProject = ({
    onClose,
    currentPath,
    currentName,
    onSuccess,
}: {
    onClose: () => void
    currentPath: string
    currentName: string
    onSuccess?: (newName: string) => void
}) => {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const [name, setName] = useState(currentName)

    useEffect(() => {
        dialogRef.current?.showModal()
        setName(currentName)
    }, [currentName])

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setName(event.target.value)
    }

    const handleConfirmClick = async () => {
        const result = await communication.Executor.Designer.RenameProject(currentPath, name)
        if (result["result"]) {
            onClose()
            onSuccess?.(name)
        } else {
            alert(result["message"])
        }
    }

    const confirmDisabled = name === "" || name === currentName

    return createPortal(
        <dialog ref={dialogRef}>
            <div><label>名称 <input value={name} placeholder="填写工程名称" onChange={handleNameChange} /></label></div>
            <div>
                <button onClick={onClose}>取消</button>
                <button onClick={handleConfirmClick} disabled={confirmDisabled}>确定</button>
            </div>
        </dialog>,
        document.body
    )
}

export default RenameProject
