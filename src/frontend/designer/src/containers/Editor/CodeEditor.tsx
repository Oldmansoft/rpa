import React, { useEffect, useRef, DragEvent, useContext } from "react"
import { project } from "../Project"
import { KeyGenerator, Counter } from "../../components/Utils"
import { CodeChooseCategory } from "./Utils"
import { TagName, CodeNodePosition, make_numbers, codeDrager, mouse_in_node_top, find_previous_tag } from "./Utils"
import { IconButton } from "../../components/Button"
import { showContextMenu } from "../../components/ContextMenu"
import { EditorContext, TabContent } from "../EditorContext"
import { communication } from "../../components/Communication"

declare const window: {
    dragKey: string,
    communication: any,
} & Window

const is_item_article = (node: HTMLElement) => {
    return !node.classList.contains("label")
}

const is_footer_article = (node: HTMLElement) => {
    return node.classList.contains("footer")
}

const is_header_article = (node: HTMLElement) => {
    const parentNode = node.parentElement as HTMLElement
    return parentNode.tagName == TagName.section && parentNode.classList.contains("header")
}

const is_boundary_article = (node: HTMLElement) => {
    return (node.parentNode!.parentNode as HTMLElement).tagName == TagName.nav
}

const is_last_section_article = (node: HTMLElement) => {
    const parentNode = node.parentElement as HTMLElement
    return parentNode.tagName == TagName.section && !parentNode.classList.contains("header")
}

const setChosen = (node: HTMLElement) => {
    const nodes = document.querySelectorAll('code .chosen')
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove("chosen")
    }
    if (node != null) {
        node.classList.add("chosen")
    }
}

function create_format_code_node(text: string) {
    if (text == "") {
        return <var>[空字符串]</var>
    }

    const key = new KeyGenerator()
    const result: React.JSX.Element[] = []
    const matches = text.matchAll(/(\{.*?\})|\\n/g)
    let last_index = 0
    for (const match of matches) {
        if (match.index > last_index) {
            result.push(<span key={key.next()}>{text.substring(last_index, match.index)}</span>)
        }
        result.push(<var key={key.next()}>{match[0]}</var>)
        last_index = match.index + match[0].length
    }
    if (last_index < text.length) {
        result.push(<span key={key.next()}>{text.substring(last_index)}</span>)
    }
    return result
}

function content_node_creator(key: KeyGenerator, typeValue: string, text: string) {
    if (typeValue == "Variable") {
        text = text.trim()
        if (text == "") {
            return <var key={key.next()} className="error">[请填写]</var>
        } else {
            return <var key={key.next()}>{text}</var>
        }
    }
    if (typeValue == "Format") {
        return <mark key={key.next()}>{create_format_code_node(text)}</mark>
    }
    if (typeValue == "Expression") {
        text = text.trim()
        if (text == "") {
            return <var key={key.next()} className="error">[请填写]</var>
        } else {
            return <var key={key.next()}>{text}</var>
        }
    }
    throw new TypeError(typeValue)
}

