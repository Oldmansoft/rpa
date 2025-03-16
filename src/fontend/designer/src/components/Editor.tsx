import { forwardRef, useImperativeHandle, useState, useEffect } from "react"
import { communication } from "./Communication"

export interface EditorRef {
    add(file_path: string): void
}

const Editor = forwardRef(({ path }: { path: string }, ref: React.Ref<EditorRef>) => {
    const [tabContents, setTabContents] = useState<string[]>([])
    const [activeTabIndex, setActiveTabIndex] = useState(-1)
    const [editContent, setEditContent] = useState<any>(null)
    useImperativeHandle(ref, () => {
        return {
            add(file_path: string) {
                setTabContents([...tabContents, file_path])
                setActiveTabIndex(tabContents.length)
            }
        }
    }, [])

    useEffect(() => {
        (async () => {
            if (path == "") {
                return
            }
            const file_content = await communication.Executor.Designer.GetProjectFileContent(path, tabContents[activeTabIndex])
            setEditContent(file_content)
        })()
    }, [path])

    return (
        <>
            <div className="tab-label">
                {tabContents.map(
                    (item) => (
                        <label key={item}>{item}</label>
                    )
                )}
            </div>
            <div>
                {editContent ? JSON.stringify(editContent) : ""}
            </div>
        </>
    )
})

export default Editor