studio.ready(function () {
    document.querySelector('.menu .i-home').parentNode.addEventListener('click', function () {
        document.location = '/static/start.htm';
    });
    document.querySelector('.menu .i-run').parentNode.addEventListener('click', function () {
        studio.project.run('./Main.scs');
    });
    studio.events['component_loaded'].add(function() {
        studio.project.open(document.location.hash.substring(1));
    });

});