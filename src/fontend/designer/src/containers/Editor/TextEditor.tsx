const TextEditor = ({ content }: { content: any }) => {
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