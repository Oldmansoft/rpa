import React, { useContext } from "react"
import { useProject } from "../Project"
import { KeyGenerator, Counter } from "../../components/Utils"
import { TagName } from "./Utils"
import { IconButton } from "../../components/Button"
import { showContextMenu } from "../../components/ContextMenu"
import { EditorContext, TabContent } from "../EditorContext"
import { communication } from "../../components/Communication"
import {
    find_component,
    find_node_from_data,
    set_data_num_index,
    setChosen,
} from "./CodeEditorUtils"

function create_format_code_node(text: string) {
    if (text == "") return <var>[空字符串]</var>
    const key = new KeyGenerator()
    const result: React.JSX.Element[] = []
    const matches = text.matchAll(/(\{.*?\})|\\n/g)
    let last_index = 0
    for (const match of matches) {
        if (match.index != null && match.index > last_index) {
            result.push(<span key={key.next()}>{text.substring(last_index, match.index)}</span>)
        }
        result.push(<var key={key.next()}>{match[0]}</var>)
        last_index = (match.index ?? 0) + match[0].length
    }
    if (last_index < text.length) {
        result.push(<span key={key.next()}>{text.substring(last_index)}</span>)
    }
    return result
}

function content_node_creator(key: KeyGenerator, typeValue: string, text: string) {
    if (typeValue == "Variable") {
        text = text.trim()
        return text == ""
            ? <var key={key.next()} className="error">[请填写]</var>
            : <var key={key.next()}>{text}</var>
    }
    if (typeValue == "Format") {
        return <mark key={key.next()}>{create_format_code_node(text)}</mark>
    }
    if (typeValue == "Expression") {
        text = text.trim()
        return text == ""
            ? <var key={key.next()} className="error">[请填写]</var>
            : <var key={key.next()}>{text}</var>
    }
    throw new TypeError(typeValue)
}

const editor_action_remove = (tabContent: TabContent, parent_num: number, index: number) => {
    const content = tabContent.values[tabContent.index].content
    let data = content
    if (parent_num > 0) {
        data = find_node_from_data(content, parent_num)
    }
    data["body"]?.splice(index, 1)
    set_data_num_index(content["body"], new Counter())
    tabContent.setContent(content)
}

const editor_composition_add_item = (
    tabContent: TabContent,
    component_optional_id: string,
    component_category: string,
    composition_num: number,
    targetNum: number
) => {
    const content = tabContent.values[tabContent.index].content
    const data = find_node_from_data(content, composition_num)
    ;(async () => {
        const optional = await communication.Executor.Designer.GetComponentOptional(data["id"], component_optional_id)
        if (component_category == "Last") {
            data["last"] = optional
        } else {
            if (composition_num == targetNum) {
                data["optional"].unshift(optional)
            } else {
                for (let i = 0; i < data["optional"].length; i++) {
                    if (data["optional"][i]["num"] == targetNum) {
                        data["optional"].splice(i + 1, 0, optional)
                        break
                    }
                }
            }
        }
        set_data_num_index(content["body"], new Counter())
        tabContent.setContent(content)
    })()
}

const editor_composition_remove_item = (tabContent: TabContent, composition_num: number, index: number) => {
    const content = tabContent.values[tabContent.index].content
    const data = find_node_from_data(content, composition_num)
    data["optional"].splice(index, 1)
    set_data_num_index(content["body"], new Counter())
    tabContent.setContent(content)
}

const editor_composition_remove_last = (tabContent: TabContent, composition_num: number) => {
    const content = tabContent.values[tabContent.index].content
    const data = find_node_from_data(content, composition_num)
    delete data["last"]
    set_data_num_index(content["body"], new Counter())
    tabContent.setContent(content)
}