export const find_component = (id: string, list: any): any => {
    for (const item of list) {
        if (item["category"] == "item") {
            if (item["id"] == id) {
                return item
            }
        } else {
            return find_component(id, item["list"])
        }
    }
    return null
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

const editor_composition_add_item = (tabContent: TabContent, component_optional_id: string, component_category: string, composition_num: number, targetNum: number) => {
    const content = tabContent.values[tabContent.index].content

    const data = find_node_from_data(content, composition_num);
    (async () => {
        const optional = await communication.Executor.Designer.GetComponentOptional(data["id"], component_optional_id)
        if (component_category == "Last") {
            data["last"] = optional
        } else {
            if (composition_num == targetNum) {
                data["optional"].unshift(optional)
            } else {
                for (var i = 0; i < data["optional"].length; i++) {
                    if (data["optional"][i]["num"] == targetNum) {
                        data["optional"].splice(i + 1, 0, optional)
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

const CodeEditorItem = ({ data, parent_num, index, onNodeChoose }: { data: any, parent_num: number, index: number, onNodeChoose: (num: number) => void }) => {
    const tabContent = useContext(EditorContext)
    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            {
                display: "删除",
                callback: () => {
                    editor_action_remove(tabContent, parent_num, index)
                },
            }
        ])
    }

    const component = find_component(data["id"], project.getComponents())
    if (component["type"] == "unit") {
        return (
            <Action data={data} component={component} num={data["num"]} index={index} draggable={true} onNodeChoose={onNodeChoose} onContextMenu={handleContextMenu}></Action>
        )
    }
    if (component["type"] == "container") {
        return (
            <Container data={data} parent_num={parent_num} index={index} component={component} onNodeChoose={onNodeChoose}></Container>
        )
    }
    return (
        <Composition data={data} parent_num={parent_num} index={index} component={component} onNodeChoose={onNodeChoose}></Composition>
    )
}

const Action = ({ data, component, num, index, className, draggable, onNodeChoose, onContextMenu }: {
    data: any, component: any, num?: number, index: number, className?: string, draggable?: boolean,
    onNodeChoose?: (num: number) => void,
    onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void
}) => {
    const variables = data["params"]
    const params: any = {}
    for (const i in component["params"]) {
        let value = ""
        const id = component["params"][i]["id"]
        const name = component["params"][i]["name"]
        if (variables && id in variables) {
            value = variables[id]
        }

        params[`{${id}}`] = {
            name: name,
            type: component["params"][i]["type"],
            value: value
        }
    }

    const description: React.JSX.Element[] = []
    if (component["format"]) {
        const key = new KeyGenerator()
        const format: string = component["format"]
        const matches = format.matchAll(/\{\w+\}/g)
        let last_index = 0
        for (const match of matches) {
            if (match.index > last_index) {
                description.push(<span key={key.next()}>{format.substring(last_index, match.index)}</span>)
            }
            if (match[0] in params) {
                description.push(content_node_creator(key, params[match[0]].type, params[match[0]].value))
            } else {
                description.push(<var key={key.next()}>{match[0]}</var>)
            }
            last_index = match.index + match[0].length
        }
        if (last_index < format.length) {
            description.push(<span key={key.next()}>{format.substring(last_index)}</span>)
        }
    }

    let display = component.name
    if (data.display) {
        display = data.display
    }
    const handleClick = (event: React.MouseEvent) => {
        if (num != null && onNodeChoose) {
            const node = (event.currentTarget as HTMLElement)
            setChosen(node)
            onNodeChoose(num)
        }
    }
    let iconClassName = "icon-[bitcoin-icons--block-outline]"
    if (component["icon"] != null) {
        iconClassName = `icon-[${component["icon"]}]`
    }

    return (
        <article className={className} data-num={num} data-index={index} draggable={draggable} onClick={handleClick} onContextMenu={onContextMenu}>
            <ul>
                <li>
                    <aside></aside>
                    <i className={iconClassName}></i>
                </li>
                <li>
                    <h4>{display}</h4>
                    {description && <p>{description}</p>}
                </li>
            </ul>
        </article>
    )
}

const Section = ({ className, index, draggable, data, component, onNodeChoose, onContextMenu }: {
    className?: string, index: number, draggable?: boolean, data: any, component: any,
    onNodeChoose: (num: number) => void,
    onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void
}) => {
    return (
        <section data-index={index} className={className} draggable={draggable}>
            <Action data={data} component={component} className="label" index={index} num={data["num"]} onNodeChoose={onNodeChoose} onContextMenu={onContextMenu}></Action>
            <samp data-num={data["num"]}>
                {data["body"].map(
                    (item: any, item_index: number) => (
                        <CodeEditorItem data={item} parent_num={data["num"]} key={item_index} index={item_index} onNodeChoose={onNodeChoose}></CodeEditorItem>
                    )
                )}
            </samp>
        </section>
    )
}

const Footer = () => {
    return (
        <article className="label footer">
            <ul>
                <li><aside></aside><i className="icon-[ion--md-return-left]"></i></li>
                <li><h4>结束</h4></li>
            </ul>
        </article>
    )
}

const Container = ({ data, component, parent_num, index, onNodeChoose }: {
    data: any, component: any, parent_num: number, index: number, onNodeChoose: (num: number) => void
}) => {
    const tabContent = useContext(EditorContext)
    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            {
                display: "删除",
                callback: () => {
                    editor_action_remove(tabContent, parent_num, index)
                },
            }
        ])
    }

    return (
        <hgroup className="container" data-num={data["last-num"]} data-index={data["index"]} draggable={true}>
            <Section className="header" data={data} index={data["index"]} component={component} onNodeChoose={onNodeChoose} onContextMenu={handleContextMenu}></Section>
            <Footer></Footer>
        </hgroup>
    )
}

const Composition = ({ data, component, parent_num, index, onNodeChoose }: {
    data: any, component: any, parent_num: number, index: number, onNodeChoose: (num: number) => void
}) => {
    const tabContent = useContext(EditorContext)
    const compositionNum = data["num"]
    const boundaries: React.JSX.Element[] = []
    let last: React.JSX.Element | null = null

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        const targetNum = Number(e.currentTarget.getAttribute("data-num"))
        const items = []
        for (const component_optional of component["optional"]) {
            if (last && component_optional["category"] == "Last") {
                items.push({ display: `添加 ${component_optional["name"]}` })
            } else {
                items.push({
                    display: `添加 ${component_optional["name"]}`,
                    callback: () => {
                        editor_composition_add_item(tabContent, component_optional["id"], component_optional["category"], compositionNum, targetNum)
                    }
                })
            }
        }
        if (compositionNum == targetNum) {
            items.push({
                display: "删除",
                callback: () => {
                    editor_action_remove(tabContent, parent_num, index)
                }
            })
        } else {
            const currentIndex = Number(e.currentTarget.getAttribute("data-index"))
            items.push({
                display: "删除",
                callback: () => {
                    editor_composition_remove_item(tabContent, compositionNum, currentIndex)
                }
            })
        }

        showContextMenu(e, items)
    }

    const handleLastContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        showContextMenu(e, [
            {
                display: "删除",
                callback: () => {
                    editor_composition_remove_last(tabContent, compositionNum)
                },
            }
        ])
    }

    const key = new KeyGenerator()
    let boundary_index = 0
    for (const optional of data["optional"]) {
        const component_optional = (component["optional"] as any[]).find(item => item["id"] == optional["id"])
        boundaries.push(<Section key={key.next()} index={boundary_index++} data={optional} component={component_optional} draggable={true} onNodeChoose={onNodeChoose} onContextMenu={handleContextMenu}></Section>)
    }
    if ("last" in data) {
        const component_optional = (component["optional"] as any[]).find(item => item["id"] == data["last"]["id"])
        last = <Section data={data["last"]} index={-1} component={component_optional} onNodeChoose={onNodeChoose} onContextMenu={handleLastContextMenu}></Section>
    }

    return (
        <hgroup className="composition" data-num={data["last-num"]} data-index={index} draggable={true}>
            <Section className="header" data={data} index={index} component={component} onNodeChoose={onNodeChoose} onContextMenu={handleContextMenu}></Section>
            {boundaries && <nav data-num={data["num"]}>{boundaries}</nav>}
            {last}
            <Footer></Footer>
        </hgroup>
    )
}

