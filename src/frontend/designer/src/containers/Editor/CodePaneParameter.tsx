import Input from "../../components/Input"
import InputExpression from "../../components/InputExpression"

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

    const handleValueChange = (value: string) => {
        onChange(direction, data.index, "value", value)
        return true
    }

    return (
        <>
            <label className="property">
                <span>名称</span>
                <Input value={data["name"]} onNativeChange={handleNameNativeChange} onInput={(value) => value.trim()}></Input>
            </label>
            <label className="property">
                <span>默认值</span>
                <InputExpression value={data["value"]} onNativeChange={handleValueChange} onInput={(value) => value.trim()}></InputExpression>
            </label>
        </>
    )
}

export default CodePaneParameter