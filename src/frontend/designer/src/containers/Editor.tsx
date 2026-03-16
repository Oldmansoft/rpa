import { forwardRef, useImperativeHandle, useState, useRef, useEffect, useMemo } from "react"
import './Editor.css'
import CodeEditor, { set_data_num_index, find_node_from_data } from "./Editor/CodeEditor"
import { CodeNodePosition, CodeChooseCategory, DragMode, codeDrager } from "./Editor/Utils"
import TextEditor from "./Editor/TextEditor"
import { IconButton } from "../components/Button"
import { Top } from '../components/Layout'
import { Counter } from "../components/Utils"
import { communication } from '../components/Communication'
import { EditorContext, Format, TabContentValue } from "./EditorContext"

export enum UpdateContentCategory {
    Body,
    Variable,
    ParameterIn,
    ParameterOut
}

export interface EditorRef {
    reset(): void,
    open(file: string, format: Format, content: any): void,
    save(projectPath: string): void,
    run(projectPath: string): void,
    getContent(): any,
    getVariableVariables(): string[],
    getBodyVariables(): string[],
    getParameterOutVariables(): string[],
    insertContent(target: CodeNodePosition | null, data: any): void
    updateContent(category: UpdateContentCategory, num: number, key: string, value: string): any
}

const Editor = forwardRef(({ onPropertiesPaneOpen, onTabChange }: { onPropertiesPaneOpen: (category: CodeChooseCategory, data: any) => void, onTabChange: () => void }, ref: React.Ref<EditorRef>) => {
    const [activeTabIndex, setActiveTabIndex] = useState(-1)
    const [tabs, setTabs] = useState<TabContentValue[]>([])
    const tabsRef = useRef(tabs)
    const activeTabIndexRef = useRef(activeTabIndex)

    useEffect(() => {
        tabsRef.current = tabs
        activeTabIndexRef.current = activeTabIndex
    }, [tabs, activeTabIndex])

    const activeTabSetContent = (content: any) => {
        const currentTabs = tabsRef.current
        const currentIndex = activeTabIndexRef.current
        const editTabs = [...currentTabs]
        editTabs[currentIndex].content = JSON.parse(JSON.stringify(content))
        editTabs[currentIndex].modified = true
        setTabs(editTabs)
    }

    useImperativeHandle(ref, () => {
        return {
            reset() {
                setTabs([])
            },
            open(file: string, format: Format, content: any) {
                const currentTabs = tabsRef.current
                const fileIndex = currentTabs.findIndex(element => element.file == file)
                if (fileIndex == -1) {
                    setTabs([...currentTabs, {
                        file: file,
                        format: format,
                        content: content,
                        modified: false,
                        stamp: new Date().getTime()
                    }])
                    setActiveTabIndex(currentTabs.length)
                    onTabChange()
                } else {
                    const nextTabs = [...currentTabs]
                    nextTabs[fileIndex] = { ...nextTabs[fileIndex], stamp: new Date().getTime() }
                    setTabs(nextTabs)
                    setActiveTabIndex(fileIndex)
                    onTabChange()
                }
            },
            async save(projectPath: string) {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return
                if (currentTabs[currentIndex].modified) {
                    await communication.Executor.Designer.SetProjectTextContent(projectPath, currentTabs[currentIndex].file, JSON.stringify(currentTabs[currentIndex].content))
                    const editTabs = [...currentTabs]
                    editTabs[currentIndex] = { ...editTabs[currentIndex], modified: false }
                    setTabs(editTabs)
                }
            },
            run(projectPath: string) {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex >= 0 && currentIndex < currentTabs.length) {
                    communication.Executor.Designer.RunProjectAppTarget(projectPath, currentTabs[currentIndex].file)
                }
            },
            getContent() {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return undefined
                return currentTabs[currentIndex].content
            },
            getVariableVariables() {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return []
                const result: string[] = []
                for (const item of currentTabs[currentIndex].content["parameter"]["in"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                return result
            },
            getBodyVariables() {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return []

                const result: string[] = []
                for (const item of currentTabs[currentIndex].content["local"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                for (const item of currentTabs[currentIndex].content["parameter"]["in"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                for (const item of currentTabs[currentIndex].content["parameter"]["out"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                return result
            },
            getParameterOutVariables() {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return []

                const result: string[] = []
                for (const item of currentTabs[currentIndex].content["local"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                for (const item of currentTabs[currentIndex].content["parameter"]["in"]) {
                    if (item["name"] == "") continue
                    result.push(item["name"])
                }
                return result
            },
            insertContent(target: CodeNodePosition | null, data: any) {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return
                const content = currentTabs[currentIndex].content
                if (currentTabs[currentIndex].format == Format.Code) {
                    if (target == null) {
                        if (content["body"].length > 0) return
                        content["body"].push(data)
                    } else {
                        let target_data = content
                        if (target.parentNum > 0) {
                            target_data = find_node_from_data(content, target.parentNum)
                        }
                        target_data["body"].splice(target.index + 1, 0, data)
                    }
                    set_data_num_index(content["body"], new Counter())
                }
                activeTabSetContent(content)
            },
            updateContent(category: UpdateContentCategory, num: number, key: string, value: string) {
                const currentTabs = tabsRef.current
                const currentIndex = activeTabIndexRef.current
                if (currentIndex < 0 || currentIndex >= currentTabs.length) return undefined
                const content = currentTabs[currentIndex].content
                let data: any
                if (category == UpdateContentCategory.Body) {
                    data = find_node_from_data(content, num)
                    if (key == "") {
                        data.display = value
                    } else {
                        data.params[key] = value
                    }
                } else if (category == UpdateContentCategory.Variable) {
                    data = content["local"][num]
                    data[key] = value
                } else if (category == UpdateContentCategory.ParameterIn) {
                    data = content["parameter"]["in"][num]
                    data[key] = value
                } else if (category == UpdateContentCategory.ParameterOut) {
                    data = content["parameter"]["out"][num]
                    data[key] = value
                } else {
                    return undefined
                }
                activeTabSetContent(content)
                return data
            }
        }
    }, [onTabChange])

    const switchActiveTabIndex = (index: number) => {
        if (index == activeTabIndex) {
            return
        }
        setActiveTabIndex(index)
        onTabChange()
    }

    const closeTab = (index: number) => {
        const editTabs = [...tabs]
        editTabs.splice(index, 1)

        if (index == activeTabIndex) {
            let newActiveIndex = -1
            let maxValue = 0
            for (let i = 0; i < editTabs.length; i++) {
                if (editTabs[i].stamp > maxValue) {
                    maxValue = editTabs[i].stamp
                    newActiveIndex = i
                }
            }
            setActiveTabIndex(newActiveIndex)
            onTabChange()
        }
        setTabs(editTabs)
    }

    const handleClick = (index: number) => {
        tabs[index].stamp = new Date().getTime()
        switchActiveTabIndex(index)
    }

    const handleCodeEditorNodeChoose = (category: CodeChooseCategory, data: any) => {
        onPropertiesPaneOpen(category, data)
    }

    const handleCodeEditorNodeMove = (source: CodeNodePosition, target: CodeNodePosition) => {
        if (source.parentNum == target.parentNum && source.index == target.index) {
            return
        }
        const content = tabs[activeTabIndex].content
        let source_datas = content["body"]
        if (source.parentNum > 0) {
            if (codeDrager.get_mode() == DragMode.boundary) {
                source_datas = find_node_from_data(content, source.parentNum)["optional"]
            } else {
                source_datas = find_node_from_data(content, source.parentNum)["body"]
            }
        }
        const data = source_datas[source.index]

        const beforeRemove = source.parentNum != target.parentNum || source.index > target.index
        if (beforeRemove) {
            source_datas.splice(source.index, 1)
        }

        let target_datas = content["body"]
        if (target.parentNum > 0) {
            if (codeDrager.get_mode() == DragMode.boundary) {
                target_datas = find_node_from_data(content, target.parentNum)["optional"]
            }else {
                target_datas = find_node_from_data(content, target.parentNum)["body"]
            }
        }
        target_datas.splice(target.index + 1, 0, data)

        if (!beforeRemove) {
            source_datas.splice(source.index, 1)
        }

        set_data_num_index(content["body"], new Counter())

        activeTabSetContent(content)
    }

    const tabContentParser = useMemo(() => {
        const tabNames = new Map<string, { name: string, path: string, paths: string[], other: string }[]>()
        const parser = tabs.map(
            (item) => {
                const paths = item.file.split("/")
                const name = paths[paths.length - 1]
                if (!tabNames.has(name)) {
                    tabNames.set(name, [])
                }
                const value = {
                    name: name,
                    path: item.file,
                    paths: paths.slice(0, -1),
                    other: ""
                }
                tabNames.get(name)?.push(value)
                return value
            }
        )
        tabNames.forEach((value) => {
            if (value.length == 1) return
            for (const item of value) {
                if (item.paths.length == 0) {
                    item.other = "./"
                } else if (item.paths.length == 1) {
                    item.other = item.paths[0]
                } else {
                    item.other = `.../${item.paths[item.paths.length - 1]}`
                }
            }
        })
        return parser
    }, [tabs])

    const tabContent = {
        index : activeTabIndex,
        values : tabs,
        setContent: activeTabSetContent
    }

    return (
        <EditorContext.Provider value={tabContent}>
            <Top className="tab_groups">
                {tabContentParser.map(
                    (item, index) => {
                        let other = undefined
                        if (item.other != "") {
                            other = (<span>{item.other}</span>)
                        }
                        let state = undefined
                        if (tabs[index].modified) {
                            state = (<span>*</span>)
                        }
                        return (
                            <label key={item.path} className={index == activeTabIndex ? "tab_active" : "tab"} onClick={() => handleClick(index)}>
                                {item.name}
                                {other}
                                {state}
                                <IconButton onClick={() => { closeTab(index) }} className="icon-[mdi--close] align-middle"></IconButton>
                            </label>
                        )
                    }
                )}
            </Top>
            <div className="editor">
                {tabs.length > 0 && tabs[activeTabIndex].format == Format.Code && <CodeEditor content={tabs[activeTabIndex].content} onNodeMove={handleCodeEditorNodeMove} onPropertiesPaneOpen={handleCodeEditorNodeChoose}></CodeEditor>}
                {tabs.length > 0 && tabs[activeTabIndex].format == Format.Text && <TextEditor content={tabs[activeTabIndex].content}></TextEditor>}
            </div>
        </EditorContext.Provider>
    )
})

export default Editor