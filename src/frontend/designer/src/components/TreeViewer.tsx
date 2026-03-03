import { useState } from "react"
import styles from './TreeViewer.styles.module.css'

declare const window: {
    dragKey: string
} & Window

export interface TreeNode {
    id: string,
    name: string,
    draggable?: boolean,
    icon?: string,
    iconColor?: string,
    children?: TreeNode[]
}

const margin_left = 14

const TreeViewerNode = ({ node, fullId, dragKey, offset, onClick, onToggle, onDragStart, onDragEnd, inExpanded }: {
    node: TreeNode,
    fullId: string,
    dragKey?: string,
    offset: number,
    onClick: (fullId: string) => void,
    onToggle: (fullId: string) => void,
    onDragStart?: (fullId: string) => void,
    onDragEnd?: (fullId: string) => void,
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
        setIsDragging(true)
        if (onDragStart != null) {
            onDragStart(fullId)
        }
    }
    const handleDragEnd = () => {
        setIsDragging(false)
        if (onDragEnd != null) {
            onDragEnd(fullId)
        }
    }
    const handleClick = () => {
        if (node.children) {
            onToggle(fullId)
        } else {
            onClick(fullId)
        }
    }
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const drag_object = JSON.parse(e.dataTransfer.getData("text/plain"));
        const source_path = getFolderPath(drag_object.name)
        let target_path = getFolderPath(fullId)
        if (node.children) {
            target_path = fullId
        }
        if (source_path != target_path && !folderContains(drag_object.isdir, drag_object.name, target_path)) {
            console.warn(drag_object.name, "移动到", target_path)
        }
    }

    const is_category = node.children && node.children.length > 0
    const is_category_and_expanded = is_category && inExpanded(fullId)
    return (
        <li>
            <div
                onClick={handleClick}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDrop={handleDrop}
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
                        {node.children?.map(
                            (child_node) => (
                                <TreeViewerNode
                                    key={`${fullId}/${child_node.id}`}
                                    fullId={`${fullId}/${child_node.id}`}
                                    dragKey={dragKey}
                                    offset={offset + margin_left}
                                    node={child_node}
                                    onClick={onClick}
                                    onDragStart={onDragStart}
                                    onDragEnd={onDragEnd}
                                    inExpanded={inExpanded}
                                    onToggle={onToggle}
                                />
                            )
                        )}
                    </ul>
                )
            }
        </li>
    )
}

const TreeViewer = ({ source, dragKey, dropKey, expand, onClick, onDragStart, onDragEnd }: {
    source: TreeNode[],
    dragKey?: string,
    dropKey?: string,
    expand?: string,
    onClick: (fullId: string) => void,
    onDragStart?: (fullId: string) => void,
    onDragEnd?: (fullId: string) => void
}) => {
    const [expandedIds, setExpandedIds] = useState<string[]>(expand ? [expand] : []);
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
    const handleDragOver = (e: any) => {
        if (window.dragKey == dropKey) {
            e.preventDefault();
        }
    }

    return (
        <ul className={styles.tree} onDragOver={handleDragOver}>
            {source.map(
                (node) => (
                    <TreeViewerNode
                        key={node.id}
                        fullId={node.id}
                        dragKey={dragKey}
                        offset={margin_left}
                        node={node}
                        onClick={onClick}
                        inExpanded={inExpanded}
                        onToggle={handleToggle}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                    />
                )
            )}
        </ul>
    )
}

export default TreeViewer