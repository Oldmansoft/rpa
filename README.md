# RPA

基于 **Windows 桌面壳（Shell）+ Web 前端 + Python 后端** 的流程设计器：壳程序用 WebView2 加载前端页面，并通过匿名管道与 Python 进程通信，执行组件定义、项目文件读写与流程运行等逻辑。

## 仓库结构（`src`）

| 目录 | 说明 |
|------|------|
| `src/shell/ShellViewer` | **Shell**：.NET 8 WinForms 应用，嵌入 WebView2，负责加载前端、启动 Python、桥接 JS 与本地能力（文件夹/文件对话框、执行器命令）。 |
| `src/frontend/designer` | **Frontend**：React 19 + TypeScript + Vite 6 + Tailwind CSS 4，设计器界面（路由、编辑器、项目树、与宿主通信等）。 |
| `src/backend/designer` | **Backend**：Python 3（Windows），`index.py` 为管道服务端入口；`executor` 实现组件与流程执行，`studio` 处理项目创建/重命名等。 |

## 架构关系

1. 用户启动 **ShellViewer**（`ShellViewer.exe`）。
2. 读取同目录下的 `config.json`，将 **Entry** 指向的前端静态资源映射到 WebView2 虚拟域名 `app.local`（或直接打开 `http(s)` 地址）。
3. 前端通过宿主对象 `window.chrome.webview.hostObjects.webview2` 调用 **Executor / FileSystem** 等；首次执行命令时，壳按 **PythonFile** 启动 Python，并传入管道句柄。
4. Python 端 `ProcessServer` 处理 `Designer` 等命令（组件元数据、文件树、运行流程、读写输出文件等），需要时通过 `ExecutorCommandHandle` 回调通知页面（如终端/执行日志）。

## 环境要求

- **Shell**：Windows、.NET 8 SDK、[WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)。
- **Frontend**：Node.js（建议 LTS），用于安装依赖与构建。
- **Backend**：Windows 上的 Python 3；依赖见仓库 `document/requirements.txt`（例如 `simpleeval`）。后端使用 Windows 匿名管道与壳通信，需在 Windows 上运行。

## 前端开发与构建

```bash
cd src/frontend/designer
npm install
npm run dev
```

开发时可在 `config.json` 中将 **Entry** 设为 Vite 开发服务器地址（例如 `http://localhost:5173/`），便于热更新（需与 WebView2 跨域/安全策略相适应）。

生产构建：

```bash
npm run build
```

默认输出在 `src/frontend/designer/dist/`。部署时需将构建结果放到壳程序工作目录下与 **Entry** 一致的路径（见下文「运行目录布局」）。

## 后端说明

- 入口：`src/backend/designer/index.py`（由壳进程以「脚本路径 + 四个管道句柄字符串」方式启动）。
- 包布局：与 `index.py` 同级的 `executor/`、`studio/` 需一并复制，保证 `from executor...`、`import studio.project` 可解析。
- 安装依赖：`pip install -r document/requirements.txt`（在所用 Python 环境中执行）。

## 壳程序（ShellViewer）构建

使用 Visual Studio 或命令行打开 `src/shell/ShellViewer/ShellViewer/ShellViewer.csproj`：

```bash
dotnet build src/shell/ShellViewer/ShellViewer/ShellViewer.csproj -c Release
```

生成物通常在 `ShellViewer/bin/Release/net8.0-windows/`（以实际输出为准）。

## `config.json`（与 `ShellViewer.exe` 同目录）

示例（与源码中默认配置一致）：

```json
{
    "Debug": true,
    "Title": "ShellViewer",
    "Entry": ".\\frontend\\index.html",
    "PythonFile": ".\\backend\\index.py",
    "ExecutorPath": "Python"
}
```

| 字段 | 含义 |
|------|------|
| `Title` | 窗口标题。 |
| `Entry` | 前端入口：相对路径时，为相对 exe 目录的 `index.html` 路径，其父目录会映射到 `http://app.local/`；也可填 `http://` 或 `https://` URL。 |
| `PythonFile` | Python 入口脚本路径（相对 exe 目录）。 |
| `ExecutorPath` | 启动 Python 的可执行名或路径（如 `Python` 表示依赖 PATH 中的 `python`）。 |
| `Debug` | 为 `true` 时壳侧会将部分通信日志写入运行目录日志（见 `FileAppendLog`）。 |

## 运行目录布局（示例）

与 `ShellViewer.exe` 同级建议类似：

```
ShellViewer.exe
config.json
frontend/          ← 前端构建结果（含 index.html）
backend/
  index.py
  executor/
  studio/
```

其中 `backend` 目录内容对应仓库中的 `src/backend/designer/`（保持与源码相同的子目录结构）。

## 许可证

若项目根目录另有 `LICENSE`，以其为准。
