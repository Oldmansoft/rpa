import React, { useEffect, useState, useRef, DragEvent } from "react"
import { communication } from "../../components/Communication"
import { project } from "../Project"
import { KeyGenerator } from "../../components/Utils"
import { TagName, get_element_parents_from_tag, make_numbers, codeDrager, mouse_in_node_top, find_previous_tag } from "./Utils"

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
    var last_index = 0
    var matches = text.matchAll(/(\{.*?\})|\\n/g)
    for (var match of matches) {
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

function find_component(id: string, list: any) {
    for (var item of list) {
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
    for (var item of list) {
        if (item['id'] == id) {
            return item
        }
    }
}

const CodeEditorItem = ({ data }: { data: any }) => {
    const component = find_component(data["id"], project.getComponents())
    if (component['type'] == 'unit') {
        return (
            <Action data={data} component={component}></Action>
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

const Action = ({ data, component, className }: { data: any, component: any, className?: string }) => {
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
        <article className={className}>
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

const Section = ({ className, data, component }: { className?: string, data: any, component: any }) => {
    return (
        <section className={className}>
            <Action data={data} component={component} className="label"></Action>
            <main>
                {data["body"].map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} key={index}></CodeEditorItem>
                    )
                )}
            </main>
        </section>
    )
}

const Container = ({ data, component }: { data: any, component: any }) => {
    return (
        <hgroup className="container">
            <Section className="header" data={data} component={component}></Section>
            <article className="label footer">
                <ul>
                    <li><aside></aside><i className="icon-[ion--compose]"></i></li>
                    <li><h4>结束</h4></li>
                </ul>
            </article>
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
            boundaries.push(<Section key={key.next()} data={optional} component={component_optional}></Section>)
        } else {
            last = <Section data={optional} component={component_optional}></Section>
        }
    }
    return (
        <hgroup className="container">
            <Section className="header" data={data} component={component}></Section>
            {boundaries && <nav>{boundaries}</nav>}
            {last}
            <article className="label footer">
                <ul>
                    <li><aside></aside><i className="icon-[ion--compose]"></i></li>
                    <li><h4>结束</h4></li>
                </ul>
            </article>
        </hgroup>
    )
}

const CodeEditor = ({ file }: { file: string }) => {
    const [content, setContent] = useState<any>(null)
    const codeRef = useRef<HTMLElement>(null)
    const lineRef = useRef<HTMLElement>(null)

    useEffect(() => {
        (async () => {
            const fileContent = await communication.Executor.Designer.GetProjectJsonContent(project.getAppPath(), file)
            setContent(fileContent)
            codeDrager.setDropLine(lineRef.current)
            if (codeRef.current) {
                make_numbers(codeRef.current)
                codeDrager.init(codeRef.current)
            }
        })()
    }, [file])

    if (!content) {
        return
    }

    const handleDragEnter = (e: DragEvent) => {
        if (window.dragKey != "editor") {
            return
        }
        e.preventDefault()
    }

    const handleDragOver = (e: DragEvent) => {
        if (window.dragKey != "editor" || !lineRef.current) {
            return
        }
        e.preventDefault()

        const currentTarget = get_element_parents_from_tag(e.target as HTMLElement, TagName.article);
        if (currentTarget == null) {
            return
        }
        if (!codeDrager.can_working(e, currentTarget, lineRef.current)) return

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
            <code ref={codeRef} onDragOver={handleDragOver} onDragEnter={handleDragEnter}>
                {content["body"].map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} key={index}></CodeEditorItem>
                    )
                )}
            </code>
            <small ref={lineRef} onDragOver={(e: DragEvent) => { e.preventDefault() }} onDragEnter={(e: DragEvent) => { e.preventDefault() }}><div></div></small>
            <samp><h5>输出参数设置</h5></samp>
        </>
    )
}

export default CodeEditor