if (!window.studio) window.studio = {};

studio.ready = function (func) {
    if (document.ready == 'interactive' || document.readyState == "complete") {
        setTimeout(func, 1);
    } else {
        document.addEventListener("DOMContentLoaded", func);
    }
};
studio.ready(function () {
    studio.element = document.querySelector('.studio');
});

studio.menu = new (function () {
    var _this = this,
        open_state = false,
        element = null;
    this.open = function (e) {
        this.close();
        open_state = true;
        element.style.left = e.clientX + 'px';
        element.style.top = e.clientY + 'px';
        return this;
    }
    this.add = function (name, func) {
        var li = document.createElement('li');
        li.textContent = name;
        element.append(li);
        li.addEventListener('click', function () {
            func();
            _this.close();
        });
        return this;
    }
    this.show = function () {
        element.classList.add('active');
    }
    this.close = function () {
        if (!open_state) {
            return;
        }
        element.classList.remove('active');
        while (element.hasChildNodes()) {
            element.lastChild.remove();
        }
        open_state = false;
    }
    studio.ready(function () {
        element = document.createElement('ul');
        element.setAttribute('class', 'menu');
        studio.element.parentNode.append(element);
        document.body.addEventListener('mousedown', function (e) {
            if (element.contains(e.target)) {
                return;
            }
            _this.close();
        });
    });
})();

studio.ready(function () {
    function getIndex(node) {
        var index = 0;
        while ((node = node.previousElementSibling) != null) index++;
        return index;
    }
    var group = document.querySelector('.label-group');
    if (group == null) {
        return;
    }
    if (group.children.length > 0) {
        group.children[0].classList.add('on');
    }
    if (group.nextElementSibling.children.length > 0) {
        group.nextElementSibling.children[0].classList.add('on');
    }

    group.addEventListener('click', function (event) {
        var last_index = getIndex(this.querySelector('label.on'));
        this.children[last_index].classList.remove('on');
        if (this.nextElementSibling.children.length > last_index) {
            this.nextElementSibling.children[last_index].classList.remove('on');
        }

        var index = getIndex(event.target);
        this.children[index].classList.add('on');
        if (this.nextElementSibling.children.length > index) {
            this.nextElementSibling.children[index].classList.add('on');
        }
    });
});

studio.data = {}
studio.definition = {}
studio.definition.event = class {
    constructor() {
        this.executes = [];
    }
    add(func) {
        if (typeof (func) != 'function') return;
        this.executes.push(func);
    }
    execute() {
        for (var func of this.executes) {
            func.apply(null, arguments);
        }
    }
}
studio.events = {
    'component_loaded': new studio.definition.event(),
    'project_loaded': new studio.definition.event()
}
studio.dialog = {}
studio.dialog.create = function (title) {
    var dialog = document.createElement('dialog');

    var h1 = document.createElement('h1');
    dialog.append(h1);
    h1.append(document.createTextNode(title));

    var icon_close = document.createElement('i');
    h1.append(icon_close);
    icon_close.setAttribute('class', 'font i-close');
    icon_close.addEventListener('click', function () {
        dialog.close();
    });

    dialog.addEventListener('close', function () {
        dialog.remove();
    });
    document.body.prepend(dialog);
    return dialog;
}
studio.dialog.loading = class {
    constructor(content) {
        this.dialog = document.createElement('dialog');
        this.dialog.setAttribute('class', 'loading');
        var p = document.createElement('p');
        p.append(document.createTextNode(content));
        this.dialog.append(p);
        document.body.append(this.dialog);
        setTimeout(() => {
            if (this.dialog != null) {
                this.dialog.showModal();
            }
        }, 100);
    }

    close() {
        this.dialog.close();
        this.dialog.remove();
        this.dialog = null;
    }
}