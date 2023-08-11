if (!window.studio) window.studio = {};
studio.config = {}
studio.constant = {}

studio.config.InputTypeTips = {
    Variable: '变量名称',
    Expression: '条件表达式',
    Format: '字符串格式化内容',
    String: '字符串'
}

studio.constant.TagName = {
    article: 'ARTICLE',
    section: 'SECTION',
    main: 'MAIN'
}
studio.constant.ClassName = {
    editor: 'editor',
    item: 'item',
    label: 'label',
    chosen: 'chosen',
    container: 'container',
    header: 'header',
    footer: 'footer',
    boundary: 'boundary'
}
studio.constant.DragMode = {
    normal: 0,
    boundary: 1,
}

function create_format_code_node(text) {
    var result = document.createDocumentFragment();
    if (text == '') {
        var node = document.createElement('var');
        node.textContent = '[空字符串]'
        result.append(node);
        return result;
    }
    var last_index = 0;
    var matches = text.matchAll(/(\{.*?\})|\\n/g);
    for (var match of matches) {
        if (match.index > last_index) {
            var node = document.createElement('span');
            node.textContent = text.substring(last_index, match.index);
            result.append(node);
        }

        node = document.createElement('var');
        node.textContent = match[0];
        result.append(node);

        last_index = match.index + match[0].length;
    }
    if (last_index < text.length) {
        var node = document.createElement('span');
        node.textContent = text.substring(last_index);
        result.append(node);
    }
    console.info(result.childNodes, result.children);
    return result;
}

var content_node_creator = {
    'Variable': function (text) {
        var result = document.createElement('var');
        text = text.trim();
        if (text == '') {
            result.textContent = '[请填写]';
            result.classList.add('error');
        } else {
            result.textContent = text;
        }
        return result;
    },
    'Format': function (text) {
        var result = document.createElement('code');
        result.append(create_format_code_node(text));
        return result;
    },
    'Expression': function (text) {
        var result = document.createElement('var');
        text = text.trim();
        if (text == '') {
            result.textContent = '[请填写]';
            result.classList.add('error');
        } else {
            result.textContent = text;
        }
        return result;
    }
}

function create_description_format_node(text, values) {
    var result = document.createDocumentFragment();
    var last_index = 0;
    var matches = text.matchAll(/\{\w+\}/g);
    for (var match of matches) {
        if (match.index > last_index) {
            var node = document.createElement('span');
            node.textContent = text.substring(last_index, match.index);
            result.append(node);
        }
        if (match[0] in values) {
            result.append(content_node_creator[values[match[0]].type](values[match[0]].value));
        } else {
            node = document.createElement('var');
            node.textContent = match[0];
            result.append(node);
        }
        last_index = match.index + match[0].length;
    }
    if (last_index < text.length) {
        var node = document.createElement('span');
        node.textContent = text.substring(last_index);
        result.append(node);
    }
    return result;
}

