import { useState } from "react"
import styles from './TreeViewer.styles.module.css'

declare const window: {
    dragKey: string
} & Window

let currentDragSource: { fullId: string, isdir: boolean } | null = null

export interface TreeNode {
    id: string,
    name: string,
    draggable?: boolean,
    icon?: string,
    iconColor?: string,
    children?: TreeNode[]
}

const margin_left = 14

const TreeViewerNode = ({ node, fullId, dragKey, dropKey, offset, onClick, onToggle, onDragStart, onDragEnd, onDrop, canAcceptDrop, isNodeHidden, onContextMenu, inExpanded }: {
    node: TreeNode,
    fullId: string,
    dragKey?: string,
    dropKey?: string,
    offset: number,
    onClick: (fullId: string) => void,
    onToggle: (fullId: string) => void,
    onDragStart?: (fullId: string) => void,
    onDragEnd?: (fullId: string) => void,
    onDrop?: (sourceFullId: string, targetFolderFullId: string, isSourceDir: boolean) => void,
    canAcceptDrop?: (sourceFullId: string, sourceIsDir: boolean, targetFullId: string, targetIsDir: boolean) => boolean,
    isNodeHidden?: (fullId: string, node: TreeNode) => boolean,
    onContextMenu?: (e: React.MouseEvent<HTMLElement>, fullId: string, node: TreeNode) => void,
    inExpanded: (fullId: string) => boolean
}) => {
    function getFolderPath(path: string) {
        if (path.lastIndexOf("/") == 0) {
            return path.substring(0, path.lastIndexOf("/") + 1)
        }
        return path.substring(0, path.lastIndexOf("/"))
    }
    function folderContains(isdir: boolean, source: string, target: string): boolean {
        if (!isdir) {
            return false
        }
        const source_folders = source.split("/")
        const target_folders = target.split("/")
        if (source_folders.length > target_folders.length) {
            return false
        }
        for (let i = 0; i < source_folders.length; i++) {
            if (source_folders[i] != target_folders[i]) {
                return false
            }
        }
        return true
    }

    const [isDragging, setIsDragging] = useState(false)
    const iconStyle: any = {}
    if (node.iconColor) {
        iconStyle["backgroundColor"] = node.iconColor
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dragKey) {
            return;
        }
        e.dataTransfer.setData("text/plain", JSON.stringify({
            name: fullId,
            isdir: node.children != null
        }))
        window.dragKey = dragKey
        currentDragSource = { fullId, isdir: node.children != null }
        setIsDragging(true)
        if (onDragStart != null) {
            onDragStart(fullId)
        }
    }
    const handleDragEnd = () => {
        currentDragSource = null
        setIsDragging(false)
        if (onDragEnd != null) {
            onDragEnd(fullId)
        }
    }
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (window.dragKey !== dropKey) return
        const src = currentDragSource
        if (canAcceptDrop && src && !canAcceptDrop(src.fullId, src.isdir, fullId, node.children != null)) return
        e.preventDefault()
    }
    const handleClick = () => {
        if (node.children) {
            onToggle(fullId)
        } else {
            onClick(fullId)
        }
    }
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        if (!onDrop) return
        const drag_object = JSON.parse(e.dataTransfer.getData("text/plain"))
        const source_path = getFolderPath(drag_object.name)
        let target_path = getFolderPath(fullId)
        if (node.children != null) {
            target_path = fullId
        }
        if (source_path !== target_path && !folderContains(drag_object.isdir, drag_object.name, target_path)) {
            onDrop(drag_object.name, target_path, drag_object.isdir)
        }
    }

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
        onContextMenu?.(e, fullId, node)
    }

    const is_category = node.children && node.children.length > 0
    const is_category_and_expanded = is_category && inExpanded(fullId)
    return (
        <li>
            <div
                onClick={handleClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onContextMenu={handleContextMenu}
                draggable={dragKey ? "true" : "false"}
                className="hover:bg-gray-200"
                style={{
                    backgroundColor: isDragging ? "lightblue" : "",
                }}
            >
                <span style={{ width: `${offset}px`, display: "inline-block" }}>
                    {is_category && (is_category_and_expanded ? (<i className="icon-[ri--arrow-down-s-line]"></i>) : (<i className="icon-[ri--arrow-right-s-line]"></i>))}
                </span>
                {node.icon && (<i className={`${node.icon}`} style={iconStyle}></i>)}
                {node.name}
            </div>
            {
                is_category_and_expanded && (
                    <ul>
                        {node.children
                            ?.filter((child_node) => !isNodeHidden?.(`${fullId}/${child_node.id}`, child_node))
                            .map((child_node) => (
                                <TreeViewerNode
                                    key={`${fullId}/${child_node.id}`}
                                    fullId={`${fullId}/${child_node.id}`}
                                    dragKey={dragKey}
                                    dropKey={dropKey}
                                    offset={offset + margin_left}
                                    node={child_node}
                                    onClick={onClick}
                                    onDragStart={onDragStart}
                                    onDragEnd={onDragEnd}
                                    onDrop={onDrop}
                                    canAcceptDrop={canAcceptDrop}
                                    isNodeHidden={isNodeHidden}
                                    onContextMenu={onContextMenu}
                                    inExpanded={inExpanded}
                                    onToggle={onToggle}
                                />
                            ))}
                    </ul>
                )
            }
        </li>
    )
}

const TreeViewer = ({ source, dragKey, dropKey, expand, onClick, onDragStart, onDragEnd, onDrop, canAcceptDrop, isNodeHidden, onContextMenu }: {
    source: TreeNode[],
    dragKey?: string,
    dropKey?: string,
    expand?: string,
    onClick: (fullId: string) => void,
    onDragStart?: (fullId: string) => void,
    onDragEnd?: (fullId: string) => void,
    onDrop?: (sourceFullId: string, targetFolderFullId: string, isSourceDir: boolean) => void,
    canAcceptDrop?: (sourceFullId: string, sourceIsDir: boolean, targetFullId: string, targetIsDir: boolean) => boolean,
    isNodeHidden?: (fullId: string, node: TreeNode) => boolean,
    onContextMenu?: (e: React.MouseEvent<HTMLElement>, fullId: string, node: TreeNode) => void
}) => {
    const [expandedIds, setExpandedIds] = useState<string[]>(expand || expand == "" ? [expand] : [])
    const handleToggle = (fullId: string) => {
        if (expandedIds.includes(fullId)) {
            setExpandedIds(expandedIds.filter((expandedId) => expandedId !== fullId))
        } else {
            setExpandedIds([...expandedIds, fullId])
        }
    }
    const inExpanded = (fullId: string) => {
        return expandedIds.includes(fullId)
    }
    return (
        <ul className={styles.tree}>
            {source
                .filter((node) => !isNodeHidden?.(node.id, node))
                .map((node) => (
                    <TreeViewerNode
                        key={node.id}
                        fullId={node.id}
                        dragKey={dragKey}
                        dropKey={dropKey}
                        offset={margin_left}
                        node={node}
                        onClick={onClick}
                        inExpanded={inExpanded}
                        onToggle={handleToggle}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDrop={onDrop}
                        canAcceptDrop={canAcceptDrop}
                        isNodeHidden={isNodeHidden}
                        onContextMenu={onContextMenu}
                    />
                ))}
        </ul>
    )
}

export default TreeViewer