export const CodeEditorItem = ({
    data,
    parent_num,
    index,
    onNodeChoose,
}: {
    data: any
    parent_num: number
    index: number
    onNodeChoose: (num: number) => void
}) => {
    const tabContent = useContext(EditorContext)
    const project = useProject()
    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            { display: "删除", callback: () => editor_action_remove(tabContent, parent_num, index) },
        ])
    }
    const component = find_component(data["id"], project.getComponents())
    if (!component) return null
    if (component["type"] == "unit") {
        return (
            <Action
                data={data}
                component={component}
                num={data["num"]}
                index={index}
                draggable={true}
                onNodeChoose={onNodeChoose}
                onContextMenu={handleContextMenu}
            />
        )
    }
    if (component["type"] == "container") {
        return (
            <Container
                data={data}
                parent_num={parent_num}
                index={index}
                component={component}
                onNodeChoose={onNodeChoose}
            />
        )
    }
    return (
        <Composition
            data={data}
            parent_num={parent_num}
            index={index}
            component={component}
            onNodeChoose={onNodeChoose}
        />
    )
}

const Action = ({
    data,
    component,
    num,
    index,
    className,
    draggable,
    onNodeChoose,
    onContextMenu,
}: {
    data: any
    component: any
    num?: number
    index: number
    className?: string
    draggable?: boolean
    onNodeChoose?: (num: number) => void
    onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void
}) => {
    const variables = data["params"]
    const params: any = {}
    for (const i in component["params"]) {
        let value = ""
        const id = component["params"][i]["id"]
        const name = component["params"][i]["name"]
        if (variables && id in variables) value = variables[id]
        params[`{${id}}`] = { name, type: component["params"][i]["type"], value }
    }
    const description: React.JSX.Element[] = []
    if (component["format"]) {
        const key = new KeyGenerator()
        const format: string = component["format"]
        const matches = format.matchAll(/\{\w+\}/g)
        let last_index = 0
        for (const match of matches) {
            if (match.index != null && match.index > last_index) {
                description.push(<span key={key.next()}>{format.substring(last_index, match.index)}</span>)
            }
            if (match[0] in params) {
                description.push(content_node_creator(key, params[match[0]].type, params[match[0]].value))
            } else {
                description.push(<var key={key.next()}>{match[0]}</var>)
            }
            last_index = (match.index ?? 0) + match[0].length
        }
        if (last_index < format.length) {
            description.push(<span key={key.next()}>{format.substring(last_index)}</span>)
        }
    }
    let display = component.name
    if (data.display) display = data.display
    const handleClick = (event: React.MouseEvent) => {
        if (num != null && onNodeChoose) {
            setChosen(event.currentTarget as HTMLElement)
            onNodeChoose(num)
        }
    }
    let iconClassName = "icon-[bitcoin-icons--block-outline]"
    if (component["icon"] != null) iconClassName = `icon-[${component["icon"]}]`
    return (
        <article
            className={className}
            data-num={num}
            data-index={index}
            draggable={draggable}
            onClick={handleClick}
            onContextMenu={onContextMenu}
        >
            <ul>
                <li>
                    <aside />
                    <i className={iconClassName} />
                </li>
                <li>
                    <h4>{display}</h4>
                    {description.length > 0 && <p>{description}</p>}
                </li>
            </ul>
        </article>
    )
}

const Section = ({
    className,
    index,
    draggable,
    data,
    component,
    onNodeChoose,
    onContextMenu,
}: {
    className?: string
    index: number
    draggable?: boolean
    data: any
    component: any
    onNodeChoose: (num: number) => void
    onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void
}) => (
    <section data-index={index} className={className} draggable={draggable}>
        <Action
            data={data}
            component={component}
            className="label"
            index={index}
            num={data["num"]}
            onNodeChoose={onNodeChoose}
            onContextMenu={onContextMenu}
        />
        <samp data-num={data["num"]}>
            {data["body"].map((item: any, item_index: number) => (
                <CodeEditorItem
                    key={item_index}
                    data={item}
                    parent_num={data["num"]}
                    index={item_index}
                    onNodeChoose={onNodeChoose}
                />
            ))}
        </samp>
    </section>
)

