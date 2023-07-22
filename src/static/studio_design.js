var TagName = {
    article: 'ARTICLE',
    section: 'SECTION'
}
var ClassName = {
    editor: 'editor'
}

function section_drag_to_self(drag_object, target_object) {
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
    var line_previous_node = get_previous_node(line);
    if (line_previous_node == null) return null;
    var target_previous_node = get_previous_node(target);
    if (target_previous_node == null) return null;
    var line_previous_number = get_node_number(line_previous_node);
    var target_previous_number = get_node_number(target_previous_node);
    if (line_previous_number > target_previous_number) {
        return target_previous_node;
    } else {
        return line_previous_node;
    }
}

function get_previous_node(node) {
    var previous_node = node.previousElementSibling;
    while (previous_node == null || previous_node.tagName != TagName.article) {
        while (previous_node == null) {
            node = node.parentNode;
            if (node.classList.contains(ClassName.editor)) {
                return null;
            }
            previous_node = node.previousElementSibling;
        }
        while (previous_node.tagName != TagName.article) {
            if (previous_node.children == 0) {
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

function get_next_node(node) {
    var next_node = node.nextElementSibling;
    while (next_node == null || next_node.tagName != TagName.article) {
        while (next_node == null) {
            node = node.parentNode;
            if (node.classList.contains(ClassName.editor)) {
                return null;
            }
            next_node = node.nextElementSibling;
        }
        while (next_node.tagName != TagName.article) {
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

function get_first_node() {
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

function make_numbers(target) {
    var start_node = target;
    var start_number;
    if (start_node == null) {
        start_number = 1;
        start_node = get_first_node();
        if (start_node == null) return;
        set_node_number(start_node, start_number);
    } else {
        start_number = get_node_number(start_node);
    }

    var number = start_number;
    var node = get_next_node(start_node);
    while (node != null) {
        node = get_current_aside_node(node);
        number++;
        set_node_number(node, number);
        node = get_next_node(node);
    }
    document.querySelector('.editor').style.setProperty('--AsideLeft', '-' + (number.toString().length * 8 + 7) + 'px');
}

$(function() {
    var drag_target = null;
    var drop_line = document.querySelector('#drop_line');

    $('article').on('dragend', function() {
        var drop_result = drop_line.previousElementSibling != drag_target && drop_line.nextElementSibling != drag_target;
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
        drag_target = this;
    })
    $('section>article.label').on('dragstart', function() {
        drag_target = this.parentNode.parentNode;
    });
    $('article.label.footer').on('dragstart', function() {
        drag_target = this.parentNode;
    });
    $('.editor').on('dragenter', function(e) {
        e.preventDefault();
    }).on('dragover', function(e) {
        e.preventDefault();
    });
    $('article.item').on('dragover', function(e) {
        if (section_drag_to_self(drag_target, e.currentTarget)) return;

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
    }).on('click', function(e) {
        this.classList.add('chosen');
    });
    $('section.header>article.label').on('dragover', function(e) {
        if (section_drag_to_self(drag_target, e.currentTarget)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var previous = e.currentTarget.previousElementSibling;
            if (previous == null || previous != drop_line) {
                $(e.currentTarget.parentNode.parentNode).before(drop_line);
            }
        } else {
            var next = e.currentTarget.nextElementSibling;
            if (next == null || next != drop_line) {
                e.currentTarget.nextElementSibling.prepend(drop_line);
            }
        }
    });
    $('article.label.footer').on('dragover', function(e) {
        if (section_drag_to_self(drag_target, e.currentTarget)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var previous = e.currentTarget.previousElementSibling;
            if (previous == null || previous != drop_line) {
                e.currentTarget.previousElementSibling.children[1].append(drop_line);
            }
        } else {
            var next = e.currentTarget.nextElementSibling;
            if (next == null || next != drop_line) {
                $(e.currentTarget.parentNode).after(drop_line);
            }
        }
    });
    $('.editor').on('mousedown', function() {
        var nodes = document.querySelectorAll('.editor .chosen');
        for (var i=0; i<nodes.length; i++) {
            nodes[i].classList.remove('chosen');
        }
    });
    $('section:first-child>article.label').on('mouseup', function() {
        this.parentNode.parentNode.classList.add('chosen');
    });
    $('section:not(:first-child)>article.label').on('mouseup', function() {
        this.parentNode.classList.add('chosen');
    });
    $('article.label.footer').on('mouseup', function() {
        this.parentNode.classList.add('chosen');
    });
});