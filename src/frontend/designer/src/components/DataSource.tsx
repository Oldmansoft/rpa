import { TreeNode } from './TreeViewer'
import { communication } from '../components/Communication'

export const get_designer_file_tree_data = async (name: string, path: string) => {
    function get_list_data(datas: any): TreeNode[] {
        const result: TreeNode[] = []
        for (const data of datas) {
            const node: TreeNode = {
                id: data["name"],
                name: data["name"],
                draggable: true
            }
            if ("children" in data) {
                node.icon = "icon-[entypo--folder]"
                node.iconColor = "#ffd900"
                node.children = get_list_data(data["children"])
            } else {
                const ext = data["name"].split(".").pop()
                if (ext == "proj") {
                    node.name = data["name"].split(".")[0]
                    node.icon = "icon-[uil--file]"
                } else if (ext == "scs") {
                    node.name = data["name"].split(".")[0]
                    node.icon = "icon-[mdi--file]"
                } else {
                    node.icon = "icon-[bx--file]"
                }
            }
            result.push(node)
        }
        return result
    }

    const datas = await communication.Executor.Designer.GetFileTree(path)
    console.log(datas)
    const result: TreeNode[] = [{
        id: "",
        name: name,
        draggable: false,
        icon: "icon-[mdi--file]",
        iconColor: "#ffd900",
        children: get_list_data(datas)
    }]

    return result
}

export const get_designer_components_raw_and_tree = async () => {
    const datas = await communication.Executor.Designer.GetAllComponents()
    const result: TreeNode[] = []
    for (const data of datas) {
        if (data["category"] == "group") {
            const node: TreeNode = {
                id: data["id"],
                name: data["name"],
                children: []
            }
            for (const item of data["list"]) {
                if (item["category"] == "item") {
                    node.children?.push({
                        id: item["id"],
                        name: item["name"]
                    })
                }
            }
            result.push(node)
        }
    }
    return [datas, result]
}