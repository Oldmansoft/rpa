function create_component_content() {
    function create_node(data) {
        var node = document.createElement('div');
        var i = document.createElement('i');
        if (data['category'] == 'item') {
            i.setAttribute('class', 'font i-' + data['id']);
        } else {
            i.setAttribute('class', 'font i-nav-right');
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
            if (list[i]['category'] == 'item') {
                node.setAttribute('class', 'leaf');
                node.setAttribute('draggable', 'true');
                node.data_component = list[i];
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
        studio.data.component = data;
        create_content_to(data, $('.studio>.other>.left'));
        $('.studio>.other>.left .group>.branch').on('click', function () {
            this.parentNode.classList.toggle('expand');
        });
        document.querySelector('.studio>.other>.left').firstChild.classList.toggle('expand');
        $('.studio>.other>.left .leaf').on('dragstart', function () {
            studio.designer.drag.start_choose(studio.designer.procedure.create(this.data_component).element);
        }).on('dragend', studio.designer.drag.finish);
    });
}

studio.ready(function () {
    create_component_content();
});