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

export interface DialogConfirmRef {
    show(message: string, defaultValue?: string): Promise<string | null>
}

export const DialogConfirm = forwardRef((props: React.ComponentProps<'dialog'>, ref: React.Ref<DialogConfirmRef>) => {
    const [content, setContent] = useState("")
    const [inputValue, setInputValue] = useState("")
    const dialogRef = useRef<HTMLDialogElement>(null)
    const resolveRef = useRef<(value: string | null) => void>(() => {})

    useImperativeHandle(ref, () => {
        return {
            show(message: string, defaultValue: string = "") {
                setContent(message)
                setInputValue(defaultValue)
                dialogRef.current!.showModal()
                return new Promise<string | null>((resolve) => {
                    resolveRef.current = (value) => {
                        resolve(value)
                        resolveRef.current = () => {}
                    }
                })
            }
        };
    }, []);

    const handleConfirm = () => {
        dialogRef.current!.close()
        resolveRef.current(inputValue.trim() || null)
    }

    const handleCancel = () => {
        dialogRef.current!.close()
        resolveRef.current(null)
    }

    return createPortal(
        <dialog {...props} ref={dialogRef}>
            <div>{content}</div>
            <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirm()
                    if (e.key === "Escape") handleCancel()
                }}
            />
            <div>
                <button onClick={handleCancel}>取消</button>
                <button onClick={handleConfirm}>确定</button>
            </div>
        </dialog>,
        document.body
    )
})