export const find_node_from_data = (data: any, findNum: Number): any | null => {
    for (const children of data["body"]) {
        if (children["num"] == findNum) {
            return children
        }
        if ("body" in children) {
            const result = find_node_from_data(children, findNum)
            if (result != null) {
                return result
            }
        }
        if ("optional" in children) {
            for (const optional of children["optional"]) {
                if (optional["num"] == findNum) {
                    return optional
                }
                const result = find_node_from_data(optional, findNum)
                if (result != null) {
                    return result
                }
            }
        }
        if ("last" in children) {
            if (children["last"]["num"] == findNum) {
                return children["last"]
            }
            const result = find_node_from_data(children["last"], findNum)
            if (result != null) {
                return result
            }
        }
    }
    return null
}

export const set_data_num_index = (datas: any[], counter: Counter) => {
    let index = 0
    for (const data of datas) {
        data["num"] = counter.next()
        data["index"] = index++
        if ("body" in data) {
            set_data_num_index(data["body"], counter)
        }
        if ("optional" in data) {
            for (const optional of data["optional"]) {
                optional["num"] = counter.next()
                optional["parent-id"] = data["id"]
                set_data_num_index(optional["body"], counter)
            }
        }
        if ("last" in data) {
            const last = data["last"]
            last["num"] = counter.next()
            last["parent-id"] = data["id"]
            set_data_num_index(last["body"], counter)
        }
        if ("body" in data || "optional" in data) {
            data["last-num"] = counter.next()
        }
    }
}

