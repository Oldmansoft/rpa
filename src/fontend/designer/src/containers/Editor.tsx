import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import styles from './Editor.styles.module.css'
import { Top } from '../components/Layout'
import CodeEditor, { set_data_num_index, find_parent_from_datas } from "./Editor/CodeEditor"
import TextEditor from "./Editor/TextEditor"
import { ContentEditorRef, CodeNodePosition } from "./Editor/Utils"
import { Counter } from "../components/Utils"

export enum Format {
    text,
    code
}

export interface EditorRef {
    open(file: string, format: Format, content: any): void,
    getContent(): any,
    insertContent(target: CodeNodePosition, data: any): void
}

const Editor = forwardRef(({ }, ref: React.Ref<EditorRef>) => {
    const [tabContents, setTabContents] = useState<string[]>([])
    const [activeTabIndex, setActiveTabIndex] = useState(-1)
    const [editFormat, setEditFormat] = useState<Format>()
    const [editContent, setEditContent] = useState<any>(null)
    const contentEditorRef = useRef<ContentEditorRef>(null)

    useImperativeHandle(ref, () => {
        return {
            async open(file: string, format: Format, content: any) {

                const index = tabContents.indexOf(file)
                if (index == -1) {
                    setTabContents([...tabContents, file])
                    setActiveTabIndex(tabContents.length)
                } else {
                    setActiveTabIndex(index)
                }
                setEditFormat(format)
                setEditContent(content)
            },
            getContent() {
                return contentEditorRef.current!.getContent()
            },
            insertContent(target: CodeNodePosition, data: any) {
                const content = JSON.parse(JSON.stringify(editContent))
                if (editFormat == Format.code) {
                    let target_datas = content["body"]
                    if (target.parentNum > 0) {
                        target_datas = find_parent_from_datas(content["body"], target.parentNum)
                    }
                    target_datas.splice(target.index + 1, 0, data)
                    
                    set_data_num_index(content["body"], new Counter())
                }
                setEditContent(content)
            }
        }
    })

    const handleClick = async (index: number) => {
        //setActiveTabIndex(index)
    }

    const handleCodeEditorNodeMove = (source: CodeNodePosition, target: CodeNodePosition) => {
        if (source.parentNum == target.parentNum && source.index == target.index) {
            return
        }
        const content = JSON.parse(JSON.stringify(editContent))
        let source_datas = content["body"]
        if (source.parentNum > 0) {
            source_datas = find_parent_from_datas(content["body"], source.parentNum)
        }
        const data = source_datas[source.index]

        const beforeRemove = source.parentNum != target.parentNum || source.index > target.index
        if (beforeRemove) {
            source_datas.splice(source.index, 1)
        }
        
        let target_datas = content["body"]
        if (target.parentNum > 0) {
            target_datas = find_parent_from_datas(content["body"], target.parentNum)
        }
        target_datas.splice(target.index + 1, 0, data)

        if (!beforeRemove) {
            source_datas.splice(source.index, 1)
        }

        set_data_num_index(content["body"], new Counter())
        setEditContent(content)
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
                {editFormat == Format.code && <CodeEditor content={editContent} onNodeMove={handleCodeEditorNodeMove}></CodeEditor>}
                {editFormat == Format.text && <TextEditor content={editContent} ref={contentEditorRef}></TextEditor>}
            </div>
        </>
    )
})

export default Editor