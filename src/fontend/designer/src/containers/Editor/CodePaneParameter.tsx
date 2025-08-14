import Input from "../../components/Input"

const CodePaneParameter = ({ data, direction, onChange }: {
    data: any,
    direction: "in" | "out"
    onChange(direction: "in" | "out", index: number, key: string, value: string): void
}) => {
    if (!data) {
        return
    }

    const handleNameNativeChange = (value: string) => {
        if (value == "") {
            return false
        }
        onChange(direction, data.index, "name", value)
        return true
    }

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(direction, data.index, "value", event.target.value)
    }

    return (
        <>
            <label className="property">
                <span>名称</span>
                <Input value={data["name"]} onNativeChange={handleNameNativeChange} onInput={(value) => value.trim()}></Input>
            </label>
            <label className="property">
                <span>默认值</span>
                <input value={data["value"]} onChange={handleValueChange} />
            </label>
        </>
    )
}

export default CodePaneParameter