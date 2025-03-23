import { useState } from "react"
import styles from './TreeViewer.styles.module.css'

declare const window: {
    dragKey: string
} & Window

export interface TreeNode {
    name: string,
    draggable?: boolean,
    icon?: string,
    iconColor?: string,
    children?: TreeNode[]
}

const margin_left = 18

const TreeViewerNode = ({ node, fullName, dragKey, offset, onClick, onToggle, inExpanded }: {
    node: TreeNode,
    fullName: string,
    dragKey?: string,
    offset: number,
    onClick: (fullname: string) => void,
    onToggle: (fullName: string) => void,
    inExpanded: (fullName: string) => boolean
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
    const iconStyle:any = {}
    if (node.iconColor) {
        iconStyle["backgroundColor"] = node.iconColor
    }

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!dragKey) {
            return;
        }
        e.dataTransfer.setData("text/plain", JSON.stringify({
            name: fullName,
            isdir: node.children != null
        }))
        e.dataTransfer.effectAllowed = "move"
        window.dragKey = dragKey
        setIsDragging(true)
    }
    const handleDragEnd = () => setIsDragging(false)
    const handleClick = () => {
        if (node.children) {
            onToggle(fullName)
        }else {
            onClick(fullName)
        }
    }
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const drag_object = JSON.parse(e.dataTransfer.getData("text/plain"));
        const source_path = getFolderPath(drag_object.name)
        let target_path = getFolderPath(fullName)
        if (node.children) {
            target_path = fullName
        }
        if (source_path != target_path && !folderContains(drag_object.isdir, drag_object.name, target_path)) {
            console.warn(drag_object.name, "移动到", target_path)
        }
    }

    const is_category = node.children && node.children.length > 0
    const is_category_and_expanded = is_category && inExpanded(fullName)
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
                <span style={{ width: `${offset}px`, display: "inline-block" }}></span>
                {is_category && (is_category_and_expanded ? (<i className="icon-[mdi--minus]"></i>) : (<i className="icon-[mdi--plus]"></i>))}
                {node.icon && (<i className={`${node.icon}`} style={iconStyle}></i>)}
                {node.name}
            </div>
            {
                is_category_and_expanded && (
                    <ul>
                        {node.children?.map(
                            (child_node) => (
                                <TreeViewerNode
                                    key={`${fullName}/${child_node.name}`}
                                    fullName={`${fullName}/${child_node.name}`}
                                    dragKey={dragKey}
                                    offset={offset + margin_left}
                                    node={child_node}
                                    onClick={onClick}
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

const TreeViewer = ({ source, dragKey, dropKey, onClick }: {
    source: TreeNode[],
    dragKey?: string,
    dropKey?: string,
    onClick: (fullname: string) => void
}) => {
    const [expandedNames, setExpandedNames] = useState<string[]>([]);
    const handleToggle = (fullName: string) => {
        if (expandedNames.includes(fullName)) {
            setExpandedNames(expandedNames.filter((name) => name !== fullName))
        } else {
            setExpandedNames([...expandedNames, fullName])
        }
    }
    const inExpanded = (fullName: string) => {
        return expandedNames.includes(fullName)
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
                        key={node.name}
                        fullName={node.name}
                        dragKey={dragKey}
                        offset={0}
                        node={node}
                        onClick={onClick}
                        inExpanded={inExpanded}
                        onToggle={handleToggle}
                    />
                )
            )}
        </ul>
    )
}

export default TreeViewer