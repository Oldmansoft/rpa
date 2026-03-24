namespace ShellViewer
{
    /// <summary>
    /// 将脚本执行与 UI 线程调度从窗体单例中解耦，供宿主对象使用。
    /// </summary>
    public interface IWebViewUiBridge
    {
        void RunOnUiThread(Action action);

        void ExecuteScript(string javaScript);
    }
}