const CodeEditor = ({ content, onNodeMove, onPropertiesPaneOpen }: {
    content: any,
    onNodeMove: (source: CodeNodePosition, target: CodeNodePosition) => void,
    onPropertiesPaneOpen: (category: CodeChooseCategory, data: any) => void
}) => {
    const tabContent = useContext(EditorContext)
    const codeRef = useRef<HTMLElement>(null)
    const lineRef = useRef<HTMLElement>(null)

    let section_drag_source: HTMLElement | null = null
    let enterCount = 0

    useEffect(() => {
        (async () => {
            codeDrager.setDropLine(lineRef.current)
            if (codeRef.current) {
                make_numbers(codeRef.current)
                codeDrager.init(codeRef.current)
            }
        })()
    }, [content])

    if (!content) {
        return
    }

    const handleDragEnter = (e: DragEvent) => {
        if ((e.target as HTMLElement).tagName == TagName.aside) {
            return
        }
        enterCount++
        if (window.dragKey != "editor") {
            return
        }
        e.preventDefault()
    }

    const handleDragLeave = (e: DragEvent) => {
        if ((e.target as HTMLElement).tagName == TagName.aside) {
            return
        }
        if (--enterCount == 0) {
            codeDrager.resetDropLine()
        }
    }

    const handleDragOver = (e: DragEvent) => {
        if (window.dragKey != "editor" || !lineRef.current) {
            return
        }
        if ((e.target as HTMLElement).tagName == TagName.aside) {
            return
        }
        e.preventDefault()

        const currentTarget = (e.target as HTMLElement).closest("article")
        if (currentTarget == null) {
            return
        }
        if (!codeDrager.can_working(e, currentTarget, lineRef.current)) {
            return
        }


        if (is_item_article(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const previous = currentTarget.previousElementSibling
                if (previous == null || previous != lineRef.current) {
                    currentTarget.before(lineRef.current)
                }
            } else {
                const next = currentTarget.nextElementSibling
                if (next == null || next != lineRef.current) {
                    currentTarget.after(lineRef.current)
                }
            }
        } else if (is_footer_article(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const sampNode = find_previous_tag(currentTarget, TagName.samp)
                if (sampNode!.children.length == 0 || sampNode!.lastElementChild != lineRef.current) {
                    sampNode!.append(lineRef.current)
                }
            } else {
                const next = (currentTarget.parentNode as HTMLElement).nextElementSibling
                if (next == null || next != lineRef.current) {
                    (currentTarget.parentNode as HTMLElement).after(lineRef.current)
                }
            }
        } else if (is_header_article(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const containerNode = currentTarget.parentNode!.parentNode as HTMLElement
                const previous = containerNode.previousElementSibling
                if (previous == null || previous != lineRef.current) {
                    containerNode.before(lineRef.current)
                }
            } else {
                const sampNode = currentTarget.nextElementSibling as HTMLElement
                if (sampNode.children.length == 0 || sampNode.firstElementChild != lineRef.current) {
                    sampNode.prepend(lineRef.current)
                }
            }
        } else if (is_boundary_article(currentTarget) || is_last_section_article(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const sampNode = find_previous_tag(currentTarget, TagName.samp)
                if (sampNode!.children.length == 0 || sampNode!.lastElementChild != lineRef.current) {
                    sampNode!.append(lineRef.current)
                }
            } else {
                const sampNode = currentTarget.nextElementSibling as HTMLElement
                if (sampNode.children.length == 0 || sampNode.firstElementChild != lineRef.current) {
                    sampNode.prepend(lineRef.current)
                }
            }
        }
    }

    const handleDragStart = (e: DragEvent) => {
        window.dragKey = "editor"
        e.dataTransfer.effectAllowed = "move"
        const targetNode = e.target as HTMLElement
        const tagName = targetNode.tagName
        if ([TagName.article, TagName.hgroup].includes(tagName)) {
            codeDrager.start(targetNode)
        } else if (tagName == TagName.section) {
            codeDrager.start_boundary(targetNode)
        }
    }

    const handleDragEnd = () => {
        const position = codeDrager.finish()
        if (position != null) {
            onNodeMove(position.source!, position.target)
        }
    }

    const handleLineDragEnter = (e: DragEvent) => {
        enterCount++
        e.preventDefault()
    }

    const handleLineDragLeave = () => {
        --enterCount
    }

    const handleNodeChoose = (num: number) => {
        const data = find_node_from_data(content, num)
        onPropertiesPaneOpen(CodeChooseCategory.Body, data)
    }

    const handleVariableChoose = (index: number, event: React.MouseEvent) => {
        setChosen(event.currentTarget as HTMLElement)
        const data = {
            ...content.local[index],
            index: index
        }
        onPropertiesPaneOpen(CodeChooseCategory.Variable, data)
    }

    const handleParameterInChoose = (index: number, event: React.MouseEvent) => {
        setChosen(event.currentTarget as HTMLElement)
        const data = {
            ...content.parameter.in[index],
            index: index
        }
        onPropertiesPaneOpen(CodeChooseCategory.ParameterIn, data)
    }

    const handleParameterOutChoose = (index: number, event: React.MouseEvent) => {
        setChosen(event.currentTarget as HTMLElement)
        const data = {
            ...content.parameter.out[index],
            index: index
        }
        onPropertiesPaneOpen(CodeChooseCategory.ParameterOut, data)
    }

    const handleSectionDragStart = (e: DragEvent) => {
        window.dragKey = e.currentTarget.getAttribute("data-drag-key")!
        e.dataTransfer.effectAllowed = "move"
        section_drag_source = e.target as HTMLElement
    }

    const handleSectionDragEnd = (e: DragEvent) => {
        const sourceIndex = Number(section_drag_source!.getAttribute("data-index"))
        section_drag_source = null

        const sectionRect = e.currentTarget.getBoundingClientRect()
        if (e.clientX > sectionRect.left && e.clientX < sectionRect.right && e.clientY > sectionRect.top && e.clientY < sectionRect.bottom) {
            let position = 0
            for (var i = 0; i < e.currentTarget.children.length; i++) {
                if (i <= sourceIndex) {
                    position = i
                }
                const nodeRect = e.currentTarget.children[i].getBoundingClientRect()
                if (e.clientX < nodeRect.left + (nodeRect.width / 2) && e.clientY < nodeRect.bottom || e.clientY < nodeRect.top) {
                    break
                }
                if (i > sourceIndex) {
                    position = i
                }
            }

            if (sourceIndex != position) {
                moveVarItem(sourceIndex, position)
            }
        }
    }

    const moveVarItem = (sourceIndex: number, targetIndex: number) => {
        const category = getCodeChooseCategoryFromText(window.dragKey)
        let list
        if (category == CodeChooseCategory.Variable) {
            list = content["local"]
        } else if (category == CodeChooseCategory.ParameterIn) {
            list = content["parameter"]["in"]
        } else {
            list = content["parameter"]["out"]
        }

        const element = list.splice(sourceIndex, 1)[0]
        list.splice(targetIndex, 0, element)
        tabContent.setContent(content)
    }

    const handleSectionDragOver = (e: DragEvent) => {
        if (e.currentTarget.getAttribute("data-drag-key") == window.dragKey) {
            e.preventDefault()
        }
    }

    const getCodeChooseCategoryFromText = (text: string) => {
        if (text == "variable") {
            return CodeChooseCategory.Variable
        } else if (text == "parameter-in") {
            return CodeChooseCategory.ParameterIn
        } else {
            return CodeChooseCategory.ParameterOut
        }
    }

    const handleSectionVarContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        const category = getCodeChooseCategoryFromText(e.currentTarget.parentElement?.getAttribute("data-drag-key")!)
        const index = Number(e.currentTarget.getAttribute("data-index"))
        const items = [
            {
                display: "删除",
                callback: () => {
                    if (category == CodeChooseCategory.Variable) {
                        content.local.splice(index, 1)
                    } else if (category == CodeChooseCategory.ParameterIn) {
                        content.parameter.in.splice(index, 1)
                    } else {
                        content.parameter.out.splice(index, 1)
                    }
                    tabContent.setContent(content)
                },
            }
        ]
        const texts: string[] = []
        const targetCategories: CodeChooseCategory[] = []
        if (category == CodeChooseCategory.ParameterIn) {
            texts.push("变量")
            texts.push("出参")
            targetCategories.push(CodeChooseCategory.Variable)
            targetCategories.push(CodeChooseCategory.ParameterOut)
        } else if (category == CodeChooseCategory.ParameterOut) {
            texts.push("入参")
            texts.push("变量")
            targetCategories.push(CodeChooseCategory.ParameterIn)
            targetCategories.push(CodeChooseCategory.Variable)
        } else {
            texts.push("入参")
            texts.push("出参")
            targetCategories.push(CodeChooseCategory.ParameterIn)
            targetCategories.push(CodeChooseCategory.ParameterOut)
        }
        for (var i = 0; i < 2; i++) {
            items.push({
                display: `移动到${texts[i]}`,
                callback: ((targetCategory: CodeChooseCategory) => {
                    return () => {
                        let removed
                        if (category == CodeChooseCategory.Variable) {
                            removed = content.local.splice(index, 1)
                        } else if (category == CodeChooseCategory.ParameterIn) {
                            removed = content.parameter.in.splice(index, 1)
                        } else {
                            removed = content.parameter.out.splice(index, 1)
                        }
                        if (targetCategory == CodeChooseCategory.Variable) {
                            content.local.push(removed[0])
                        } else if (targetCategory == CodeChooseCategory.ParameterIn) {
                            content.parameter.in.push(removed[0])
                        } else {
                            content.parameter.out.push(removed[0])
                        }
                        tabContent.setContent(content)
                    }
                })(targetCategories[i]),
            })
        }

        showContextMenu(e, items)
    }

    const handleVarAdd = (category: CodeChooseCategory) => {
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
        tabContent.setContent(content)
    }

    return (
        <code>
            <div>
                <h5>
                    <span>输入参数设置</span>
                    <IconButton onClick={() => { handleVarAdd(CodeChooseCategory.ParameterIn) }} className="icon-[mdi--plus] align-middle"></IconButton>
                </h5>
                <section data-drag-key="parameter-in" onDragStart={handleSectionDragStart} onDragOver={handleSectionDragOver} onDragEnd={handleSectionDragEnd}>
                    {content.parameter.in.map(
                        (item: any, index: number) => (
                            <var key={index} data-index={index} onClick={(event) => handleParameterInChoose(index, event)} draggable="true" onContextMenu={handleSectionVarContextMenu}>
                                {item["name"] == "" ? <dfn className="error">[请填写]</dfn> : <dfn>{item["name"]}</dfn>}
                            </var>)
                    )}
                </section>
            </div>
            <div>
                <h5>
                    <span>流程变量设置</span>
                    <IconButton onClick={() => { handleVarAdd(CodeChooseCategory.Variable) }} className="icon-[mdi--plus] align-middle"></IconButton>
                </h5>
                <section data-drag-key="variable" onDragStart={handleSectionDragStart} onDragOver={handleSectionDragOver} onDragEnd={handleSectionDragEnd}>
                    {content.local.map(
                        (item: any, index: number) => (
                            <var key={index} data-index={index} onClick={(event) => handleVariableChoose(index, event)} draggable="true" onContextMenu={handleSectionVarContextMenu}>
                                {item["name"] == "" ? <dfn className="error">[请填写]</dfn> : <dfn>{item["name"]}</dfn>}
                            </var>)
                    )}
                </section>
            </div>
            <main ref={codeRef} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragStart={handleDragStart} onDragEnd={handleDragEnd} data-num="0">
                {content.body.map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} parent_num={0} key={index} index={index} onNodeChoose={handleNodeChoose}></CodeEditorItem>
                    )
                )}
            </main>
            <small ref={lineRef} onDragOver={(e: DragEvent) => { e.preventDefault() }} onDragEnter={handleLineDragEnter} onDragLeave={handleLineDragLeave}><div></div></small>
            <div>
                <h5>
                    <span>输出参数设置</span>
                    <IconButton onClick={() => { handleVarAdd(CodeChooseCategory.ParameterOut) }} className="icon-[mdi--plus] align-middle"></IconButton>
                </h5>
                <section data-drag-key="parameter-out" onDragStart={handleSectionDragStart} onDragOver={handleSectionDragOver} onDragEnd={handleSectionDragEnd}>
                    {content.parameter.out.map(
                        (item: any, index: number) => (
                            <var key={index} data-index={index} onClick={(event) => handleParameterOutChoose(index, event)} draggable="true" onContextMenu={handleSectionVarContextMenu}>
                                {item["name"] == "" ? <dfn className="error">[请填写]</dfn> : <dfn>{item["name"]}</dfn>}
                            </var>
                        )
                    )}
                </section>
            </div>
        </code>
    )
}

export default CodeEditor