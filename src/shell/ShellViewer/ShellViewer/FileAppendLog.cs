namespace ShellViewer
{
    internal static class FileAppendLog
    {
        private static readonly object Sync = new();

        public static void AppendLine(string text)
        {
            var path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "log.txt");
            lock (Sync)
            {
                File.AppendAllText(path, text);
                File.AppendAllText(path, "\r\n");
            }
        }
    }
}
