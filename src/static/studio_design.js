var TagName = {
    article: 'ARTICLE',
    section: 'SECTION',
    main: 'MAIN'
}
var ClassName = {
    editor: 'editor',
    item: 'item',
    label: 'label',
    chosen: 'chosen',
    container: 'container'
}
var DragMode = {
    normal: 0,
    boundary: 1,
}

function drag_to_self(drag_object, target_object, drop_line) {
    if (!$.contains(drag_object, target_object)) return false;

    if (window.event.clientY < drag_object.getBoundingClientRect().y + drag_object.getBoundingClientRect().height / 2) {
        var previous = drag_object.previousElementSibling;
        if (previous == null || previous != drop_line) {
            $(drag_object).before(drop_line);
        }
    } else {
        var next = drag_object.nextElementSibling;
        if (next == null || next != drop_line) {
            $(drag_object).after(drop_line);
        }
    }
    return true;
}

function drag_in_boundary(drag_mode, boundary, target_node, drop_line) {
    if (drag_mode != DragMode.boundary) return false;

    var target_item = find_boundary_child(target_node, boundary);
    if (target_item == null) {
        if (window.event.clientY < boundary.getBoundingClientRect().y) {
            if (boundary.firstElementChild != drop_line) {
                boundary.prepend(drop_line);
            }
        } else if (window.event.clientY > boundary.getBoundingClientRect().y + boundary.getBoundingClientRect().height) {
            if (boundary.lastElementChild != drop_line) {
                boundary.append(drop_line);
            }
        }
    } else {
        if (window.event.clientY < target_item.getBoundingClientRect().y + target_item.getBoundingClientRect().height / 2) {
            var previous = target_item.previousElementSibling;
            if (previous == null || previous != drop_line) {
                $(target_item).before(drop_line);
            }
        } else {
            var next = target_item.nextElementSibling;
            if (next == null || next != drop_line) {
                $(target_item).after(drop_line);
            }
        }
    }

    return true;
}

function find_boundary_child(node, boundary) {
    var child_node = node;
    while (child_node.parentNode != boundary) {
        if (child_node.classList.contains(ClassName.editor)) {
            return null;
        }
        child_node = child_node.parentNode;
    }
    return child_node;
}

function get_current_aside_node(target) {
    if (target.tagName == TagName.section) {
        return target.children[0];
    }
    return target;
}

function get_node_number(node) {
    return Number(node.querySelector('aside').textContent);
}

function set_node_number(node, number) {
    node.querySelector('aside').textContent = number.toString();
}

function get_renumber_start_node(line, target) {
    var line_previous_node = find_previous_tag(line, TagName.article);
    if (line_previous_node == null) return null;
    var target_previous_node = find_previous_tag(target, TagName.article);
    if (target_previous_node == null) return null;
    var line_previous_number = get_node_number(line_previous_node);
    var target_previous_number = get_node_number(target_previous_node);
    if (line_previous_number > target_previous_number) {
        return target_previous_node;
    } else {
        return line_previous_node;
    }
}

function find_previous_tag(node, tag_name) {
    var previous_node = node.previousElementSibling;
    while (previous_node == null || previous_node.tagName != tag_name) {
        while (previous_node == null) {
            node = node.parentNode;
            if (node.classList.contains(ClassName.editor)) {
                return null;
            }
            previous_node = node.previousElementSibling;
        }
        while (previous_node.tagName != tag_name) {
            if (previous_node.children.length == 0) {
                previous_node = previous_node.previousElementSibling;
                if (previous_node == null) {
                    break;
                }
            } else {
                previous_node = previous_node.children[previous_node.children.length - 1];
            }
        }
    }
    return previous_node;
}

function find_next_tag(node, tag_name) {
    var next_node = node.nextElementSibling;
    while (next_node == null || next_node.tagName != tag_name) {
        while (next_node == null) {
            node = node.parentNode;
            if (node.classList.contains(ClassName.editor)) {
                return null;
            }
            next_node = node.nextElementSibling;
        }
        while (next_node.tagName != tag_name) {
            if (next_node.children.length == 0) {
                next_node = next_node.nextElementSibling;
                if (next_node == null) {
                    break;
                }
            } else {
                next_node = next_node.children[0]
            }
        }
    }
    return next_node;
}

function get_first_article_node() {
    var nodes = document.querySelector('.editor').children;
    if (nodes.length == 0) {
        return null;
    }
    var first_node = nodes[0];
    while (first_node.tagName != TagName.article) {
        if (first_node.children.length == 0) {
            first_node = first_node.nextElementSibling;
            if (first_node == null) {
                break;
            }
        } else {
            first_node = first_node.children[0]
        }
    }
    return first_node;
}

function find_chosen_content_node(node) {
    var article_node = node;
    while (!article_node.classList.contains(ClassName.item) && !article_node.classList.contains(ClassName.label)) {
        if (article_node.classList.contains(ClassName.editor)) {
            return null;
        }
        article_node = article_node.parentNode;
    }
    var invalidNode = article_node
    while (invalidNode.tagName == TagName.section || invalidNode.tagName == TagName.article || invalidNode.classList.contains(ClassName.container)) {
        if (invalidNode.classList.contains(ClassName.chosen)){
            return invalidNode;
        }
        invalidNode = invalidNode.parentNode;
    }
    return null;
}

