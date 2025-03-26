import { DragEvent } from "react"

export const TagName = {
    article: 'ARTICLE',
    code: 'CODE',
    main: 'MAIN',
    section: 'SECTION',
    hgroup: 'HGROUP',
    nav: 'NAV'
}

export const get_element_parents_from_tag = (element: HTMLElement, tag_name: string) => {
    while (element.tagName != tag_name) {
        if (element.tagName == TagName.code) {
            return null
        }
        element = element.parentNode as HTMLElement;
    }
    return element;
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
            if (node.tagName == TagName.code) {
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
        if (child_node.tagName == TagName.code) {
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
            if (node.tagName == TagName.code) {
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

function get_node_number(node: HTMLElement) {
    return Number(node.querySelector('aside')!.textContent)
}

function get_renumber_start_node(line: HTMLElement, target: HTMLElement) {
    var line_previous_node = find_previous_tag(line, TagName.article)
    var target_previous_node = find_previous_tag(target, TagName.article)
    if (target_previous_node == null || line_previous_node == null) return null

    var line_previous_number = get_node_number(line_previous_node)
    var target_previous_number = get_node_number(target_previous_node)
    if (line_previous_number > target_previous_number) {
        return target_previous_node
    } else {
        return line_previous_node
    }
}

class CodeProperty {
    clear = function () {
        
    }
    create_panel = function (_: any) {
    }
}

const codeProperty = new CodeProperty()

class CodeChoose {
    clear(click_node: HTMLElement | null) {
        const nodes = document.querySelectorAll('code .chosen')
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i] == click_node) {
                return
            }
            nodes[i].classList.remove("chosen")
        }
        codeProperty.clear()
    }

    choose(_: HTMLElement) {

    }
}

const codeChoose = new CodeChoose()

enum DragMode {
    empty,
    normal,
    boundary
}

class CodeDrager {
    private mode: DragMode
    private coder: HTMLElement | null
    private boundary: HTMLElement | null
    private target: HTMLElement | null
    private choose_id: string | null
    private when_finish_choose: boolean
    private dropLine: HTMLElement | null

    constructor() {
        this.mode = DragMode.empty
        this.coder = null
        this.boundary = null
        this.target = null
        this.choose_id = null
        this.when_finish_choose = false
        this.dropLine = null
    }

    init(coder:HTMLElement) {
        this.coder = coder
    }

    setDropLine(node: HTMLElement | null) {
        this.dropLine = node
    }

    start(node: HTMLElement) {
        this.mode = DragMode.normal
        this.target = node
        this.when_finish_choose = false
    }

    start_choose(id: string) {
        this.mode = DragMode.normal
        this.choose_id = id
        this.when_finish_choose = true
    }

    start_boundary(node: HTMLElement) {
        this.mode = DragMode.boundary
        this.boundary = node.parentNode as HTMLElement
        this.target = node
    }

    can_working(event: DragEvent, current_target: HTMLElement, drop_line: HTMLElement) {
        if (this.choose_id) return true
        if (this.target == null) return false
        if (drag_in_boundary(event, this.mode, this.boundary!, current_target, drop_line)) return false
        if (drag_to_self(event, this.target, current_target, drop_line)) return false
        return true
    }
    finish() {
        if (this.dropLine == null) {
            return
        }
        let drop_result = false
        if (this.target != null) {
            drop_result = this.dropLine.previousElementSibling != this.target && this.dropLine.nextElementSibling != this.target && this.dropLine.previousElementSibling!.tagName != TagName.code
            let renumber_node
            if (drop_result) {
                renumber_node = get_renumber_start_node(this.dropLine, this.target!)
                this.dropLine.after(this.target!)
                if (this.when_finish_choose) {
                    codeChoose.choose(this.target!)
                }
            }
        }
        document.querySelector("code")!.after(this.dropLine)
        this.boundary = null
        this.target = null
        this.choose_id = null
        if (drop_result) {
            make_numbers(this.coder!)
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