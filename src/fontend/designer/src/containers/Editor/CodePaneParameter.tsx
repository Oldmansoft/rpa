const CodePaneParameter = ({ data, direction, onChange }: {
    data: any,
    direction: "in" | "out"
    onChange(direction: "in" | "out", index: number, key: string, value: string): void
}) => {
    if (!data) {
        return
    }

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(direction, data.index, "name", event.target.value)
    }

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(direction, data.index, "value", event.target.value)
    }

    return (
        <>
            <label className="property">
                <span>名称</span>
                <input value={data["name"]} onChange={handleNameChange} />
            </label>
            <label className="property">
                <span>默认值</span>
                <input value={data["value"]} onChange={handleValueChange} />
            </label>
        </>
    )
}

export default CodePaneParameter