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
    var $menu = this,
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
            $menu.close();
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
            if ($.contains(element, e.target)) {
                return;
            }
            $menu.close();
        });
    });
})();

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