function make_numbers(target) {
    var start_node = target;
    var start_number;
    if (start_node == null) {
        start_number = 1;
        start_node = get_first_article_node();
        if (start_node == null) return;
        set_node_number(start_node, start_number);
    } else {
        start_number = get_node_number(start_node);
    }

    var number = start_number;
    var node = find_next_tag(start_node, TagName.article);
    while (node != null) {
        node = get_current_aside_node(node);
        number++;
        set_node_number(node, number);
        node = find_next_tag(node, TagName.article);
    }
    document.querySelector('.editor').style.setProperty('--AsideLeft', '-' + (number.toString().length * 8 + 7) + 'px');
}

$(function() {
    var drag_target = null;
    var drag_mode = DragMode.normal;
    var drag_boundary = null;
    var drop_line = document.querySelector('#drop_line');

    $('article').on('dragend', function() {
        var drop_result = drop_line.previousElementSibling != drag_target && drop_line.nextElementSibling != drag_target && drop_line.previousElementSibling != document.querySelector('.editor');
        var renumber_node;
        if (drop_result) {
            renumber_node = get_renumber_start_node(drop_line, drag_target);
            $(drop_line).after(drag_target);
        }
        $('.editor').after(drop_line);
        drag_target = null;
        if (drop_result){
            make_numbers(renumber_node);
        }
    });

    $('article.item').on('dragstart', function() {
        drag_mode = DragMode.normal;
        drag_target = this;
    })
    $('section.header>article.label').on('dragstart', function() {
        drag_mode = DragMode.normal;
        drag_target = this.parentNode.parentNode;
    });
    $('article.label.footer').on('dragstart', function() {
        drag_mode = DragMode.normal;
        drag_target = this.parentNode;
    });
    $('.boundary>section>article.label').on('dragstart', function(e) {
        drag_mode = DragMode.boundary;
        drag_boundary = e.currentTarget.parentNode.parentNode;
        drag_target = e.currentTarget.parentNode;
    });

    $('.editor').on('dragenter', function(e) {
        e.preventDefault();
    }).on('dragover', function(e) {
        e.preventDefault();
    });
    $('article.item').on('dragover', function(e) {
        if (drag_target == null) return;
        if (drag_in_boundary(drag_mode, drag_boundary, e.currentTarget, drop_line)) return;
        if (drag_to_self(drag_target, e.currentTarget, drop_line)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var previous = e.currentTarget.previousElementSibling;
            if (previous == null || previous != drop_line) {
                $(e.currentTarget).before(drop_line);
            }
        } else {
            var next = e.currentTarget.nextElementSibling;
            if (next == null || next != drop_line) {
                $(e.currentTarget).after(drop_line);
            }
        }
    });
    $('section.header>article.label').on('dragover', function(e) {
        if (drag_target == null) return;
        if (drag_in_boundary(drag_mode, drag_boundary, e.currentTarget, drop_line)) return;
        if (drag_to_self(drag_target, e.currentTarget, drop_line)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var previous = e.currentTarget.parentNode.parentNode.previousElementSibling;
            if (previous == null || previous != drop_line) {
                $(e.currentTarget.parentNode.parentNode).before(drop_line);
            }
        } else {
            var main_node = e.currentTarget.nextElementSibling;
            if (main_node.children.length == 0 || main_node.firstElementChild != drop_line) {
                main_node.prepend(drop_line);
            }
        }
    });
    $('section:not(.header)>article.label').on('dragover', function(e) {
        if (drag_target == null) return;
        if (drag_in_boundary(drag_mode, drag_boundary, e.currentTarget, drop_line)) return;
        if (drag_to_self(drag_target, e.currentTarget, drop_line)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var main_node = find_previous_tag(e.currentTarget, TagName.main);
            if (main_node.children.length == 0 || main_node.lastElementChild != drop_line) {
                main_node.append(drop_line);
            }
        } else {
            var main_node = e.currentTarget.nextElementSibling;
            if (main_node.children.length == 0 || main_node.firstElementChild != drop_line) {
                main_node.prepend(drop_line);
            }
        }
    });
    $('article.label.footer').on('dragover', function(e) {
        if (drag_target == null) return;
        if (drag_in_boundary(drag_mode, drag_boundary, e.currentTarget, drop_line)) return;
        if (drag_to_self(drag_target, e.currentTarget, drop_line)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var main_node = find_previous_tag(e.currentTarget, TagName.main);
            if (main_node.children.length == 0 || main_node.lastElementChild != drop_line) {
                main_node.append(drop_line);
            }
        } else {
            var next = e.currentTarget.parentNode.nextElementSibling;
            if (next == null || next != drop_line) {
                $(e.currentTarget.parentNode).after(drop_line);
            }
        }
    });
    $('.editor').on('mousedown', function(e) {
        var click_node = find_chosen_content_node(e.target);
        var nodes = document.querySelectorAll('.editor .chosen');
        for (var i=0; i<nodes.length; i++) {
            if (nodes[i] == click_node) {
                continue;
            }
            nodes[i].classList.remove(ClassName.chosen);
        }
    });
    $('article.item').on('mouseup', function(e) {
        this.classList.add(ClassName.chosen);
    });
    $('section.header>article.label').on('mouseup', function() {
        this.parentNode.parentNode.classList.add(ClassName.chosen);
    });
    $('section:not(.header)>article.label').on('mouseup', function() {
        this.parentNode.classList.add(ClassName.chosen);
    });
    $('article.label.footer').on('mouseup', function() {
        this.parentNode.classList.add(ClassName.chosen);
    });
});