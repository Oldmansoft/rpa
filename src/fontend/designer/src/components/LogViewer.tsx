import { forwardRef, useImperativeHandle, useState } from "react"

export interface LogViewerRef {
    add(content: string): void,
    reset(): void
}

const LogViewer = forwardRef(({ }, ref: React.Ref<LogViewerRef>) => {
    const [contents, setContents] = useState<string[]>([])
    useImperativeHandle(ref, () => {
        return {
            add(content: string) {
                setContents([...contents, content])
            },
            reset() {
                setContents([])
            }
        }
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