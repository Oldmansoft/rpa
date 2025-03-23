import React, { Children, ReactNode, useState } from "react"
import styles from './Layout.styles.module.css'

export const Top = ({ className, children }: { className?: string, children: ReactNode }) => {
    let mixClassName = styles.top
    if (className) {
        mixClassName = `${className} ${styles.top}`
    }
    return (
        <div className={mixClassName}>
            {children}
        </div>
    )
}

export const Bottom = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.bottom}>
            {children}
        </div>
    )
}

export const Left = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.left}>
            {children}
        </div>
    )
}

export const Right = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.right}>
            {children}
        </div>
    )
}

export const Vertical = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.vertical}>
            {children}
        </div>
    )
}

export const Horizontal = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.horizontal}>
            {children}
        </div>
    )
}

type TabChildren = React.ReactElement<{ title: string, children: ReactNode }> | React.ReactElement<{ title: string, children: ReactNode }>[]

export const Tab = ({ children }: { children: TabChildren }) => {
    const [activeIndex, setActiveIndex] = useState(0)

    return (
        <>
            <div className="tab-label">
                {
                    Children.map(children, (child, index) => {
                        return <label key={index} onClick={() => { setActiveIndex(index) }}>{child.props.title}</label>
                    })
                }
            </div>
            <div className="tab-content">
                {
                    Children.map(children, (child, index) => {
                        if (activeIndex == index) {
                            return child.props.children
                        } else {
                            return null
                        }
                    })
                }
            </div>
        </>
    )
}

export const TabItem = ({ title, children }: { title: string, children: ReactNode }) => {
    return (
        <div title={title}>
            {children}
        </div>
    )
}

const Layout = ({ children }: { children: ReactNode }) => {
    return (
        <div className={styles.layout}>
            {children}
        </div>
    )
}

export default Layout