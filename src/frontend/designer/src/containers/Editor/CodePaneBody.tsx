import { project } from "../Project"
import { find_component } from "./CodeEditor"
import './CodePaneProperties.css'

const inputTypeTips = new Map<string, string>([
    ["Variable", "变量名称"],
    ["Expression", "条件表达式"],
    ["Format", "字符串格式化内容"],
    ["String", "字符串"]
])

function get_param(params: any[], id: string) {
    for (const item of params) {
        if (item["id"] == id) {
            return item
        }
    }
    return null
}

const CodePaneAction = ({ data, onChange }: { data: any, onChange(num: number, key: string, value: string): void }) => {
    if (!data) {
        return
    }
    let component: any
    if ("parent-id" in data) {
        component = find_component(data["parent-id"], project.getComponents())
        if (!component) {
            return (
                <>不支持组件{data["parent-id"]}</>
            )
        }
        component = (component["optional"] as any[]).find(item => item["id"] == data["id"])
    } else {
        component = find_component(data["id"], project.getComponents())
    }
    if (!component) {
        return (
            <>不支持组件{data["id"]}</>
        )
    }

    const handleParameterChange = (key: string, event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(data.num, key, event.target.value)
    }

    const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(data.num, "", event.target.value)
    }

    const more: React.JSX.Element[] = []
    for (const key in data.params) {
        const component_param = get_param(component.params, key)
        if (component_param == null) {
            more.push(<label className="property">不支持字段 {key}</label>)
        } else {
            more.push(<label key={key} className="property">
                <span>{component_param.name}</span>
                <input placeholder={inputTypeTips.get(component_param.type)} data-type={component_param.type} value={data.params[key]} onChange={(event) => handleParameterChange(key, event)} />
            </label>)
        }
    }
    
    if (data.display == undefined) {
        data.display = ""
    }

    return (
        <>
            <label className="property">
                <span>显示</span>
                <input placeholder={component['name']} value={data.display} onChange={handleNameChange} />
            </label>
            {more}
        </>
    )
}

export default CodePaneAction