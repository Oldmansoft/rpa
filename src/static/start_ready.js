studio.ready(function () {
    document.querySelector('.menu .i-project-create').parentNode.addEventListener('click', function () {
        studio.project.dialog_panel.create();
    });
    document.querySelector('.menu .i-project-open').parentNode.addEventListener('click', function () {
        studio.system.get_folder('打开应用', '请选择应用所在目录').add(function (path) {
            document.location = '/static/studio.htm#' + path;
        });
    });
    document.querySelector('.menu .i-export').parentNode.addEventListener('click', function () {
        var filePath = window.electronAPI.openFile();
        console.info(filePath);
    });
});