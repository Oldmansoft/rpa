studio.ready(function () {
    document.querySelector('.menu .i-home').parentNode.addEventListener('click', function () {
        document.location = '/static/start.htm';
    });
    document.querySelector('.menu .i-run').parentNode.addEventListener('click', function () {
        document.querySelectorAll('.label-group>label')[1].click();
        studio.project.run('./Main.scs');
    });
    document.querySelector('.menu .i-project-open').parentNode.addEventListener('click', function () {
        var filePath = window.electronAPI.openFile();
        console.info(filePath);
        studio.system.get_folder('打开应用', '请选择应用所在目录').add(function (path) {
            document.location = '/static/studio.htm#' + path;
        });
    });
    document.querySelector('.menu .i-export').parentNode.addEventListener('click', function () {
        window.location.reload();
    });
    studio.events['component_loaded'].add(function() {
        studio.project.open(document.location.hash.substring(1));
    });

});