import { useEffect, forwardRef, useImperativeHandle } from "react"
import { ContentEditorRef } from "./Utils"

const TextEditor = forwardRef(({ content }: { content: any }, ref: React.Ref<ContentEditorRef>) => {
    useImperativeHandle(ref, () => {
        return {
            getContent() {
                return content
            }
        }
    }, [])

    useEffect(() => {
        (async () => {

        })()
    }, [content])

    if (!content) {
        return
    }
    return (
        <code>
            {content.map(
                (item: string, index: number) => (
                    <article key={index}>
                        {item}
                    </article>
                )
            )}
        </code>
    )
})

export default TextEditor