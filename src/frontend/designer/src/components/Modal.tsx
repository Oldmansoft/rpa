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
            <div>
                <button onClick={() => dialogRef.current!.close()}>确定</button>
            </div>
        </dialog>,
        document.body
    )
})