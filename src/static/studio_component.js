function create_component_node(data) {
    var node = document.createElement('article');
    node.setAttribute('class', 'item');
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
    var p = document.createElement('p');
    li.append(p);
    return node;
}

function create_component_content() {
    function create_node(data) {
        var node = document.createElement('div');
        var i = document.createElement('i');
        if (data['type'] == 'item') {
            i.setAttribute('class', 'font i-' + data['id']);
        } else {
            i.append(document.createTextNode('>'));
        }
        node.append(i);
        var span = document.createElement('span');
        span.append(document.createTextNode(data['name']));
        node.append(span);
        return node;
    }

    function create_content_to(list, parent_node) {
        for (var i = 0; i < list.length; i++) {
            var node = create_node(list[i]);
            if (list[i]['type'] == 'item') {
                node.setAttribute('class', 'leaf');
                node.setAttribute('draggable', 'true');
                $(node).data('init_data', list[i]);
                parent_node.append(node);
            } else {
                var group = document.createElement('div');
                group.setAttribute('class', 'group');
                group.append(node);
                node.setAttribute('class', 'branch')

                var child_node = document.createElement('div');
                child_node.setAttribute('class', 'list')
                group.append(child_node);
                create_content_to(list[i]['list'], child_node);

                parent_node.append(group);
            }
        }
    }

    $.get("/get_component", function (data) {
        create_content_to(data, $('.studio>.other>.left'));
        $('.studio>.other>.left .group>.branch').on('click', function () {
            this.parentNode.classList.toggle('expand');
        });
        document.querySelector('.studio>.other>.left').firstChild.classList.toggle('expand');
        $('.studio>.other>.left .leaf').on('dragstart', function () {
            studio.designer.drag.start(create_component_node($(this).data('init_data')));
        }).on('dragend', studio.designer.drag.finish);
    });
}

$(function () {
    create_component_content();
});