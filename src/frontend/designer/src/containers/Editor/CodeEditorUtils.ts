import { Counter } from "../../components/Utils"
import { CodeChooseCategory, TagName } from "./Utils"

export { find_component, find_node_from_data, set_data_num_index }

export function isItemArticle(node: HTMLElement): boolean {
    return !node.classList.contains("label")
}

export function isFooterArticle(node: HTMLElement): boolean {
    return node.classList.contains("footer")
}

export function isHeaderArticle(node: HTMLElement): boolean {
    const parentNode = node.parentElement as HTMLElement
    return parentNode.tagName == TagName.section && parentNode.classList.contains("header")
}

export function isBoundaryArticle(node: HTMLElement): boolean {
    return (node.parentNode!.parentNode as HTMLElement).tagName == TagName.nav
}

export function isLastSectionArticle(node: HTMLElement): boolean {
    const parentNode = node.parentElement as HTMLElement
    return parentNode.tagName == TagName.section && !parentNode.classList.contains("header")
}

export function setChosen(node: HTMLElement | null): void {
    const nodes = document.querySelectorAll("code .chosen")
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].classList.remove("chosen")
    }
    if (node != null) {
        node.classList.add("chosen")
    }
}

function find_component(id: string, list: any): any {
    for (const item of list) {
        if (item["category"] == "item") {
            if (item["id"] == id) return item
        } else if (item["list"]) {
            const found = find_component(id, item["list"])
            if (found) return found
        }
    }
    return null
}

function find_node_from_data(data: any, findNum: number): any | null {
    for (const children of data["body"]) {
        if (children["num"] == findNum) return children
        if ("body" in children) {
            const result = find_node_from_data(children, findNum)
            if (result != null) return result
        }
        if ("optional" in children) {
            for (const optional of children["optional"]) {
                if (optional["num"] == findNum) return optional
                const result = find_node_from_data(optional, findNum)
                if (result != null) return result
            }
        }
        if ("last" in children) {
            if (children["last"]["num"] == findNum) return children["last"]
            const result = find_node_from_data(children["last"], findNum)
            if (result != null) return result
        }
    }
    return null
}

function set_data_num_index(datas: any[], counter: Counter): void {
    let index = 0
    for (const data of datas) {
        data["num"] = counter.next()
        data["index"] = index++
        if ("body" in data) {
            set_data_num_index(data["body"], counter)
        }
        if ("optional" in data) {
            for (const optional of data["optional"]) {
                optional["num"] = counter.next()
                optional["parent-id"] = data["id"]
                set_data_num_index(optional["body"], counter)
            }
        }
        if ("last" in data) {
            const last = data["last"]
            last["num"] = counter.next()
            last["parent-id"] = data["id"]
            set_data_num_index(last["body"], counter)
        }
        if ("body" in data || "optional" in data) {
            data["last-num"] = counter.next()
        }
    }
}

export const VAR_ITEM_EMPTY = { name: "", value: "" }

export function getVarListByCategory(content: any, category: CodeChooseCategory): any[] {
    if (category == CodeChooseCategory.Variable) return content["local"]
    if (category == CodeChooseCategory.ParameterIn) return content["parameter"]["in"]
    return content["parameter"]["out"]
}

export const DRAG_KEY_TO_CATEGORY: Record<string, CodeChooseCategory> = {
    "variable": CodeChooseCategory.Variable,
    "parameter-in": CodeChooseCategory.ParameterIn,
    "parameter-out": CodeChooseCategory.ParameterOut,
}

const MOVE_TARGETS: { category: CodeChooseCategory; label: string }[][] = [
    [
        { category: CodeChooseCategory.ParameterIn, label: "入参" },
        { category: CodeChooseCategory.ParameterOut, label: "出参" },
    ],
    [
        { category: CodeChooseCategory.Variable, label: "变量" },
        { category: CodeChooseCategory.ParameterOut, label: "出参" },
    ],
    [
        { category: CodeChooseCategory.ParameterIn, label: "入参" },
        { category: CodeChooseCategory.Variable, label: "变量" },
    ],
]

export function getMoveTargetsForCategory(category: CodeChooseCategory): { category: CodeChooseCategory; label: string }[] {
    if (category == CodeChooseCategory.ParameterIn) return MOVE_TARGETS[0]
    if (category == CodeChooseCategory.ParameterOut) return MOVE_TARGETS[1]
    return MOVE_TARGETS[2]
}
