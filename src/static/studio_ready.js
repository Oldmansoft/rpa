studio.ready(function () {
    document.querySelector('.menu .i-home').parentNode.addEventListener('click', function () {
        document.location = '/static/start.htm';
    });
    studio.project.open(document.location.hash.substring(1));
});