studio.designer = new (function () {
    this.Action = function (data) {
        function create_data(source) {
            var result = JSON.parse(JSON.stringify(source))
            result['display'] = result['name'];
            for (var i in result['params']) {
                result['params'][i]['value'] = '';
            }
            return result;
        }
        function create_node_article(data, action, class_name) {
            var node = document.createElement('article');
            node.setAttribute('class', class_name);
            node.setAttribute('draggable', 'true');
            var ul = document.createElement('ul');
            node.append(ul);
            var li = document.createElement('li');
            ul.append(li);
            var aside = document.createElement('aside');
            li.append(aside);
            var i = document.createElement('i');
            li.append(i);
            i.setAttribute('class', 'font i-' + data['id']);
            li = document.createElement('li');
            ul.append(li);
            var h4 = document.createElement('h4');
            li.append(h4);
            h4.append(data['name']);

            node.data_context = action;
            if (action && 'format' in action.data) {
                var p = document.createElement('p');
                li.append(p);
                refresh_description(p, action);
            }
            return node;
        }
        function create_node(data, action) {
            if (data['type'] == 'unit') {
                return create_node_article(data, action, 'item');
            } else {
                var node = document.createElement('div');
                node.classList.add('container');
                node.classList.add(data['id']);
                var section = document.createElement('section');
                section.classList.add('header');
                node.append(section);
                section.append(create_node_article(data, action, 'label'));
                section.append(document.createElement('main'));
                node.append(create_node_article({'id': 'flag', 'name': 'End'}, null, 'label footer'));
                return node;
            }
        }
        function refresh_description(area, action) {
            while (area.hasChildNodes()) {
                area.lastChild.remove();
            }
            var values = {}
            for (var i in action.data.params) {
                values['{' + action.data.params[i]['id'] + '}'] = {
                    type: action.data.params[i]['type'],
                    value: action.data.params[i]['value']
                };
            }
            area.append(create_description_format_node(action.data['format'], values));
        }
        var $Action = this;

        this.data = create_data(data);
        this.node = create_node(data, this);
        this.set_param = function (key, value) {
            for (var i in this.data['params']) {
                var item = this.data['params'][i];
                if (item['id'] == key) {
                    item['value'] = value;
                    if ('format' in this.data) {
                        refresh_description(this.node.querySelector('p'), this);
                    }
                    return;
                }
            }
        }
        this.set_display = function (display) {
            this.data['display'] = display;
            if (display == '') display = this.data['name'];
            this.node.querySelector('h4').textContent = display.replaceAll(' ', '\u00A0');
        }
        this.create_property_panel = function (area) {
            var label = document.createElement('label');
            var span = document.createElement('span');
            span.textContent = '显示';
            label.append(span);
            var input = document.createElement('input');
            input.setAttribute('value', this.data['display']);
            input.addEventListener('change', function (e) {
                e.currentTarget.value = e.currentTarget.value.trim();
                $Action.set_display(e.currentTarget.value);
            });
            label.append(input);
            area.append(label);
            for (var i in this.data['params']) {
                var item = this.data['params'][i];
                label = document.createElement('label');
                span = document.createElement('span');
                span.textContent = item['name'];
                label.append(span);
                input = document.createElement('input');
                input.setAttribute('name', item['id']);
                input.setAttribute('type', item['type']);
                input.setAttribute('value', item['value']);
                input.setAttribute('placeholder', studio.config.InputTypeTips[item['type']]);
                input.addEventListener('change', function (e) {
                    $Action.set_param(e.currentTarget.getAttribute('name'), e.currentTarget.value);
                });
                label.append(input);
                area.append(label);
            }
        }
    }

    this.drag = new (function () {
        var mode = null,
            boundary = null,
            target = null,
            when_finish_choose = false;

        this.start = function (node) {
            mode = studio.constant.DragMode.normal;
            target = node;
            when_finish_choose = false;
        }
        this.start_choose = function (node) {
            mode = studio.constant.DragMode.normal;
            target = node;
            when_finish_choose = true;
        }
        this.start_boundary = function (node) {
            mode = studio.constant.DragMode.boundary;
            boundary = node.parentNode;
            target = node;
        }
        this.is_working = function (current_target) {
            if (target == null) return false;
            if (drag_in_boundary(mode, boundary, current_target, drop_line)) return false;
            if (drag_to_self(target, current_target, drop_line)) return false;
            return true;
        }
        this.finish = function () {
            var drop_line = document.querySelector('#drop_line');
            var drop_result = drop_line.previousElementSibling != target && drop_line.nextElementSibling != target && drop_line.previousElementSibling != document.querySelector('.editor');
            var renumber_node;
            if (drop_result) {
                renumber_node = get_renumber_start_node(drop_line, target);
                $(drop_line).after(target);
                if (when_finish_choose) {
                    studio.designer.editor.chosen.choose(target);
                }
            }
            $('.editor').after(drop_line);
            boundary = null;
            target = null;
            if (drop_result) {
                make_numbers(renumber_node);
            }
        }
    })();
    this.editor = new (function () {
        this.chosen = new (function () {
            $chosen = this;
            this.clear = function (click_node) {
                var nodes = document.querySelectorAll('.editor .chosen');
                for (var i = 0; i < nodes.length; i++) {
                    if (nodes[i] == click_node) {
                        return;
                    }
                    nodes[i].classList.remove(studio.constant.ClassName.chosen);
                }
                studio.designer.property.clear();
            }
            this.choose = function (node) {
                if (node == null) {
                    return;
                }
                var target_node = null;
                if (node.classList.contains(studio.constant.ClassName.item)) {
                    target_node = node;
                } else if (node.classList.contains(studio.constant.ClassName.footer)) {
                    target_node = node.parentNode;
                } else if (node.parentNode.classList.contains(studio.constant.ClassName.header)) {
                    target_node = node.parentNode.parentNode;
                } else if (node.parentNode.tagName == studio.constant.TagName.section && !node.parentNode.classList.contains(studio.constant.ClassName.header)) {
                    target_node = node.parentNode;
                }

                if (target_node == null || target_node.classList.contains(studio.constant.ClassName.chosen)) {
                    return;
                }
                $chosen.clear();
                target_node.classList.add(studio.constant.ClassName.chosen);

                studio.designer.property.create_panel(node);
            }
        })();
    })();
    this.property = new (function () {
        this.clear = function () {
            var area = document.querySelector('.studio>.other>.right');
            while (area.hasChildNodes()) {
                area.lastChild.remove();
            }
        }

        this.create_panel = function (node) {
            if (!node.data_context) {
                return;
            }
            var area = document.querySelector('.studio>.other>.right');
            node.data_context.create_property_panel(area);
        }
    })();
})();

