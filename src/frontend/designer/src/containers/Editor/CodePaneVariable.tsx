import Input from "../../components/Input"

const CodePaneVariable = ({ data, onChange }: { data: any, onChange(index: number, key: string, value: string): void }) => {
    if (!data) {
        return
    }

    const handleNameNativeChange = (value: string) => {
        if (value == "") {
            return false
        }
        onChange(data.index, "name", value)
        return true
    }

    const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(data.index, "value", event.target.value)
    }

    return (
        <>
            <label className="property">
                <span>名称</span>
                <Input value={data["name"]} onNativeChange={handleNameNativeChange} onInput={(value) => value.trim()}></Input>
            </label>
            <label className="property">
                <span>初始值</span>
                <input value={data["value"]} onChange={handleValueChange} />
            </label>
        </>
    )
}

export default CodePaneVariable