import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import './Editor.css'
import CodeEditor, { set_data_num_index, find_body_from_datas, find_node_from_data, find_optional_from_datas } from "./Editor/CodeEditor"
import { CodeNodePosition, CodeChooseCategory, DragMode, codeDrager } from "./Editor/Utils"
import TextEditor from "./Editor/TextEditor"
import { IconButton } from "../components/Button"
import { Top } from '../components/Layout'
import { Counter } from "../components/Utils"
import { communication } from '../components/Communication'

export enum Format {
    Text,
    Code
}

export enum UpdateContentCategory {
    Body,
    Variable,
    ParameterIn,
    ParameterOut
}

type TabContent = {
    file: string,
    format: Format,
    content: any,
    modified: boolean,
    stamp: number
}

export interface EditorRef {
    open(file: string, format: Format, content: any): void,
    save(projectPath: string): void,
    run(projectPath: string): void,
    getContent(): any,
    insertContent(target: CodeNodePosition, data: any): void
    updateContent(category: UpdateContentCategory, num: number, key: string, value: string): any
}

const Editor = forwardRef(({ onPropertiesPaneOpen }: { onPropertiesPaneOpen: (category: CodeChooseCategory, data: any) => void }, ref: React.Ref<EditorRef>) => {
    const [activeTabIndex, setActiveTabIndex] = useState(-1)
    const [tabs, setTabs] = useState<TabContent[]>([])

    useEffect(() => {
        communication.host_message_register("menu_add", (value: string) => {
            const json = JSON.parse(value)

            const content = JSON.parse(JSON.stringify(tabs[activeTabIndex].content))
            const data = find_node_from_data(content, json["composition"]);
            (async () => {
                const optional = await communication.Executor.Designer.GetComponentOptional(data["id"], json["id"])
                if (json["category"] == "Last") {
                    data["last"] = optional
                } else {
                    if (json["composition"] == json["num"]) {
                        data["optional"].unshift(optional)
                    } else {
                        for (var i=0; i<data["optional"].length; i++) {
                            if (data["optional"][i]["num"] == json["num"]) {
                                data["optional"].splice(i + 1, 0, optional)
                            }
                        }
                    }
                }
                set_data_num_index(content["body"], new Counter())

                const editTabs = [...tabs]
                editTabs[activeTabIndex].content = content
                editTabs[activeTabIndex].modified = true
                setTabs(editTabs)
            })()
        })
    })

    useImperativeHandle(ref, () => {
        return {
            open(file: string, format: Format, content: any) {
                const fileIndex = tabs.findIndex(element => element.file == file)
                if (fileIndex == -1) {
                    setTabs([...tabs, {
                        file: file,
                        format: format,
                        content: content,
                        modified: false,
                        stamp: new Date().getTime()
                    }])
                    setActiveTabIndex(tabs.length)
                } else {
                    tabs[fileIndex].stamp = new Date().getTime()
                    setActiveTabIndex(fileIndex)
                }
            },
            async save(projectPath: string) {
                if (tabs[activeTabIndex].modified) {
                    await communication.Executor.Designer.SetProjectTextContent(projectPath, tabs[activeTabIndex].file, JSON.stringify(tabs[activeTabIndex].content))
                    const editTabs = [...tabs]
                    editTabs[activeTabIndex].modified = false
                    setTabs(editTabs)
                }
            },
            run(projectPath: string) {
                communication.Executor.Designer.RunProjectAppTarget(projectPath, tabs[activeTabIndex].file)
            },
            getContent() {
                return tabs[activeTabIndex].content
            },
            insertContent(target: CodeNodePosition, data: any) {
                const content = JSON.parse(JSON.stringify(tabs[activeTabIndex].content))
                if (tabs[activeTabIndex].format == Format.Code) {
                    let target_datas = content["body"]
                    if (target.parentNum > 0) {
                        target_datas = find_body_from_datas(content["body"], target.parentNum)
                    }
                    target_datas.splice(target.index + 1, 0, data)

                    set_data_num_index(content["body"], new Counter())
                }

                const editTabs = [...tabs]
                editTabs[activeTabIndex].content = content
                editTabs[activeTabIndex].modified = true
                setTabs(editTabs)
            },
            updateContent(category: UpdateContentCategory, num: number, key: string, value: string) {
                const content = JSON.parse(JSON.stringify(tabs[activeTabIndex].content))
                let data
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
                }

                const editTabs = [...tabs]
                editTabs[activeTabIndex].content = content
                editTabs[activeTabIndex].modified = true
                setTabs(editTabs)
                return data
            }
        }
    })

    const closeTab = (index: number) => {
        const editTabs = [...tabs]
        editTabs.splice(index, 1)

        if (index == activeTabIndex) {
            let index = -1
            let maxValue = 0
            for (let i = 0; i < editTabs.length; i++) {
                if (editTabs[i].stamp > maxValue) {
                    maxValue = editTabs[i].stamp
                    index = i
                }
            }
            setActiveTabIndex(index)
        }
        setTabs(editTabs)
    }

    const handleClick = (index: number) => {
        tabs[index].stamp = new Date().getTime()
        setActiveTabIndex(index)
    }

    const handleCodeEditorNodeChoose = (category: CodeChooseCategory, data: any) => {
        onPropertiesPaneOpen(category, data)
    }

    const handleCodeEditorNodeMove = (source: CodeNodePosition, target: CodeNodePosition) => {
        if (source.parentNum == target.parentNum && source.index == target.index) {
            return
        }
        const content = JSON.parse(JSON.stringify(tabs[activeTabIndex].content))
        let source_datas = content["body"]
        
        if (source.parentNum > 0) {
            if (codeDrager.get_mode() == DragMode.boundary) {
                source_datas = find_optional_from_datas(content["body"], source.parentNum)
            } else {
                source_datas = find_body_from_datas(content["body"], source.parentNum)
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
                target_datas = find_optional_from_datas(content["body"], target.parentNum)
            }else {
                target_datas = find_body_from_datas(content["body"], target.parentNum)
            }
        }
        target_datas.splice(target.index + 1, 0, data)

        if (!beforeRemove) {
            source_datas.splice(source.index, 1)
        }

        set_data_num_index(content["body"], new Counter())

        const editTabs = [...tabs]
        editTabs[activeTabIndex].content = content
        editTabs[activeTabIndex].modified = true
        setTabs(editTabs)
    }

    const handleCodeItemAdd = (category: CodeChooseCategory) => {
        const content = JSON.parse(JSON.stringify(tabs[activeTabIndex].content))
        if (category == CodeChooseCategory.Variable) {
            content["local"].push({
                "name": "",
                "value": ""
            })
        } else if (category == CodeChooseCategory.ParameterIn) {
            content["parameter"]["in"].push({
                "name": "",
                "value": ""
            })
        } else if (category == CodeChooseCategory.ParameterOut) {
            content["parameter"]["out"].push({
                "name": "",
                "value": ""
            })
        }
        const editTabs = [...tabs]
        editTabs[activeTabIndex].content = content
        editTabs[activeTabIndex].modified = true
        setTabs(editTabs)
    }

    const tabNames = new Map<string, { name: string, path: string, paths: string[], other: string }[]>()
    const tabContentParser = tabs.map(
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
        if (value.length == 1) {
            return
        }
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

    return (
        <>
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
                {tabs.length > 0 && tabs[activeTabIndex].format == Format.Code && <CodeEditor content={tabs[activeTabIndex].content} onNodeMove={handleCodeEditorNodeMove} onPropertiesPaneOpen={handleCodeEditorNodeChoose} onItemAdd={handleCodeItemAdd}></CodeEditor>}
                {tabs.length > 0 && tabs[activeTabIndex].format == Format.Text && <TextEditor content={tabs[activeTabIndex].content}></TextEditor>}
            </div>
        </>
    )
})

export default Editor