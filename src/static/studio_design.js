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
    if (target.tagName == 'SECTION') {
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

function get_previous_node(current) {
    var previous_node = null;
    if (current.previousElementSibling != null) {
        previous_node = current.previousElementSibling;
    } else if (current.parentNode.tagName == 'MAIN') {
        previous_node = current.parentNode.previousElementSibling;
    }
    if (previous_node == null) {
        return null;
    }
    if (previous_node.classList.contains('container')) {
        return previous_node.children[previous_node.children.length - 1];
    }
    return previous_node;
}

function get_next_node(target) {
    var nextElementSibling;
    if (target.classList.contains('header')) {
        if (target.nextElementSibling.children.length > 0) {
            nextElementSibling = target.nextElementSibling.children[0];
        } else {
            // footer
            nextElementSibling = target.nextElementSibling.nextElementSibling;
        }
    } else if (target.classList.contains('footer')) {
        var container = target.parentNode;
        if (container.nextElementSibling != null) {
            nextElementSibling = container.nextElementSibling;
        } else if (container.parentNode.classList.contains('editor')) {
            return null;  
        } else {
            // footer
            nextElementSibling = container.parentNode.nextElementSibling;
        }
    } else {
        nextElementSibling = target.nextElementSibling;
    }
    if (nextElementSibling != null) {
        if (nextElementSibling.classList.contains('container')) {
            return nextElementSibling.children[0];
        }
        return nextElementSibling;
    }
    if (target.parentNode.tagName == 'MAIN') {
        // footer
        return target.parentNode.nextElementSibling;
    }
    return null;
}

function get_first_node() {
    var nodes = document.querySelector('.editor').children;
    if (nodes.length == 0){
        return null;
    }
    if (nodes[0].classList.contains('container')) {
        return nodes[0].children[0];
    }
    return nodes[0];
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
        console.info(node);
        node = get_current_aside_node(node);
        number++;
        set_node_number(node, number);
        node = get_next_node(node);
    }
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
    $('article.label').on('dragstart', function() {
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
    $('article.label.header').on('dragover', function(e) {
        if (section_drag_to_self(drag_target, e.currentTarget)) return;

        if (window.event.clientY < e.currentTarget.getBoundingClientRect().y + e.currentTarget.getBoundingClientRect().height / 2) {
            var previous = e.currentTarget.previousElementSibling;
            if (previous == null || previous != drop_line) {
                $(e.currentTarget.parentNode).before(drop_line);
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
                e.currentTarget.previousElementSibling.append(drop_line);
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
    $('article.label').on('mouseup', function() {
        this.parentNode.classList.add('chosen');
    });
});