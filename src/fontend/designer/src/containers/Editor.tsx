import { forwardRef, useImperativeHandle, useState } from "react"
import styles from './Editor.styles.module.css'
import { Top } from '../components/Layout'
import CodeEditor from "./Editor/CodeEditor"
import TextEditor from "./Editor/TextEditor"

export interface EditorRef {
    add(file: string): void
}

const Editor = forwardRef(({ }, ref: React.Ref<EditorRef>) => {
    const [tabContents, setTabContents] = useState<string[]>([])
    const [activeTabIndex, setActiveTabIndex] = useState(-1)
    const [editType, setEditType] = useState<string>("")
    const [editFile, setEditFile] = useState<any>(null)

    useImperativeHandle(ref, () => {
        return {
            add(file: string) {
                const extName = file.substring(file.lastIndexOf(".") + 1)
                if (extName == "scs") {
                    setEditType("code")
                } else if (extName == "txt") {
                    setEditType("text")
                } else {
                    return
                }
                setEditFile(file)

                const index = tabContents.indexOf(file)
                if (index == -1) {
                    setTabContents([...tabContents, file])
                    setActiveTabIndex(tabContents.length)
                } else {
                    setActiveTabIndex(index)
                }
            }
        }
    })

    const handleClick = (index: number) => {
        const file = tabContents[index]
        const extName = file.substring(file.lastIndexOf(".") + 1)
        if (extName == "scs") {
            setEditType("code")
        } else if (extName == "txt") {
            setEditType("text")
        }
        setActiveTabIndex(index)
        setEditFile(tabContents[index])
    }

    return (
        <>
            <Top className={styles.tab_groups}>
                {tabContents.map(
                    (item, index) => (
                        <label key={item} className={index == activeTabIndex ? styles.tab_active : styles.tab} onClick={() => handleClick(index)}>{item}</label>
                    )
                )}
            </Top>
            <div className={styles.editor}>
                {editType == "code" && <CodeEditor file={editFile}></CodeEditor>}
                {editType == "text" && <TextEditor file={editFile}></TextEditor>}
            </div>
        </>
    )
})

export default Editor