const Footer = () => (
    <article className="label footer">
        <ul>
            <li>
                <aside />
                <i className="icon-[ion--md-return-left]" />
            </li>
            <li><h4>结束</h4></li>
        </ul>
    </article>
)

const Container = ({
    data,
    component,
    parent_num,
    index,
    onNodeChoose,
}: {
    data: any
    component: any
    parent_num: number
    index: number
    onNodeChoose: (num: number) => void
}) => {
    const tabContent = useContext(EditorContext)
    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            { display: "删除", callback: () => editor_action_remove(tabContent, parent_num, index) },
        ])
    }
    return (
        <hgroup className="container" data-num={data["last-num"]} data-index={data["index"]} draggable={true}>
            <Section
                className="header"
                data={data}
                index={data["index"]}
                component={component}
                onNodeChoose={onNodeChoose}
                onContextMenu={handleContextMenu}
            />
            <Footer />
        </hgroup>
    )
}

const Composition = ({
    data,
    component,
    parent_num,
    index,
    onNodeChoose,
}: {
    data: any
    component: any
    parent_num: number
    index: number
    onNodeChoose: (num: number) => void
}) => {
    const tabContent = useContext(EditorContext)
    const compositionNum = data["num"]
    const boundaries: React.JSX.Element[] = []
    let last: React.JSX.Element | null = null

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        const targetNum = Number(e.currentTarget.getAttribute("data-num"))
        const items: { display: string; callback?: () => void }[] = []
        for (const component_optional of component["optional"]) {
            if (last != null && component_optional["category"] == "Last") {
                items.push({ display: `添加 ${component_optional["name"]}` })
            } else {
                items.push({
                    display: `添加 ${component_optional["name"]}`,
                    callback: () =>
                        editor_composition_add_item(
                            tabContent,
                            component_optional["id"],
                            component_optional["category"],
                            compositionNum,
                            targetNum
                        ),
                })
            }
        }
        if (compositionNum == targetNum) {
            items.push({
                display: "删除",
                callback: () => editor_action_remove(tabContent, parent_num, index),
            })
        } else {
            const currentIndex = Number(e.currentTarget.getAttribute("data-index"))
            items.push({
                display: "删除",
                callback: () => editor_composition_remove_item(tabContent, compositionNum, currentIndex),
            })
        }
        showContextMenu(e, items)
    }

    const handleLastContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            {
                display: "删除",
                callback: () => editor_composition_remove_last(tabContent, compositionNum),
            },
        ])
    }

    const key = new KeyGenerator()
    let boundary_index = 0
    for (const optional of data["optional"]) {
        const component_optional = (component["optional"] as any[]).find((item: any) => item["id"] == optional["id"])
        boundaries.push(
            <Section
                key={key.next()}
                index={boundary_index++}
                data={optional}
                component={component_optional}
                draggable={true}
                onNodeChoose={onNodeChoose}
                onContextMenu={handleContextMenu}
            />
        )
    }
    if ("last" in data) {
        const component_optional = (component["optional"] as any[]).find(
            (item: any) => item["id"] == data["last"]["id"]
        )
        last = (
            <Section
                data={data["last"]}
                index={-1}
                component={component_optional}
                onNodeChoose={onNodeChoose}
                onContextMenu={handleLastContextMenu}
            />
        )
    }

    return (
        <hgroup className="composition" data-num={data["last-num"]} data-index={index} draggable={true}>
            <Section
                className="header"
                data={data}
                index={index}
                component={component}
                onNodeChoose={onNodeChoose}
                onContextMenu={handleContextMenu}
            />
            {boundaries.length > 0 && <nav data-num={data["num"]}>{boundaries}</nav>}
            {last}
            <Footer />
        </hgroup>
    )
}
