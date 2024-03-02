//studio.socket = io();
//studio.socket.emit('message', { type: 'Project', action: 'Create' });
studio.communication = {}
studio.communication.server = {}

studio.communication.server.message = function (type, action, params, callback) {
    var loading = new studio.dialog.loading('数据加载中...');
    return $.ajax({
        type: 'post',
        url: '/get_message',
        data: JSON.stringify({
            type: type,
            action: action,
            params: params
        }),
        contentType: 'application/json; charset=utf-8',
        dataType: 'json',
        success: function (data) {
            if (data.code != 0) {
                console.error(data.code, data.message);
                return;
            }
            callback(data.data);
        },
        error: function (XMLHttpRequest, textStatus, errorThrown) {
            console.error(textStatus, errorThrown);
        },
        complete: function (XMLHttpRequest, textStatus) {
            loading.close();
        }
    });
}

studio.project = {}
studio.project.run = function (path) {
    studio.communication.server.message('Project', 'Run', { 'path': path }, function() {});
}
studio.project.open = function (path) {
    function find_component(id, list) {
        for (var item of list) {
            if (item['category'] == 'item') {
                if (item['id'] == id) {
                    return item;
                }
            } else {
                return find_component(id, item['list']);
            }
        }
        return null;
    }

    function find_component_optional(id, list) {
        for (var item of list) {
            if (item['id'] == id) {
                return item;
            }
        }
    }

    function element_append_body(element_main, body) {
        for (var item of body) {
            var component = find_component(item['id'], studio.data.component);
            var action = studio.designer.procedure.create(component, item['params']);
            element_main.append(action.element);
            if ('body' in item && item['body'].length > 0) {
                element_append_body(action.element_main, item['body']);
            }
            if ('optional' in item && item['optional'].length > 0) {
                for (var optional_item of item['optional']) {
                    component_optional = find_component_optional(optional_item['id'], component['optional']);
                    if (component_optional['category'] == 'Boundary') {
                        var boundary_action = action.add_boundary_action(component_optional, optional_item['params']);
                        element_append_body(boundary_action.element_main, optional_item['body']);
                    } else {
                        var last_action = action.add_last_action(component_optional);
                        element_append_body(last_action.element_main, optional_item['body']);
                    }
                }
            }
        }
    }

    studio.communication.server.message('Project', 'Open', {
        path: path
    }, function (data) {
        if (!data['result']) {
            alert(data['message']);
            document.location = '/static/start.htm';
            return;
        }
        var tab = document.createElement('div');
        tab.innerText = 'Main';
        document.querySelector('.tabs').append(tab);

        var variables = document.querySelector('.variables');
        for (var name in data['data']['Main']['local']) {
            var variable = document.createElement('div');
            variable.innerText = name;
            variables.append(variable);
        }

        var editor = document.querySelector('.editor');
        element_append_body(editor, data['data']['Main']['body']);
        make_numbers();
    })
}
studio.project.dialog_panel = {}
studio.project.dialog_panel.create = function () {
    var dialog = studio.dialog.create('新建应用');
    function check_value() {
        var disabled = dialog.querySelector('input[name=ProjectName]').value.trim() == '' && dialog.querySelector('input[name=ProjectPath]').value.trim() == '';
        if (disabled) {
            button_confirm.setAttribute('disabled', 'disabled');
        } else {
            button_confirm.removeAttribute('disabled');
        }
    }
    dialog.classList.add('project-creator')
    var section = document.createElement('section');
    dialog.append(section);

    var label = document.createElement('label');
    section.append(label);
    var span = document.createElement('span');
    span.append(document.createTextNode('应用名称'));
    label.append(span);
    var input = document.createElement('input');
    input.setAttribute('name', 'ProjectName');
    input.addEventListener('change', check_value);
    label.append(input);
    var label = document.createElement('label');
    section.append(label);
    var span = document.createElement('span');
    span.append(document.createTextNode('应用位置'));
    label.append(span);
    var input = document.createElement('input');
    input.setAttribute('name', 'ProjectPath');
    label.append(input);
    var button = document.createElement('button');
    button.append(document.createTextNode('...'));
    button.addEventListener('click', function () {
        studio.system.get_folder('浏览文件夹', '请选择一个位置来保存应用').add(function (path) {
            dialog.querySelector('input[name=ProjectPath]').value = path;
        });
    });
    label.append(button);

    var buttons = document.createElement('div');
    section.append(buttons);
    buttons.setAttribute('class', 'buttons');

    var button_confirm = document.createElement('button');
    buttons.append(button_confirm);
    button_confirm.setAttribute('disabled', 'disabled');
    button_confirm.append(document.createTextNode('确定'));
    button_confirm.addEventListener('click', function () {
        studio.communication.server.message('Project', 'Create', {
            path: dialog.querySelector('input[name=ProjectPath]').value.trim(),
            name: dialog.querySelector('input[name=ProjectName]').value.trim()
        }, function (data) {
            if (!data['result']) {
                alert(data['message']);
                return;
            }
            dialog.close();
            document.location = '/static/studio.htm#' + data['path'];
        });
    });

    var button_cancel = document.createElement('button');
    buttons.append(button_cancel);
    button_cancel.append(document.createTextNode('取消'));
    button_cancel.addEventListener('click', function () {
        dialog.close();
    });

    dialog.showModal();
}

