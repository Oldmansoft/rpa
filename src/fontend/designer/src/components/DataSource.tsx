import { TreeNode } from './TreeViewer'
import { communication } from '../components/Communication'

export const get_designer_file_tree_data = async (path: string) => {
    function get_list_data(datas: any): TreeNode[] {
        const result: TreeNode[] = []
        for (const data of datas) {
            const node: TreeNode = {
                name: data["name"],
                draggable: true
            }
            if ("children" in data) {
                node.icon = "icon-[mdi--folder]"
                node.children = get_list_data(data["children"])
            } else {
                const ext = data["name"].split(".").pop()
                if (ext == "proj") {
                    node.icon = "icon-[mdi--file]"
                } else if (ext == "scs") {
                    node.icon = "icon-[uil--file]"
                } else {
                    node.icon = "icon-[bx--file]"
                }
            }
            result.push(node)
        }
        return result
    }

    const datas = await communication.Executor.Designer.GetFileTree(path)
    return get_list_data(datas)
}

export const get_designer_component_datas = async () => {
    const datas = await communication.Executor.Designer.GetAllComponents()
    const result: TreeNode[] = []
    for (const data of datas) {
        if (data["category"] == "group") {
            const node: TreeNode = {
                name: data["name"],
                children: []
            }
            for (const item of data["list"]) {
                if (item["category"] == "item") {
                    node.children?.push({
                        name: item["name"]
                    })
                }
            }
            result.push(node)
        }
    }
    return result
}