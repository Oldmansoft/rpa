import Input from "../../components/Input"
import InputExpression from "../../components/InputExpression"

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

    const handleValueChange = (value: string) => {
        onChange(data.index, "value", value)
        return true
    }

    return (
        <>
            <label className="property">
                <span>变量名称</span>
                <Input value={data["name"]} onNativeChange={handleNameNativeChange} onInput={(value) => value.trim()}></Input>
            </label>
            <label className="property">
                <span>初始值</span>
                <InputExpression value={data["value"]} onNativeChange={handleValueChange} onInput={(value) => value.trim()}></InputExpression>
            </label>
        </>
    )
}

export default CodePaneVariable