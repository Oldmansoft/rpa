import { useEffect, useRef, DragEvent } from "react"
import {
    CodeChooseCategory,
    TagName,
    CodeNodePosition,
    make_numbers,
    codeDrager,
    mouse_in_node_top,
    find_previous_tag,
} from "./Utils"
import { CodeEditorItem } from "./CodeEditorNodes"
import { CodeEditorVarSections } from "./CodeEditorVarSections"
import {
    find_node_from_data,
    isItemArticle,
    isFooterArticle,
    isHeaderArticle,
    isBoundaryArticle,
    isLastSectionArticle,
} from "./CodeEditorUtils"

export { find_component, find_node_from_data, set_data_num_index } from "./CodeEditorUtils"

declare const window: { dragKey: string } & Window

const CodeEditor = ({
    content,
    onNodeMove,
    onPropertiesPaneOpen,
}: {
    content: any
    onNodeMove: (source: CodeNodePosition, target: CodeNodePosition) => void
    onPropertiesPaneOpen: (category: CodeChooseCategory, data: any) => void
}) => {
    const codeRef = useRef<HTMLElement>(null)
    const lineRef = useRef<HTMLElement>(null)
    const enterCountRef = useRef(0)

    useEffect(() => {
        codeDrager.setDropLine(lineRef.current)
        if (codeRef.current) {
            make_numbers(codeRef.current)
            codeDrager.init(codeRef.current)
        }
    }, [content])

    if (!content) return null

    const handleDragEnter = (e: DragEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).tagName === TagName.aside) return
        enterCountRef.current++
        if (window.dragKey != "editor") return
        e.preventDefault()
    }

    const handleDragLeave = (e: DragEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).tagName === TagName.aside) return
        if (--enterCountRef.current === 0) {
            codeDrager.resetDropLine()
        }
    }

    const handleDragOver = (e: DragEvent<HTMLElement>) => {
        if (window.dragKey != "editor" || !lineRef.current) return
        if ((e.target as HTMLElement).tagName === TagName.aside) return
        e.preventDefault()

        const currentTarget = (e.target as HTMLElement).closest("article")
        if (currentTarget == null) return
        if (!codeDrager.can_working(e, currentTarget, lineRef.current)) return

        if (isItemArticle(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const previous = currentTarget.previousElementSibling
                if (previous == null || previous !== lineRef.current) {
                    currentTarget.before(lineRef.current)
                }
            } else {
                const next = currentTarget.nextElementSibling
                if (next == null || next !== lineRef.current) {
                    currentTarget.after(lineRef.current)
                }
            }
        } else if (isFooterArticle(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const sampNode = find_previous_tag(currentTarget, TagName.samp)
                if (sampNode && (sampNode.children.length === 0 || sampNode.lastElementChild !== lineRef.current)) {
                    sampNode.append(lineRef.current)
                }
            } else {
                const next = (currentTarget.parentNode as HTMLElement).nextElementSibling
                if (next == null || next !== lineRef.current) {
                    (currentTarget.parentNode as HTMLElement).after(lineRef.current)
                }
            }
        } else if (isHeaderArticle(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const containerNode = currentTarget.parentNode!.parentNode as HTMLElement
                const previous = containerNode.previousElementSibling
                if (previous == null || previous !== lineRef.current) {
                    containerNode.before(lineRef.current)
                }
            } else {
                const sampNode = currentTarget.nextElementSibling as HTMLElement
                if (sampNode && (sampNode.children.length === 0 || sampNode.firstElementChild !== lineRef.current)) {
                    sampNode.prepend(lineRef.current)
                }
            }
        } else if (isBoundaryArticle(currentTarget) || isLastSectionArticle(currentTarget)) {
            if (mouse_in_node_top(e, currentTarget)) {
                const sampNode = find_previous_tag(currentTarget, TagName.samp)
                if (sampNode && (sampNode.children.length === 0 || sampNode.lastElementChild !== lineRef.current)) {
                    sampNode.append(lineRef.current)
                }
            } else {
                const sampNode = currentTarget.nextElementSibling as HTMLElement
                if (sampNode && (sampNode.children.length === 0 || sampNode.firstElementChild !== lineRef.current)) {
                    sampNode.prepend(lineRef.current)
                }
            }
        }
    }

    const handleDragStart = (e: DragEvent<HTMLElement>) => {
        window.dragKey = "editor"
        e.dataTransfer.effectAllowed = "move"
        const targetNode = e.target as HTMLElement
        const tagName = targetNode.tagName
        if ([TagName.article, TagName.hgroup].includes(tagName)) {
            codeDrager.start(targetNode)
        } else if (tagName === TagName.section) {
            codeDrager.start_boundary(targetNode)
        }
    }

    const handleDragEnd = () => {
        const position = codeDrager.finish()
        if (position != null) {
            onNodeMove(position.source!, position.target)
        }
    }

    const handleLineDragEnter = (e: DragEvent<HTMLElement>) => {
        enterCountRef.current++
        e.preventDefault()
    }

    const handleLineDragLeave = () => {
        enterCountRef.current--
    }

    const handleNodeChoose = (num: number) => {
        const data = find_node_from_data(content, num)
        onPropertiesPaneOpen(CodeChooseCategory.Body, data)
    }

    return (
        <code>
            <CodeEditorVarSections
                content={content}
                onPropertiesPaneOpen={onPropertiesPaneOpen}
                insertBeforeOutput={
                    <>
                        <main
                            ref={codeRef}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            data-num="0"
                        >
                            {content.body.map((item: any, index: number) => (
                                <CodeEditorItem
                                    key={index}
                                    data={item}
                                    parent_num={0}
                                    index={index}
                                    onNodeChoose={handleNodeChoose}
                                />
                            ))}
                        </main>
                        <small
                            ref={lineRef}
                            onDragOver={(e: DragEvent<HTMLElement>) => e.preventDefault()}
                            onDragEnter={handleLineDragEnter}
                            onDragLeave={handleLineDragLeave}
                        >
                            <div />
                        </small>
                    </>
                }
            />
        </code>
    )
}

export default CodeEditor
