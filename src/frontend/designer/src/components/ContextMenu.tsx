import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import styles from './ContextMenu.styles.module.css'

export interface MenuItem {
    display: string,
    callback?(): void
}

export const PopupMenu = ({ items, onClick }: { items: MenuItem[], onClick?(): void }) => {
    if (items == null || items.length == 0) {
        return <></>
    }
    const handleClick = (e: React.MouseEvent) => {
        const index = Number((e.target as HTMLElement).getAttribute("data-index"))
        if (items[index].callback) {
            items[index].callback()
        }
        if (onClick) {
            onClick()
        }
    }
    return (
        <div className={styles.popup_menu} onClick={handleClick}>
            {items.map(
                (item, index) => (
                    <div key={index} data-index={index} data-valid={item.callback == null ? "0" : "1"}>{item.display}</div>
                )
            )}
        </div>
    )
}

export interface ContextMenuRef {
    show(items: MenuItem[]): void
}

const contextMenuPosition = { top: 0, left: 0 }

const setterRef: { current: React.Dispatch<React.SetStateAction<MenuItem[]>> | null } = { current: null }

export const ContextMenu = () => {
    const [menuItems, setContextMenuItems] = useState<MenuItem[]>([])

    useEffect(() => {
        setterRef.current = setContextMenuItems
        return () => {
            setterRef.current = null
        }
    }, [])

    const closeMenu = (e: MouseEvent) => {
        if ((e.target as HTMLElement)?.closest(`.${styles.context_menu}`)) {
            return
        }
        setContextMenuItems([])
    }
    const closeMenuByScroll = () => {
        setContextMenuItems([])
    }
    const handleClick = () => {
        setContextMenuItems([])
    }

    useEffect(() => {
        window.document.addEventListener('click', closeMenu, true)
        window.document.addEventListener('contextmenu', closeMenu, true)
        window.document.addEventListener('scroll', closeMenuByScroll, true)

        return () => {
            window.document.removeEventListener('click', closeMenu, true)
            window.document.removeEventListener('contextmenu', closeMenu, true)
            window.document.removeEventListener('scroll', closeMenuByScroll, true)
        }
    }, [])

    const result = menuItems.length > 0 ? (
        <div className={styles.context_menu} style={{ top: `${contextMenuPosition.top}px`, left: `${contextMenuPosition.left}px` }}>
            <PopupMenu items={menuItems} onClick={handleClick} />
        </div>
    ) : <></>

    return createPortal(result, document.body)
}

export const showContextMenu = (e: React.MouseEvent<HTMLElement>, items: MenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    contextMenuPosition.top = e.clientY
    contextMenuPosition.left = e.clientX
    if (setterRef.current == null) {
        throw ReferenceError("ContextMenu 未挂载，请确保页面中已渲染 <ContextMenu />")
    }
    setterRef.current(items)
}