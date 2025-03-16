studio.ready(function () {
    document.querySelector('.menu .i-project-create').parentNode.addEventListener('click', function () {
        studio.project.dialog_panel.create();
    });
    document.querySelector('.menu .i-project-open').parentNode.addEventListener('click', function () {
        var result = studio.communication.host_call_register("FileSystem.FolderBrowserDialog");
        var [proxy, result] = studio.communication.host_proxy("FileSystem", "FolderBrowserDialog");
        proxy("请选择应用所在目录");
        result.then(function (path) {
            if (path == null) {
                return;
            }
            document.location = '/static/studio.htm#' + path;
        });
    });
    document.querySelector('.menu .i-export').parentNode.addEventListener('click', function () {
        //var filePath = window.electronAPI.openFile();
        //console.info(filePath);
        var result = studio.communication.host_call_register("FileSystem.FolderBrowserDialog");
        window.chrome.webview.hostObjects.webview2.FileSystem.FolderBrowserDialog("打开项目文件夹");
        result.then((path) => console.info(path));
    });
});