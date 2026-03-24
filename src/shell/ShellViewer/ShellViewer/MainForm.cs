using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using Newtonsoft.Json;

namespace ShellViewer
{
    public partial class MainForm : Form, IWebViewUiBridge
    {
        private Config? config;

        public WebView2 Webview = null!;

        public MainForm()
        {
            InitializeComponent();
            InitializeWebView2();
        }

        internal static void Log(string text) => FileAppendLog.AppendLine(text);

        void IWebViewUiBridge.RunOnUiThread(Action action)
        {
            if (InvokeRequired)
                Invoke(action);
            else
                action();
        }

        void IWebViewUiBridge.ExecuteScript(string javaScript)
        {
            void Run()
            {
                if (Webview?.CoreWebView2 is null)
                    return;
                _ = Webview.CoreWebView2.ExecuteScriptAsync(javaScript);
            }

            if (InvokeRequired)
                Invoke(Run);
            else
                Run();
        }

        private async void InitializeWebView2()
        {
            Webview = new WebView2 { Dock = DockStyle.Fill };
            Controls.Add(Webview);

            try
            {
                var jsonPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
                var jsonText = await File.ReadAllTextAsync(jsonPath);
                config = JsonConvert.DeserializeObject<Config>(jsonText)
                    ?? throw new InvalidOperationException("config.json ???????");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"???? config.json?{ex.Message}", Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            Text = config.Title;

            try
            {
                var env = await CoreWebView2Environment.CreateAsync();
                await Webview.EnsureCoreWebView2Async(env);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"WebView2 ??????{ex.Message}", Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            Webview.CoreWebView2.Settings.IsPinchZoomEnabled = false;
            Webview.CoreWebView2.AddHostObjectToScript("webview2", new WebView2HostObject(config, this));

            NavigateFromConfig();
        }

        private static bool IsHttpOrHttpsEntry(string? entry) =>
            entry is not null
            && (entry.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
                || entry.StartsWith("https://", StringComparison.OrdinalIgnoreCase));

        private void NavigateFromConfig()
        {
            if (Webview.CoreWebView2 is null || config is null)
                return;

            if (IsHttpOrHttpsEntry(config.Entry))
            {
                Webview.CoreWebView2.Navigate(config.Entry);
                return;
            }

            var appPath = ".\\web";
            var indexFilePath = "index.html";
            if (!string.IsNullOrEmpty(config.Entry))
            {
                appPath = Path.GetDirectoryName(config.Entry) ?? appPath;
                indexFilePath = Path.GetFileName(config.Entry);
            }

            var fullPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, appPath);
            var absoluteFolder = Path.GetFullPath(fullPath);
            Log(appPath);
            Log(absoluteFolder);

            if (!Directory.Exists(absoluteFolder))
            {
                MessageBox.Show($"??????????{absoluteFolder}", Text, MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            Webview.CoreWebView2.SetVirtualHostNameToFolderMapping(
                "app.local",
                absoluteFolder,
                CoreWebView2HostResourceAccessKind.Allow);

            Webview.CoreWebView2.Navigate($"http://app.local/{indexFilePath}");
        }
    }
}
