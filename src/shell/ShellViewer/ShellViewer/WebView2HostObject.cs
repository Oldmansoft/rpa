using System.Runtime.InteropServices;
using System.Windows.Forms;
using Newtonsoft.Json;

namespace ShellViewer
{
    /// <summary>
    /// 自定义宿主类，用于向网页注册C#对象，供JS调用
    /// </summary>
    [ComVisible(true)]
    public class WebView2HostObject
    {
        public readonly Browser Browser;

        public readonly FileSystem FileSystem;

        public readonly Executor Executor;

        public WebView2HostObject(Config config, IWebViewUiBridge uiBridge)
        {
            Browser = new Browser(uiBridge);
            FileSystem = new FileSystem(uiBridge);
            Executor = new Executor(config, uiBridge);
        }
    }

    public abstract class HostObject
    {
        protected readonly IWebViewUiBridge Ui;

        protected HostObject(IWebViewUiBridge ui) => Ui = ui;

        public void Return(string key, object? value)
        {
            var builder = new System.Text.StringBuilder();
            builder.Append("window.communication.host_call_result(\"");
            builder.Append(key);
            builder.Append("\", ");
            builder.Append(JsonConvert.SerializeObject(value));
            builder.Append(')');
            Ui.ExecuteScript(builder.ToString());
        }
    }

    [ComVisible(true)]
    public class Browser : HostObject
    {
        public Browser(IWebViewUiBridge ui) : base(ui)
        {
        }
    }

    [ComVisible(true)]
    public class FileSystem : HostObject
    {
        public FileSystem(IWebViewUiBridge ui) : base(ui)
        {
        }

        public void FolderBrowserDialog(string description)
        {
            Ui.RunOnUiThread(() =>
            {
                using var dialog = new FolderBrowserDialog
                {
                    Description = description,
                    RootFolder = Environment.SpecialFolder.MyComputer
                };
                Return("FileSystem.FolderBrowserDialog",
                    dialog.ShowDialog() == DialogResult.OK ? dialog.SelectedPath : null);
            });
        }

        public void OpenFileDialog(string filter, bool multiselect)
        {
            Ui.RunOnUiThread(() =>
            {
                using var dialog = new OpenFileDialog
                {
                    Filter = filter,
                    Multiselect = multiselect
                };
                if (dialog.ShowDialog() != DialogResult.OK)
                {
                    Return("FileSystem.OpenFileDialog", null);
                    return;
                }

                Return("FileSystem.OpenFileDialog",
                    multiselect ? dialog.FileNames : dialog.FileName);
            });
        }
    }

    public class ExecutorCommandHandle : CommandHandle
    {
        private readonly Executor Caller;
        private readonly IWebViewUiBridge Ui;

        public ExecutorCommandHandle(Executor executor, IWebViewUiBridge ui)
        {
            Caller = executor;
            Ui = ui;
        }

        public void SendMessage(string key, string content)
        {
            var builder = new System.Text.StringBuilder();
            builder.Append("window.communication.host_send_message(\"");
            builder.Append(key);
            builder.Append("\", ");
            builder.Append(JsonConvert.SerializeObject(content));
            builder.Append(')');

            Caller.Log(builder.ToString());
            Ui.ExecuteScript(builder.ToString());
        }

        public string AppDirectory() => AppDomain.CurrentDomain.BaseDirectory;
    }

    [ComVisible(true)]
    public class Executor : HostObject
    {
        private readonly Config Config;

        private readonly ProcessLauncher Client;

        private ProcessLauncherServerProxy? ServerProxy;

        public Executor(Config config, IWebViewUiBridge ui) : base(ui)
        {
            Config = config;
            Client = new ProcessLauncher(Config.ExecutorPath);
            Client.RegisterCommandHandle(new ExecutorCommandHandle(this, ui));
            Client.OnError = ProcessLauncherOnError;
        }

        internal void Log(string text)
        {
            if (!Config.Debug)
                return;
            FileAppendLog.AppendLine(text);
        }

        internal void LogError(string text) => FileAppendLog.AppendLine(text);

        private void ProcessLauncherOnError(string error) => LogError(error);

        public string CallCommand(string command)
        {
            if (ServerProxy is null || !ServerProxy.Connecting)
            {
                var pythonFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, Config.PythonFile);
                Log($"Connect Start {pythonFilePath}");
                var parameters = new Dictionary<string, object>
                {
                    { "AppDirectory", AppDomain.CurrentDomain.BaseDirectory }
                };
                ServerProxy = Client.Connect(pythonFilePath, parameters);
            }
            Log(command);
            return ServerProxy.Command(command);
        }
    }
}
