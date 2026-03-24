using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Text;
using System.Reflection;

namespace ShellViewer
{
    public class PipeCreator : IDisposable
    {
        public AnonymousPipeServerStream WritePipe { get; private set; }

        public AnonymousPipeServerStream ReadPipe { get; private set; }

        public PipeCreator()
        {
            HandleInheritability inherit = HandleInheritability.Inheritable;
            WritePipe = new AnonymousPipeServerStream(PipeDirection.Out, inherit);
            ReadPipe = new AnonymousPipeServerStream(PipeDirection.In, inherit);
        }

        public void SetHandle(out string outRead, out string inWrite)
        {
            outRead = WritePipe.GetClientHandleAsString();
            inWrite = ReadPipe.GetClientHandleAsString();
        }

        void IDisposable.Dispose()
        {
            WritePipe.DisposeLocalCopyOfClientHandle(); // Release unmanaged
            ReadPipe.DisposeLocalCopyOfClientHandle(); // handle resources.
        }
    }

    public class Communication
    {
        private readonly AnonymousPipeServerStream ReadPipe;
        private readonly AnonymousPipeServerStream WritePipe;
        private readonly Encoding _textEncoding;

        public Communication(AnonymousPipeServerStream readPipe, AnonymousPipeServerStream writePipe, string encoding = "utf-8")
        {
            ReadPipe = readPipe;
            WritePipe = writePipe;
            _textEncoding = Encoding.GetEncoding(encoding);
        }

        private static int ReadFully(Stream stream, byte[] buffer, int offset, int count)
        {
            var total = 0;
            while (total < count)
            {
                var n = stream.Read(buffer, offset + total, count - total);
                if (n == 0)
                    return total;
                total += n;
            }
            return total;
        }

        public void Write(string text = null)
        {
            if (string.IsNullOrEmpty(text))
            {
                var zero = Pack(0);
                WritePipe.Write(zero, 0, 4);
                WritePipe.Flush();
                return;
            }
            byte[] buffer = _textEncoding.GetBytes(text);
            byte[] lengthBuffer = Pack(buffer.Length);
            WritePipe.Write(lengthBuffer, 0, lengthBuffer.Length);
            WritePipe.Flush();
            WritePipe.Write(buffer, 0, buffer.Length);
            WritePipe.Flush();
        }

        public (bool, string?) Read()
        {
            byte[] lengthBuffer = new byte[4];
            var headerRead = ReadFully(ReadPipe, lengthBuffer, 0, 4);
            if (headerRead == 0)
                return (false, null);
            if (headerRead < 4)
                return (false, null);

            int length = Unpack(lengthBuffer);
            if (length == 0)
                return (true, string.Empty);

            byte[] buffer = new byte[length];
            var bodyRead = ReadFully(ReadPipe, buffer, 0, length);
            if (bodyRead < length)
                return (false, null);

            return (true, _textEncoding.GetString(buffer));
        }

        private byte[] Pack(int value)
        {
            byte[] result = new byte[4];
            result[0] = (byte)((value >> 0) & 0xFF);
            result[1] = (byte)((value >> 8) & 0xFF);
            result[2] = (byte)((value >> 16) & 0xFF);
            result[3] = (byte)((value >> 24) & 0xFF);
            return result;
        }

        private int Unpack(byte[] value)
        {
            int result = value[0];
            result += value[1] * 0x1 << 8;
            result += value[2] * 0x1 << 16;
            result += value[3] * 0x1 << 24;
            return result;
        }

    }

    public class ProcessCommand
    {
        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("method")]
        public string Method { get; set; }

        [JsonProperty("content")]
        public Dictionary<string, object> Content { get; set; }

        [JsonProperty("ask")]
        public bool Ask { get; set; }

        public static ProcessCommand Parse(string text)
        {
            return JsonConvert.DeserializeObject<ProcessCommand>(text);
        }

        public static string ConvertToJsonText(object value)
        {
            return JsonConvert.SerializeObject(value, new JsonSerializerSettings()
            {
                StringEscapeHandling = StringEscapeHandling.EscapeNonAscii
            });
        }

        public string Text()
        {
            return ConvertToJsonText(this);
        }

        public bool IsSame(ProcessCommand command)
        {
            if (command is null)
            {
                return false;
            }
            return command.Name == Name && command.Method == Method;
        }

        public ProcessCommand CreateSame(Dictionary<string, object> content = null)
        {
            return new ProcessCommand
            {
                Name = Name,
                Method = Method,
                Content = content
            };
        }

        public (bool, JToken) Call(Communication communication)
        {
            Ask = true;
            communication.Write(Text());
            (bool result, string text) = communication.Read();
            if (!result)
            {
                return (false, null);
            }
            JObject call_result = JsonConvert.DeserializeObject<JObject>(text);
            string error = call_result.Value<string>("error");
            if (!(error is null))
            {
                throw new CommandException(error);
            }
            return (true, call_result.Value<JToken>("result"));
        }

