import React, { useContext, useRef, useCallback, ReactNode } from "react"
import { DragEvent } from "react"
import { CodeChooseCategory } from "./Utils"
import { IconButton } from "../../components/Button"
import { showContextMenu, MenuItem } from "../../components/ContextMenu"
import { EditorContext } from "../EditorContext"
import {
    setChosen,
    getVarListByCategory,
    getMoveTargetsForCategory,
    DRAG_KEY_TO_CATEGORY,
    VAR_ITEM_EMPTY,
} from "./CodeEditorUtils"

declare const window: { dragKey: string } & Window

export interface CodeEditorVarSectionsProps {
    content: any
    onPropertiesPaneOpen: (category: CodeChooseCategory, data: any) => void
    /** 在“输出参数设置”前插入（如 main 与 drop line） */
    insertBeforeOutput?: ReactNode
}

function getCategoryFromDragKey(dragKey: string): CodeChooseCategory {
    return DRAG_KEY_TO_CATEGORY[dragKey] ?? CodeChooseCategory.ParameterOut
}

export function CodeEditorVarSections({ content, onPropertiesPaneOpen, insertBeforeOutput }: CodeEditorVarSectionsProps) {
    const tabContent = useContext(EditorContext)
    const sectionDragSourceRef = useRef<HTMLElement | null>(null)

    const moveVarItem = useCallback(
        (sourceIndex: number, targetIndex: number) => {
            const category = getCategoryFromDragKey(window.dragKey)
            const list = getVarListByCategory(content, category)
            const element = list.splice(sourceIndex, 1)[0]
            list.splice(targetIndex, 0, element)
            tabContent.setContent(content)
        },
        [content, tabContent]
    )

    const handleParameterInChoose = useCallback(
        (index: number, event: React.MouseEvent) => {
            setChosen(event.currentTarget as HTMLElement)
            onPropertiesPaneOpen(CodeChooseCategory.ParameterIn, {
                ...content.parameter.in[index],
                index,
            })
        },
        [content, onPropertiesPaneOpen]
    )

    const handleVariableChoose = useCallback(
        (index: number, event: React.MouseEvent) => {
            setChosen(event.currentTarget as HTMLElement)
            onPropertiesPaneOpen(CodeChooseCategory.Variable, {
                ...content.local[index],
                index,
            })
        },
        [content, onPropertiesPaneOpen]
    )

    const handleParameterOutChoose = useCallback(
        (index: number, event: React.MouseEvent) => {
            setChosen(event.currentTarget as HTMLElement)
            onPropertiesPaneOpen(CodeChooseCategory.ParameterOut, {
                ...content.parameter.out[index],
                index,
            })
        },
        [content, onPropertiesPaneOpen]
    )

    const handleSectionDragStart = useCallback((e: DragEvent<HTMLElement>) => {
        window.dragKey = e.currentTarget.getAttribute("data-drag-key") ?? "parameter-out"
        e.dataTransfer.effectAllowed = "move"
        sectionDragSourceRef.current = e.target as HTMLElement
    }, [])

    const handleSectionDragEnd = useCallback(
        (e: DragEvent<HTMLElement>) => {
            const source = sectionDragSourceRef.current
            sectionDragSourceRef.current = null
            if (source == null) return
            const sourceIndex = Number(source.getAttribute("data-index"))
            const sectionRect = e.currentTarget.getBoundingClientRect()
            if (
                e.clientX <= sectionRect.left ||
                e.clientX >= sectionRect.right ||
                e.clientY <= sectionRect.top ||
                e.clientY >= sectionRect.bottom
            ) {
                return
            }
            let position = 0
            const children = e.currentTarget.children
            for (let i = 0; i < children.length; i++) {
                if (i <= sourceIndex) position = i
                const nodeRect = (children[i] as HTMLElement).getBoundingClientRect()
                if (
                    (e.clientX < nodeRect.left + nodeRect.width / 2 && e.clientY < nodeRect.bottom) ||
                    e.clientY < nodeRect.top
                ) {
                    break
                }
                if (i > sourceIndex) position = i
            }
            if (sourceIndex !== position) moveVarItem(sourceIndex, position)
        },
        [moveVarItem]
    )

    const handleSectionDragOver = useCallback((e: DragEvent<HTMLElement>) => {
        if (e.currentTarget.getAttribute("data-drag-key") === window.dragKey) {
            e.preventDefault()
        }
    }, [])

    const handleSectionVarContextMenu = useCallback(
        (e: React.MouseEvent<HTMLElement>) => {
            const dragKey = e.currentTarget.parentElement?.getAttribute("data-drag-key") ?? "parameter-out"
            const category = getCategoryFromDragKey(dragKey)
            const index = Number(e.currentTarget.getAttribute("data-index"))
            const list = getVarListByCategory(content, category)
            const items: MenuItem[] = [
                {
                    display: "删除",
                    callback: () => {
                        list.splice(index, 1)
                        tabContent.setContent(content)
                    },
                },
            ]
            const targets = getMoveTargetsForCategory(category)
            for (const { category: targetCategory, label: targetLabel } of targets) {
                items.push({
                    display: `移动到${targetLabel}`,
                    callback: () => {
                        const removed = list.splice(index, 1)
                        getVarListByCategory(content, targetCategory).push(removed[0])
                        tabContent.setContent(content)
                    },
                })
            }
            showContextMenu(e, items)
        },
        [content, tabContent]
    )

    const handleVarAdd = useCallback(
        (category: CodeChooseCategory) => {
            getVarListByCategory(content, category).push({ ...VAR_ITEM_EMPTY })
            tabContent.setContent(content)
        },
        [content, tabContent]
    )

    return (
        <>
            <div>
                <h5>
                    <span>输入参数设置</span>
                    <IconButton
                        onClick={() => handleVarAdd(CodeChooseCategory.ParameterIn)}
                        className="icon-[mdi--plus] align-middle"
                    />
                </h5>
                <section
                    data-drag-key="parameter-in"
                    onDragStart={handleSectionDragStart}
                    onDragOver={handleSectionDragOver}
                    onDragEnd={handleSectionDragEnd}
                >
                    {content.parameter.in.map((item: any, index: number) => (
                        <var
                            key={index}
                            data-index={index}
                            onClick={(event) => handleParameterInChoose(index, event)}
                            draggable="true"
                            onContextMenu={handleSectionVarContextMenu}
                        >
                            {item["name"] == "" ? (
                                <dfn className="error">[请填写]</dfn>
                            ) : (
                                <dfn>{item["name"]}</dfn>
                            )}
                        </var>
                    ))}
                </section>
            </div>
            <div>
                <h5>
                    <span>流程变量设置</span>
                    <IconButton
                        onClick={() => handleVarAdd(CodeChooseCategory.Variable)}
                        className="icon-[mdi--plus] align-middle"
                    />
                </h5>
                <section
                    data-drag-key="variable"
                    onDragStart={handleSectionDragStart}
                    onDragOver={handleSectionDragOver}
                    onDragEnd={handleSectionDragEnd}
                >
                    {content.local.map((item: any, index: number) => (
                        <var
                            key={index}
                            data-index={index}
                            onClick={(event) => handleVariableChoose(index, event)}
                            draggable="true"
                            onContextMenu={handleSectionVarContextMenu}
                        >
                            {item["name"] == "" ? (
                                <dfn className="error">[请填写]</dfn>
                            ) : (
                                <dfn>{item["name"]}</dfn>
                            )}
                        </var>
                    ))}
                </section>
            </div>
            {insertBeforeOutput}
            <div>
                <h5>
                    <span>输出参数设置</span>
                    <IconButton
                        onClick={() => handleVarAdd(CodeChooseCategory.ParameterOut)}
                        className="icon-[mdi--plus] align-middle"
                    />
                </h5>
                <section
                    data-drag-key="parameter-out"
                    onDragStart={handleSectionDragStart}
                    onDragOver={handleSectionDragOver}
                    onDragEnd={handleSectionDragEnd}
                >
                    {content.parameter.out.map((item: any, index: number) => (
                        <var
                            key={index}
                            data-index={index}
                            onClick={(event) => handleParameterOutChoose(index, event)}
                            draggable="true"
                            onContextMenu={handleSectionVarContextMenu}
                        >
                            {item["name"] == "" ? (
                                <dfn className="error">[请填写]</dfn>
                            ) : (
                                <dfn>{item["name"]}</dfn>
                            )}
                        </var>
                    ))}
                </section>
            </div>
        </>
    )
}
