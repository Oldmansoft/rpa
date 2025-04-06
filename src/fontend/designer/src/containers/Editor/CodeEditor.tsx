import React, { useEffect, useRef, DragEvent } from "react"
import { project } from "../Project"
import { KeyGenerator, Counter } from "../../components/Utils"
import { TagName, CodeNodePosition, get_element_parents_from_tag, make_numbers, codeDrager, mouse_in_node_top, find_previous_tag } from "./Utils"

declare const window: {
    dragKey: string
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

function create_format_code_node(text: string) {
    if (text == '') {
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

function content_node_creator(key: KeyGenerator, type: string, text: string) {
    if (type == 'Variable') {
        text = text.trim()
        if (text == '') {
            return <var key={key.next()} className="error">[请填写]</var>
        } else {
            return <var key={key.next()}>{text}</var>
        }
    }
    if (type == 'Format') {
        return <code key={key.next()}>{create_format_code_node(text)}</code>
    }
    if (type == 'Expression') {
        text = text.trim()
        if (text == '') {
            return <var key={key.next()} className="error">[请填写]</var>
        } else {
            return <var key={key.next()}>{text}</var>
        }
    }
    throw new TypeError(type)
}

const find_component = (id: string, list: any): any => {
    for (const item of list) {
        if (item['category'] == 'item') {
            if (item['id'] == id) {
                return item
            }
        } else {
            return find_component(id, item['list'])
        }
    }
    return null
}

function find_component_optional(id: string, list: any) {
    for (const item of list) {
        if (item['id'] == id) {
            return item
        }
    }
}

const CodeEditorItem = ({ data }: { data: any }) => {
    const component = find_component(data["id"], project.getComponents())
    if (component['type'] == 'unit') {
        return (
            <Action data={data} component={component} num={data["num"]} index={data["index"]} draggable={true}></Action>
        )
    }
    if (component['type'] == 'container') {
        return (
            <Container data={data} component={component}></Container>
        )
    }
    return (
        <Composition data={data} component={component}></Composition>
    )
}

const Action = ({ data, component, num, index, className, draggable }: { data: any, component: any, num?: number, index?: number, className?: string, draggable?: boolean }) => {
    const variables = data["params"]
    const params: any = {}
    for (const i in component['params']) {
        let value = ''
        const id = component['params'][i]['id']
        const name = component['params'][i]['name']
        if (variables && id in variables) {
            value = variables[id]
        }
        params['{' + id + '}'] = {
            name: name,
            type: component['params'][i]['type'],
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
    return (
        <article className={className} data-num={num} data-index={index} draggable={draggable}>
            <ul>
                <li>
                    <aside></aside>
                    <i className="icon-[ion--compose]"></i>
                </li>
                <li>
                    <h4>{component.name}</h4>
                    {description && <p>{description}</p>}
                </li>
            </ul>
        </article>
    )
}

const Section = ({ className, draggable, data, component }: { className?: string, draggable?: boolean, data: any, component: any }) => {
    return (
        <section className={className} draggable={draggable}>
            <Action data={data} component={component} className="label"></Action>
            <main data-num={data["num"]}>
                {data["body"].map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} key={index}></CodeEditorItem>
                    )
                )}
            </main>
        </section>
    )
}

const Footer = () => {
    return (
        <article className="label footer">
            <ul>
                <li><aside></aside><i className="icon-[ion--compose]"></i></li>
                <li><h4>结束</h4></li>
            </ul>
        </article>
    )
}

const Container = ({ data, component }: { data: any, component: any }) => {
    return (
        <hgroup className="container" data-num={data["last-num"]} data-index={data["index"]} draggable={true}>
            <Section className="header" data={data} component={component}></Section>
            <Footer></Footer>
        </hgroup>
    )
}

const Composition = ({ data, component }: { data: any, component: any }) => {
    const boundaries: React.JSX.Element[] = []
    let last: React.JSX.Element | null = null
    const key = new KeyGenerator()
    for (const optional of data["optional"]) {
        const component_optional = find_component_optional(optional['id'], component['optional'])
        if (component_optional['category'] == 'Boundary') {
            boundaries.push(<Section key={key.next()} data={optional} component={component_optional} draggable={true}></Section>)
        } else {
            last = <Section data={optional} component={component_optional}></Section>
        }
    }
    return (
        <hgroup className="container" data-num={data["last-num"]} data-index={data["index"]} draggable={true}>
            <Section className="header" data={data} component={component}></Section>
            {boundaries && <nav>{boundaries}</nav>}
            {last}
            <Footer></Footer>
        </hgroup>
    )
}

export const find_parent_from_datas = (datas: any[], findNum: Number): any[] | null => {
    for (const data of datas) {
        if ("body" in data) {

            if (data["num"] == findNum) {
                return data["body"]
            }
            const result = find_parent_from_datas(data["body"], findNum)
            if (result != null) {
                return result
            }
        }
        if ("optional" in data) {
            for (const optional of data["optional"]) {
                if (optional["num"] == findNum) {
                    return optional["body"]
                }
                const result = find_parent_from_datas(optional["body"], findNum)
                if (result != null) {
                    return result
                }
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
                set_data_num_index(optional["body"], counter)
            }
        }
        if ("body" in data || "optional" in data) {
            data["last-num"] = counter.next()
        }
    }
}

const CodeEditor = ({ content, onNodeMove }: { content: any, onNodeMove: (source: CodeNodePosition, target: CodeNodePosition) => void }) => {
    const codeRef = useRef<HTMLElement>(null)
    const lineRef = useRef<HTMLElement>(null)

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
        
        const currentTarget = get_element_parents_from_tag(e.target as HTMLElement, TagName.article)
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
                const mainNode = find_previous_tag(currentTarget, TagName.main)
                if (mainNode!.children.length == 0 || mainNode!.lastElementChild != lineRef.current) {
                    mainNode!.append(lineRef.current)
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
                const mainNode = currentTarget.nextElementSibling as HTMLElement
                if (mainNode.children.length == 0 || mainNode.firstElementChild != lineRef.current) {
                    mainNode.prepend(lineRef.current)
                }
            }
        } else if (is_boundary_article(currentTarget) || is_last_section_article(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const mainNode = find_previous_tag(currentTarget, TagName.main)
                if (mainNode!.children.length == 0 || mainNode!.lastElementChild != lineRef.current) {
                    mainNode!.append(lineRef.current)
                }
            } else {
                const mainNode = currentTarget.nextElementSibling as HTMLElement
                if (mainNode.children.length == 0 || mainNode.firstElementChild != lineRef.current) {
                    mainNode.prepend(lineRef.current)
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

    return (
        <>
            <kbd><h5>输入参数设置</h5></kbd>
            <var>
                <h5>流程变量设置</h5>
                {Object.keys(content.local).map(
                    (key) => (
                        <label key={key}>{key}</label>
                    )
                )}
            </var>
            <code ref={codeRef} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragStart={handleDragStart} onDragEnd={handleDragEnd} data-num="0">
                {content["body"].map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} key={index}></CodeEditorItem>
                    )
                )}
            </code>
            <small ref={lineRef} onDragOver={(e: DragEvent) => { e.preventDefault() }} onDragEnter={handleLineDragEnter} onDragLeave={handleLineDragLeave}><div></div></small>
            <samp><h5>输出参数设置</h5></samp>
        </>
    )
}

export default CodeEditor