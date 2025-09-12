import { forwardRef, useImperativeHandle, useState, useEffect } from "react"
import { communication } from "./Communication"

export interface LogViewerRef {
    reload(): void
}

const LogViewer = forwardRef(({ category } : { category: string }, ref: React.Ref<LogViewerRef>) => {
    const [contents, setContents] = useState<string[]>([])
    useImperativeHandle(ref, () => {
        return {
            async reload () {
                setContents(await communication.Executor.Designer.ReadOutput(category))
            }
        }
    })
    useEffect(() => {
        (async () => {
            setContents(await communication.Executor.Designer.ReadOutput(category))
        })()
    })
    return (
        <>
            {contents.map(
                (item, index) => (
                    <div key={index}>{item}</div>
                )
            )}
        </>
    )
})

export default LogViewer