function mouse_in_node_top(node) {
    return window.event.clientY < node.getBoundingClientRect().y + node.getBoundingClientRect().height / 2;
}

function drag_to_self(drag_object, target_object, drop_line) {
    if (!$.contains(drag_object, target_object)) return false;

    if (mouse_in_node_top(drag_object)) {
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
    if (drag_mode != studio.constant.DragMode.boundary) return false;

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
        if (child_node.classList.contains(studio.constant.ClassName.editor)) {
            return null;
        }
        child_node = child_node.parentNode;
    }
    return child_node;
}

function get_current_aside_node(target) {
    if (target.tagName == studio.constant.TagName.section) {
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
    var line_previous_node = find_previous_tag(line, studio.constant.TagName.article);
    var target_previous_node = find_previous_tag(target, studio.constant.TagName.article);
    if (target_previous_node == null && line_previous_node == null) return null;
    if (target_previous_node == null) return line_previous_node;
    if (line_previous_node == null) return target_previous_node;

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
            if (node == null) {
                return null;
            }
            if (node.classList.contains(studio.constant.ClassName.editor)) {
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
            if (node.classList.contains(studio.constant.ClassName.editor)) {
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
    while (first_node.tagName != studio.constant.TagName.article) {
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
    while (!article_node.classList.contains(studio.constant.ClassName.item) && !article_node.classList.contains(studio.constant.ClassName.label)) {
        if (article_node.classList.contains(studio.constant.ClassName.editor)) {
            return null;
        }
        article_node = article_node.parentNode;
    }
    var invalidNode = article_node
    while (invalidNode.tagName == studio.constant.TagName.section || invalidNode.tagName == studio.constant.TagName.article || invalidNode.classList.contains(studio.constant.ClassName.container)) {
        if (invalidNode.classList.contains(studio.constant.ClassName.chosen)) {
            return invalidNode;
        }
        invalidNode = invalidNode.parentNode;
    }
    return null;
}

function make_numbers(start_node) {
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
    var node = find_next_tag(start_node, studio.constant.TagName.article);
    while (node != null) {
        node = get_current_aside_node(node);
        number++;
        set_node_number(node, number);
        node = find_next_tag(node, studio.constant.TagName.article);
    }
    document.querySelector('.editor').style.setProperty('--AsideLeft', '-' + (number.toString().length * 8 + 7) + 'px');
}

function find_article_node(node) {
    while (node.tagName != studio.constant.TagName.article) {
        if (node.classList.contains(studio.constant.ClassName.editor)) {
            return null;
        }
        node = node.parentNode;
    }
    return node;
}

$(function () {
    var drop_line = document.querySelector('#drop_line');

    $('.editor').on('dragenter', function (e) {
        e.preventDefault();
    }).on('dragover', function (e) {
        e.preventDefault();
    }).on('dragstart', function (e) {
        var currentTarget = find_article_node(e.target);
        if (currentTarget.classList.contains(studio.constant.ClassName.item)) {
            studio.designer.drag.start(currentTarget);
        } else if (currentTarget.classList.contains(studio.constant.ClassName.footer)) {
            studio.designer.drag.start(currentTarget.parentNode);
        } else if (currentTarget.parentNode.classList.contains(studio.constant.ClassName.header)) {
            studio.designer.drag.start(currentTarget.parentNode.parentNode);
        } else if (currentTarget.parentNode.parentNode.classList.contains(studio.constant.ClassName.boundary)) {
            studio.designer.drag.start_boundary(currentTarget.parentNode);
        }
    }).on('dragend', studio.designer.drag.finish);

    $('.editor').on('dragover', function (e) {
        var currentTarget = find_article_node(e.target);
        if (currentTarget == null) return;
        if (!studio.designer.drag.is_working(currentTarget)) return;

        if (currentTarget.classList.contains(studio.constant.ClassName.item)) {
            if (mouse_in_node_top(currentTarget)) {
                var previous = currentTarget.previousElementSibling;
                if (previous == null || previous != drop_line) {
                    $(currentTarget).before(drop_line);
                }
            } else {
                var next = currentTarget.nextElementSibling;
                if (next == null || next != drop_line) {
                    $(currentTarget).after(drop_line);
                }
            }
        } else if (currentTarget.classList.contains(studio.constant.ClassName.footer)) {
            if (mouse_in_node_top(currentTarget)) {
                var main_node = find_previous_tag(currentTarget, studio.constant.TagName.main);
                if (main_node.children.length == 0 || main_node.lastElementChild != drop_line) {
                    main_node.append(drop_line);
                }
            } else {
                var next = currentTarget.parentNode.nextElementSibling;
                if (next == null || next != drop_line) {
                    $(currentTarget.parentNode).after(drop_line);
                }
            }
        } else if (currentTarget.parentNode.classList.contains(studio.constant.ClassName.header)) {
            if (mouse_in_node_top(currentTarget)) {
                var previous = currentTarget.parentNode.parentNode.previousElementSibling;
                if (previous == null || previous != drop_line) {
                    $(currentTarget.parentNode.parentNode).before(drop_line);
                }
            } else {
                var main_node = currentTarget.nextElementSibling;
                if (main_node.children.length == 0 || main_node.firstElementChild != drop_line) {
                    main_node.prepend(drop_line);
                }
            }
        } else if (currentTarget.parentNode.parentNode.classList.contains(studio.constant.ClassName.boundary)) {
            if (mouse_in_node_top(currentTarget)) {
                var main_node = find_previous_tag(currentTarget, studio.constant.TagName.main);
                if (main_node.children.length == 0 || main_node.lastElementChild != drop_line) {
                    main_node.append(drop_line);
                }
            } else {
                var main_node = currentTarget.nextElementSibling;
                if (main_node.children.length == 0 || main_node.firstElementChild != drop_line) {
                    main_node.prepend(drop_line);
                }
            }
        }
    });

    $('.editor').on('mousedown', function (e) {
        studio.designer.editor.chosen.clear(find_chosen_content_node(e.target));
    }).on('click', function (e) {
        studio.designer.editor.chosen.choose(find_article_node(e.target));
    });
});