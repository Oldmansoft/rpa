import { DragEvent } from "react"

export const TagName = {
    article: 'ARTICLE',
    code: 'CODE',
    main: 'MAIN',
    samp: 'SAMP',
    section: 'SECTION',
    hgroup: 'HGROUP',
    nav: 'NAV',
    aside: 'ASIDE'
}

function get_first_article_node(codeNode: HTMLElement) {
    const nodes = codeNode.children;
    if (!nodes || nodes.length == 0) {
        return null;
    }
    let first_node = nodes[0] as HTMLElement;
    while (first_node.tagName != TagName.article) {
        if (first_node.children.length == 0) {
            first_node = first_node.nextElementSibling as HTMLElement;
            if (first_node == null) {
                break;
            }
        } else {
            first_node = first_node.children[0] as HTMLElement
        }
    }
    return first_node;
}

function find_next_tag(node: HTMLElement, tag_name: string) {
    var next_node = node.nextElementSibling as HTMLElement;
    while (next_node == null || next_node.tagName != tag_name) {
        while (next_node == null) {
            node = node.parentNode as HTMLElement;
            if (node.tagName == TagName.main) {
                return null;
            }
            next_node = node.nextElementSibling as HTMLElement;
        }
        while (next_node.tagName != tag_name) {
            if (next_node.children.length == 0) {
                next_node = next_node.nextElementSibling as HTMLElement;
                if (next_node == null) {
                    break;
                }
            } else {
                next_node = next_node.children[0] as HTMLElement
            }
        }
    }
    return next_node;
}

function set_node_number(node: HTMLElement, number: number) {
    const aside = node.querySelector('aside')
    if (aside) {
        aside.textContent = number.toString();
    }
}

function get_current_aside_node(target: HTMLElement) {
    if (target.tagName == TagName.section) {
        return target.children[0] as HTMLElement;
    }
    return target;
}

function find_boundary_child(node: HTMLElement, boundary: HTMLElement) {
    var child_node = node;
    while (child_node.parentNode != boundary) {
        if (child_node.tagName == TagName.main) {
            return null
        }
        child_node = child_node.parentNode as HTMLElement
    }
    return child_node;
}

function drag_in_boundary(event: DragEvent, drag_mode: DragMode, boundary: HTMLElement, target_node: HTMLElement, drop_line: HTMLElement) {
    if (drag_mode != DragMode.boundary) return false

    var target_item = find_boundary_child(target_node, boundary)
    if (target_item == null) {
        if (event.clientY < boundary.getBoundingClientRect().y) {
            if (boundary.firstElementChild != drop_line) {
                boundary.prepend(drop_line)
            }
        } else if (event.clientY > boundary.getBoundingClientRect().y + boundary.getBoundingClientRect().height) {
            if (boundary.lastElementChild != drop_line) {
                boundary.append(drop_line)
            }
        }
    } else {
        if (event.clientY < target_item.getBoundingClientRect().y + target_item.getBoundingClientRect().height / 2) {
            var previous = target_item.previousElementSibling;
            if (previous == null || previous != drop_line) {
                target_item.before(drop_line)
            }
        } else {
            var next = target_item.nextElementSibling;
            if (next == null || next != drop_line) {
                target_item.after(drop_line)
            }
        }
    }

    return true;
}

export const mouse_in_node_top = (event: DragEvent, node: HTMLElement) => {
    return event.clientY < node.getBoundingClientRect().y + node.getBoundingClientRect().height / 2;
}

function drag_to_self(event: DragEvent, drag_object: HTMLElement, target_object: HTMLElement, drop_line: HTMLElement) {
    if (!drag_object.contains(target_object)) return false

    if (mouse_in_node_top(event, drag_object)) {
        var previous = drag_object.previousElementSibling;
        if (previous == null || previous != drop_line) {
            drag_object.before(drop_line)
        }
    } else {
        var next = drag_object.nextElementSibling;
        if (next == null || next != drop_line) {
            drag_object.after(drop_line)
        }
    }
    return true
}