studio.system = {}
studio.system.get_folder = function (title, description) {
    var event = new studio.definition.event();
    var target_folder;
    var margin_left = 18;
    function get_sub_folder(data) {
        var ul = document.createElement('ul');
        for (var i = 0; i < data.length; i++) {
            var current_left = Number(target_folder.getAttribute('data-left')) + margin_left;

            var li = document.createElement('li');
            ul.append(li);
            li.setAttribute('data-left', current_left);

            var h2 = document.createElement('h2');
            li.append(h2);
            h2.setAttribute('data-path', data[i].path);
            h2.addEventListener('click', function () {
                button_create_folder.removeAttribute('disabled');
                button_confirm.removeAttribute('disabled');
                var choose_node = folders.querySelector('.choose');
                if (choose_node != null) {
                    choose_node.classList.remove('choose');
                }
                this.parentNode.classList.add('choose');
            });

            var span = document.createElement('span');
            h2.append(span);
            span.style.width = current_left + 'px';

            if (data[i].more) {
                var icon = document.createElement('i');
                span.append(icon);
                icon.setAttribute('class', 'font i-nav-right')
                icon.addEventListener('click', function () {
                    target_folder = this.parentNode.parentNode.parentNode;
                    if (target_folder.classList.contains('expand')) {
                        target_folder.classList.remove('expand');
                        target_folder.lastChild.remove();
                        return;
                    }
                    studio.communication.server.message('System', 'GetFolderList', {
                        path: this.parentNode.parentNode.getAttribute('data-path')
                    }, get_sub_folder);
                });
            }

            var icon = document.createElement('i');
            h2.append(icon);
            icon.setAttribute('class', 'font i-' + data[i].type);
            h2.append(document.createTextNode(data[i].name));
        }
        target_folder.append(ul);
        target_folder.classList.add('expand');
    }
    var dialog = studio.dialog.create(title);
    dialog.classList.add('folder-selector');

    var section = document.createElement('section');
    dialog.append(section);

    var p = document.createElement('p');
    section.append(p);
    p.append(document.createTextNode(description));

    var folders = document.createElement('div');
    section.append(folders);
    folders.setAttribute('data-left', '0');
    folders.setAttribute('class', 'folders');

    var h2 = document.createElement('h2');
    folders.append(h2);
    var icon = document.createElement('i');
    h2.append(icon);
    icon.setAttribute('class', 'font i-computer');
    h2.append(document.createTextNode('此电脑'));

    var buttons = document.createElement('div');
    section.append(buttons);
    buttons.setAttribute('class', 'buttons');

    var button_create_folder = document.createElement('button');
    buttons.append(button_create_folder);
    button_create_folder.setAttribute('disabled', 'disabled');
    button_create_folder.append(document.createTextNode('新建文件夹'));

    var button_confirm = document.createElement('button');
    buttons.append(button_confirm);
    button_confirm.setAttribute('disabled', 'disabled');
    button_confirm.append(document.createTextNode('确定'));
    button_confirm.addEventListener('click', function () {
        dialog.close();
        event.execute(dialog.querySelector('.choose>h2').getAttribute('data-path'));
    });

    var button_cancel = document.createElement('button');
    buttons.append(button_cancel);
    button_cancel.append(document.createTextNode('取消'));
    button_cancel.addEventListener('click', function () {
        dialog.close();
    });

    dialog.showModal();

    target_folder = folders;
    studio.communication.server.message('System', 'GetFolderList', {}, get_sub_folder);
    return event;
}