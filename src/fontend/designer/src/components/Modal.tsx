import { forwardRef, useImperativeHandle, useRef, useState } from "react"
import { createPortal } from "react-dom"

export interface LoadingRef {
    show(text: string): void,
    hide(): void
}

export const Loading = forwardRef((props: React.ComponentProps<'dialog'>, ref: React.Ref<LoadingRef>) => {
    const [content, setContent] = useState("")
    const dialogRef = useRef<HTMLDialogElement>(null)
    useImperativeHandle(ref, () => {
        return {
            show(text: string) {
                setContent(text)
                dialogRef.current!.showModal()
            },
            hide() {
                dialogRef.current!.close()
            }
        };
    }, []);

    return createPortal(
        <dialog {...props} ref={dialogRef}>
            {content}
        </dialog>,
        document.body
    )
})

export interface DialogAlertRef {
    show(text: string): void
}

export const DialogAlert = forwardRef((props: React.ComponentProps<'dialog'>, ref: React.Ref<DialogAlertRef>) => {
    const [content, setContent] = useState("")
    const dialogRef = useRef<HTMLDialogElement>(null)

    useImperativeHandle(ref, () => {
        return {
            show(text: string) {
                setContent(text)
                dialogRef.current!.showModal()
            }
        };
    }, []);
    return createPortal(
        <dialog {...props} ref={dialogRef}>
            {content}
        </dialog>,
        document.body
    )
})

export interface DialogCreateProjectRef {
    show(): void
}

export const DialogCreateProject = forwardRef((props: React.ComponentProps<'dialog'>, ref: React.Ref<DialogCreateProjectRef>) => {
    const dialogRef = useRef<HTMLDialogElement>(null)
    const inputNameRef = useRef<HTMLInputElement>(null)
    const inputPathRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => {
        return {
            show() {
                dialogRef.current!.showModal()
            }
        };
    }, []);

    const buttonClickHandle = () => {

    }
    return createPortal(
        <dialog {...props} ref={dialogRef}>
            <h1>新建应用<i className="font i-close"></i></h1>
            <section>
                <label><span>应用名称</span><input ref={inputNameRef} /></label>
                <label><span>应用位置</span><input ref={inputPathRef} /><button onClick={buttonClickHandle}>...</button></label>
                <div className="buttons">
                    <button disabled>确定</button>
                    <button onClick={ () => { dialogRef.current!.close() } }>取消</button>
                </div>
            </section>
        </dialog>,
        document.body
    )
})