        public void Send(Communication communication)
        {
            Ask = false;
            communication.Write(Text());
        }
    }

    public class ProcessCommandReturn
    {
        [JsonProperty("error")]
        public string Error { get; set; }

        [JsonProperty("result")]
        public JToken Result { get; set; }

        public string Text()
        {
            return JsonConvert.SerializeObject(this, new JsonSerializerSettings()
            {
                StringEscapeHandling = StringEscapeHandling.EscapeNonAscii
            });
        }
    }

    public class ProcessException : Exception
    {
        public ProcessException(string message) : base(message)
        {
        }
    }

    public class CommandException : ProcessException
    {
        public CommandException(string message) : base(message)
        {
        }
    }

    public class CommandHandle { }

    public static class InnerCommand
    {
        internal const string Name = "#inner";

        public static readonly ProcessCommand ServerStart = new ProcessCommand { Name = InnerCommand.Name, Method = "server_start" };

        public static readonly ProcessCommand ServerClose = new ProcessCommand { Name = InnerCommand.Name, Method = "#close" };

        public static readonly ProcessCommand ServerError = new ProcessCommand { Name = InnerCommand.Name, Method = "server_error" };
    }

    public class ProcessLauncherCommandHandle : CommandHandle
    {
        private readonly ProcessLauncher Launcher;

        public ProcessLauncherCommandHandle(ProcessLauncher launcher)
        {
            Launcher = launcher;
        }

        public void server_error(string content)
        {
            if (!(Launcher.OnError is null))
            {
                Launcher.OnError(content);
            }
        }
    }

    internal class RegisterHandler
    {
        public object Target { get; set; }

        public Dictionary<string, MethodInfo> Methods { get; set; }

        public RegisterHandler(object target, Type type)
        {
            Target = target;
            Methods = new Dictionary<string, MethodInfo>();
            foreach (MethodInfo method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance))
            {
                Methods.Add(method.Name, method);
            }
        }
    }

    public class ProcessLauncher
    {
        internal readonly string PythonExecuteCommand;

        internal readonly Dictionary<string, RegisterHandler> CommandHandlers;

        public Action<string> OnError { get; set; }

        public ProcessLauncher(string pythonExecuteCommand = "python")
        {
            PythonExecuteCommand = pythonExecuteCommand;
            CommandHandlers = new Dictionary<string, RegisterHandler>();
            _RegisterCommandHandle(new ProcessLauncherCommandHandle(this), InnerCommand.Name);
        }

        public ProcessLauncherServerProxy Connect(string pythonScriptPath, Dictionary<string, object> parameters = null)
        {
            return new ProcessLauncherServerProxy(this, pythonScriptPath, parameters);
        }

        internal (string, JToken) TryCommandHandle(ProcessCommand command)
        {
            if (!CommandHandlers.ContainsKey(command.Name))
            {
                return (string.Format("ProcessLauncher 没有对象处理命令 {0}.{1}。", command.Name, command.Method), null);
            }

            var handler = CommandHandlers[command.Name];
            if (!handler.Methods.ContainsKey(command.Method))
            {
                return (string.Format("ProcessLauncher 命令处理对象 {0} 不存在方法 {1}。", command.Name, command.Method), null);
            }

            var parameters = new List<object>();
            if (!(command.Content is null))
            {
                foreach (var parameter in handler.Methods[command.Method].GetParameters())
                {
                    if (!command.Content.ContainsKey(parameter.Name))
                    {
                        return (string.Format("ProcessLauncher 命令处理对象 {0} 的方法 {1} 缺少参数 {2}。", command.Name, command.Method, parameter.Name), null);
                    }
                    if (command.Content[parameter.Name] is null)
                    {
                        parameters.Add(null);
                        continue;
                    }
                    if (command.Content[parameter.Name].GetType() != parameter.ParameterType)
                    {
                        return (string.Format("ProcessLauncher 命令处理对象 {0} 的方法 {1} 参数 {2} 类型不正确。", command.Name, command.Method, parameter.Name), null);
                    }
                    parameters.Add(command.Content[parameter.Name]);
                }
            }
            var result = handler.Methods[command.Method].Invoke(handler.Target, parameters.ToArray());
            if (result is null)
            {
                return (null, null);
            }
            return (null, JToken.FromObject(result));
        }

        public void RegisterCommandHandle(CommandHandle handler)
        {
            _RegisterCommandHandle(handler, null);
        }

        private void _RegisterCommandHandle(CommandHandle handler, string className)
        {
            Type type = handler.GetType();
            if (!type.IsSubclassOf(typeof(CommandHandle)))
            {
                throw new ProcessException(string.Format("handler 类型 {0} 必须是 CommandHandle 的子类。", type.Name));
            }
            if (className is null)
            {
                className = type.Name;
            }
            if (CommandHandlers.ContainsKey(className))
            {
                throw new ProcessException(string.Format("已经注册有命令处理对象 {0}。", type.Name));
            }

            CommandHandlers.Add(className, new RegisterHandler(handler, type));
        }
    }

    public class ProcessLauncherServerProxy
    {
        private Communication CommunicationSender;
        private Communication CommunicationListener;
        private System.Threading.AutoResetEvent Event;
        private bool ExecutingThread;
        private Process ChildProcess;
        private readonly ProcessLauncher Launcher;
        private readonly Dictionary<string, object> StartParameters;

        public ProcessLauncherServerProxy(ProcessLauncher launcher, string pythonScriptPath, Dictionary<string, object> parameters)
        {
            Launcher = launcher;
            StartParameters = parameters;
            using (PipeCreator sender = new PipeCreator(), listener = new PipeCreator())
            {
                sender.SetHandle(out string sender_out_read_handle, out string sender_in_write_handle);
                listener.SetHandle(out string listener_out_read_handle, out string listener_in_write_handle);

                Console.WriteLine(string.Format("{0} {1} {2} {3} {4}", pythonScriptPath, sender_out_read_handle, sender_in_write_handle, listener_out_read_handle, listener_in_write_handle));
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = Launcher.PythonExecuteCommand,
                    Arguments = string.Format("{0} {1} {2} {3} {4}", pythonScriptPath, sender_out_read_handle, sender_in_write_handle, listener_out_read_handle, listener_in_write_handle),
                    RedirectStandardOutput = false,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                ChildProcess = Process.Start(startInfo);

                CommunicationSender = new Communication(sender.ReadPipe, sender.WritePipe);
                CommunicationListener = new Communication(listener.ReadPipe, listener.WritePipe);
                Event = new System.Threading.AutoResetEvent(false);
                ExecutingThread = true;
                var thread = new System.Threading.Thread(ExecuteThread)
                {
                    IsBackground = true
                };
                thread.Start();
                Event.WaitOne();
            }
        }

        private void ExecuteThread()
        {
            Dictionary<string, object> startContentParameter = new Dictionary<string, object>
            {
                { "content", ProcessCommand.ConvertToJsonText(StartParameters) }
            };
            (bool callResult, JToken _) = InnerCommand.ServerStart.CreateSame(startContentParameter).Call(CommunicationSender);
            if (!callResult)
            {
                ExecutingThread = false;
                Event.Set();
                return;
            }

            Event.Set();
            while (true)
            {
                (bool readerResult, string readerValue) = CommunicationListener.Read();
                if (!readerResult)
                {
                    // 目标进程退出
                    break;
                }

                ProcessCommand command = ProcessCommand.Parse(readerValue);
                ProcessCommandReturn returnResult = new ProcessCommandReturn();
                try
                {
                    (returnResult.Error, returnResult.Result) = Launcher.TryCommandHandle(command);
                }
                catch (Exception ex)
                {
                    returnResult.Error = ex.Message;
                }

                if (command.Ask)
                {
                    CommunicationListener.Write(returnResult.Text());
                }
                else if (!(returnResult.Error is null) && !(Launcher.OnError is null))
                {
                    Launcher.OnError(returnResult.Error);
                }
            }
            // ChildProcess.WaitForExit();
            ExecutingThread = false;
        }

        public JToken Call(string name, string method, Dictionary<string, object> content = null)
        {
            if (!ExecutingThread)
            {
                throw new Exception("子进程没有在运行，请查看是否启用 connect 或者已经调用 close。");
            }
            ProcessCommand command = new ProcessCommand
            {
                Name = name,
                Method = method,
                Content = content
            };
            (_, JToken value) = command.Call(CommunicationSender);
            return value;
        }

        public string Command(string command)
        {
            CommunicationSender.Write(command);
            if (!JsonConvert.DeserializeObject<ProcessCommand>(command).Ask)
            {
                return null;
            }
            (bool result, string text) = CommunicationSender.Read();
            if (!result)
            {
                return null;
            }
            return text;
        }

        public void Send(string name, string method, Dictionary<string, object> content)
        {
            if (!ExecutingThread)
            {
                throw new Exception("子进程没有在运行，请查看是否启用 connect 或者已经调用 close。");
            }
            ProcessCommand command = new ProcessCommand
            {
                Name = name,
                Method = method,
                Content = content
            };

            command.Send(CommunicationSender);
        }

        public bool Close()
        {
            if (ExecutingThread)
            {
                InnerCommand.ServerClose.Send(CommunicationSender);
                return true;
            }
            return false;
        }

        public void Kill()
        {
            ChildProcess.Kill();
        }

        public bool Connecting
        {
            get
            {
                return ExecutingThread;
            }
        }
    }
}
