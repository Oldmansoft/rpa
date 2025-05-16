const CodePaneVariable = ({ data, onChange }: { data: any, onChange(index: number, key: string, value: string): void }) => {
    if (!data) {
        return
    }

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(data.index, "name", event.target.value)
    }

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(data.index, "value", event.target.value)
    }

    return (
        <>
            <label className="property">
                <span>名称</span>
                <input value={data["name"]} onChange={handleNameChange} />
            </label>
            <label className="property">
                <span>初始值</span>
                <input value={data["value"]} onChange={handleValueChange} />
            </label>
        </>
    )
}

export default CodePaneVariable