export const find_previous_tag = (node: HTMLElement, tag_name: string) => {
    var previous_node = node.previousElementSibling as HTMLElement
    while (previous_node == null || previous_node.tagName != tag_name) {
        while (previous_node == null) {
            node = node.parentNode as HTMLElement
            if (node == null) {
                return null
            }
            if (node.tagName == TagName.main) {
                return null
            }
            previous_node = node.previousElementSibling as HTMLElement
        }
        while (previous_node.tagName != tag_name) {
            if (previous_node.children.length == 0) {
                previous_node = previous_node.previousElementSibling as HTMLElement
                if (previous_node == null) {
                    break
                }
            } else {
                previous_node = previous_node.children[previous_node.children.length - 1] as HTMLElement
            }
        }
    }
    return previous_node
}

export enum CodeChooseCategory {
    None = 0,
    Body = 1,
    Variable = 2,
    ParameterIn = 3,
    ParameterOut = 4
}

export interface CodeNodePosition {
    parentNum: number,
    index: number
}

class CodeNodeMove {
    source: CodeNodePosition | null
    target: CodeNodePosition

    constructor() {
        this.source = null
        this.target = {
            parentNum: 0,
            index: 0
        }
        
    }

    setTarget(parentNum: number, index: number) {
        this.target.parentNum = parentNum
        this.target.index = index
    }

    setSource(parentNum: number, index: number) {
        this.source = {
            parentNum: parentNum,
            index: index
        }
    }
}

export enum DragMode {
    empty,
    normal,
    boundary
}

class CodeDrager {
    private mode: DragMode
    private coder: HTMLElement | null
    private boundary: HTMLElement | null
    private source_node: HTMLElement | null
    private tree_id: string | null
    private dropLine: HTMLElement | null

    constructor() {
        this.mode = DragMode.empty
        this.coder = null
        this.boundary = null
        this.source_node = null
        this.tree_id = null
        this.dropLine = null
    }

    private getDataLineNum(node: Node | null) {
        return Number((node as HTMLElement).getAttribute("data-num"))
    }

    private getDataPositionIndex(node: Node | null) {
        if (node == null) {
            return -1
        }
        return Number((node as HTMLElement).getAttribute("data-index"))
    }

    init(coder: HTMLElement) {
        this.coder = coder
    }

    setDropLine(node: HTMLElement | null) {
        this.dropLine = node
    }

    start(node: HTMLElement) {
        this.mode = DragMode.normal
        this.source_node = node
    }

    start_choose(id: string) {
        this.mode = DragMode.normal
        this.tree_id = id
    }

    start_boundary(node: HTMLElement) {
        this.mode = DragMode.boundary
        this.boundary = node.parentNode as HTMLElement
        this.source_node = node
    }

    get_mode() {
        return this.mode
    }

    can_working(event: DragEvent, current_target: HTMLElement, drop_line: HTMLElement) {
        if (this.tree_id) return true
        if (this.source_node == null) return false
        if (drag_in_boundary(event, this.mode, this.boundary!, current_target, drop_line)) return false
        if (drag_to_self(event, this.source_node, current_target, drop_line)) return false
        return true
    }

    clear() {
        this.boundary = null
        this.source_node = null
        this.tree_id = null
    }

    finish() {
        if (this.dropLine == null || this.dropLine.parentElement?.tagName == TagName.code) {
            this.clear()
            return null
        }
        const result = new CodeNodeMove()
        if (this.source_node != null) {
            result.setSource(this.getDataLineNum(this.source_node.parentNode), this.getDataPositionIndex(this.source_node))
        }
        result.setTarget(this.getDataLineNum(this.dropLine.parentNode), this.getDataPositionIndex(this.dropLine.previousElementSibling))
        this.coder!.after(this.dropLine)
        this.clear()
        return result
    }

    resetDropLine() {
        if (this.dropLine != null) {
            this.coder!.after(this.dropLine)
        }
    }
}

export const codeDrager = new CodeDrager()

export const make_numbers = (codeNode: HTMLElement) => {
    const firstNode = get_first_article_node(codeNode)
    if (firstNode == null) {
        return
    }
    set_node_number(firstNode, 1)

    let number = 1
    let node = find_next_tag(firstNode, TagName.article)
    while (node != null) {
        node = get_current_aside_node(node)
        number++
        set_node_number(node, number)
        node = find_next_tag(node, TagName.article)
    }
    codeNode.style.setProperty('--AsideLeft', '-' + (number.toString().length * 8 + 7) + 'px')
}