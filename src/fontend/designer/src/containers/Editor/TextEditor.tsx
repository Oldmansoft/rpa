import { useEffect, useState } from "react"
import { communication } from "../../components/Communication"
import { project } from "../Project"

const TextEditor = ({ file } : {file: string}) => {
    const [content, setContent] = useState<any>(null)

    useEffect(() => {
        (async () => {
            const fileContent = await communication.Executor.Designer.GetProjectTextContent(project.getAppPath(), file)
            setContent(fileContent)
        })()
    }, [file])

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
}

export default TextEditor