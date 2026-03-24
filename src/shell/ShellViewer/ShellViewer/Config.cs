namespace ShellViewer
{
    public class Config
    {
        public bool Debug { get; set; }

        public required string Title { get; set; }

        public required string Entry { get; set; }

        public required string PythonFile { get; set; }

        public required string ExecutorPath { get; set; }
    }
}
