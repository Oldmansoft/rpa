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

const context_menu_position = {
    top: 0,
    left: 0
}
let setContextMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>

export const ContextMenu = () => {
    let menuItems: MenuItem[]
    [menuItems, setContextMenuItems] = useState<MenuItem[]>([])

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
        window.document.addEventListener('contextmenu', closeMenu, true);
        window.document.addEventListener('scroll', closeMenuByScroll, true);

        return () => {
            window.document.removeEventListener('click', closeMenu, true);
            window.document.removeEventListener('contextmenu', closeMenu, true);
            window.document.removeEventListener('scroll', closeMenuByScroll, true);
        };
    }, [])

    let result = <></>
    if (menuItems.length > 0) {
        result = (
            <div className={styles.context_menu} style={{ top: `${context_menu_position.top}px`, left: `${context_menu_position.left}px` }}>
                <PopupMenu items={menuItems} onClick={handleClick}></PopupMenu>
            </div>
        )
    }

    return createPortal(
        result,
        document.body
    )
}

export const showContextMenu = (e: React.MouseEvent<HTMLElement>, items: MenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    context_menu_position.top = e.clientY
    context_menu_position.left = e.clientX
    if (setContextMenuItems == undefined) {
        throw ReferenceError("Please use ContextMenu component first")
    }
    setContextMenuItems(items)
}