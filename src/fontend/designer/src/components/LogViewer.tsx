import { forwardRef, useImperativeHandle, useState } from "react"
import styles from './Modal.styles.module.css'

interface LogViewerRef {
    add(content: string): void
}

const LogViewer = forwardRef(({ }, ref: React.Ref<LogViewerRef>) => {
    const [contents, setContents] = useState<string[]>([])
    useImperativeHandle(ref, () => {
        return {
            add(content: string) {
                setContents([...contents, content])
            }
        }
    }, [])
    return (
        <div className={styles.log_viewer}>
            {contents.map(
                (item, index) => (
                    <div key={index}>{item}</div>
                )
            )}
        </div>
    )
})

export default LogViewer