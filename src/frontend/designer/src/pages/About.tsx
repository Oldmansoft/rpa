import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

const About = ({ onClose }: { onClose: () => void }) => {
    const dialogRef = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        dialogRef.current?.showModal()
    }, [])

    return createPortal(
        <dialog ref={dialogRef}>
            <div>Demo</div>
            <button onClick={onClose}>关闭</button>
        </dialog>,
        document.body
    )
}

export default About