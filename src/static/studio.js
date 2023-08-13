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
        li.addEventListener('click', function() {
            func();
            $menu.close();
        });
        return this;
    }
    this.show = function() {
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
        document.querySelector('body').addEventListener('mousedown', function (e) {
            if ($.contains(element, e.target)) {
                return;
            }
            $menu.close();
        });
    });
})();