import React, { useEffect, useState, useRef } from "react"
import { communication } from "../../components/Communication"
import { project } from "../Project"
import { KeyGenerator } from "../../components/Utils"

declare const window: {
    dragKey: string
} & Window

function get_first_article_node(codeNode: HTMLElement) {
    const nodes = codeNode.children;
    if (!nodes || nodes.length == 0) {
        return null;
    }
    let first_node = nodes[0] as HTMLElement;
    while (first_node.tagName != "ARTICLE") {
        if (first_node.children.length == 0) {
            first_node = first_node.nextElementSibling as HTMLElement;
            if (first_node == null) {
                break;
            }
        } else {
            first_node = first_node.children[0] as HTMLElement
        }
    }
    return first_node;
}

function find_next_tag(node: HTMLElement, tag_name: string) {
    var next_node = node.nextElementSibling as HTMLElement;
    while (next_node == null || next_node.tagName != tag_name) {
        while (next_node == null) {
            node = node.parentNode as HTMLElement;
            if (node.tagName == "CODE") {
                return null;
            }
            next_node = node.nextElementSibling as HTMLElement;
        }
        while (next_node.tagName != tag_name) {
            if (next_node.children.length == 0) {
                next_node = next_node.nextElementSibling as HTMLElement;
                if (next_node == null) {
                    break;
                }
            } else {
                next_node = next_node.children[0] as HTMLElement
            }
        }
    }
    return next_node;
}

function set_node_number(node: HTMLElement, number: number) {
    const aside = node.querySelector('aside')
    if (aside) {
        aside.textContent = number.toString();
    }
}

function get_current_aside_node(target: HTMLElement) {
    if (target.tagName == "SECTION") {
        return target.children[0] as HTMLElement;
    }
    return target;
}

function make_numbers(codeNode: HTMLElement) {
    const firstNode = get_first_article_node(codeNode);
    if (firstNode == null) {
        return;
    }
    set_node_number(firstNode, 1)

    let number = 1;
    let node = find_next_tag(firstNode, "ARTICLE");
    while (node != null) {
        node = get_current_aside_node(node);
        number++;
        set_node_number(node, number);
        node = find_next_tag(node, "ARTICLE");
    }
    codeNode.style.setProperty('--AsideLeft', '-' + (number.toString().length * 8 + 7) + 'px');
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

const Action = ({ data, component }: { data: any, component: any }) => {
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
        <article>
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
            <Action data={data} component={component}></Action>
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
            <article>
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
    let footer: React.JSX.Element | null = null
    const key = new KeyGenerator()
    for (const optional of data["optional"]) {
        const component_optional = find_component_optional(optional['id'], component['optional'])
        if (component_optional['category'] == 'Boundary') {
            boundaries.push(<Section key={key.next()} data={optional} component={component_optional}></Section>)
        } else {
            footer = <Section data={optional} component={component_optional}></Section>
        }
    }
    return (
        <hgroup className="container">
            <Section className="header" data={data} component={component}></Section>
            {boundaries && <nav>{boundaries}</nav>}
            {footer}
            <article>
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
    const varRef = useRef<HTMLElement>(null)

    useEffect(() => {
        (async () => {
            const fileContent = await communication.Executor.Designer.GetProjectJsonContent(project.getAppPath(), file)
            setContent(fileContent)
            if (varRef.current) {
                make_numbers(varRef.current)
            }
        })()
    }, [file])

    if (!content) {
        return
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
            <code ref={varRef}>
                {content["body"].map(
                    (item: any, index: number) => (
                        <CodeEditorItem data={item} key={index}></CodeEditorItem>
                    )
                )}
            </code>
            <small><div></div></small>
            <samp><h5>输出参数设置</h5></samp>
        </>
    )
}

export default CodeEditor