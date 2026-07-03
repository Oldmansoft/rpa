# RPA 脚本注入器（含 Native Messaging）

此扩展支持两种注入方式：

1. 手动：在 popup 中选择预置动作并执行。
2. 外部推送：本地 RPA 程序通过 Native Messaging 向扩展发送 `inject` 动作消息。

## 1) Native Host 名称

扩展端固定 host 名称为：`com.rpa.script_bridge`

如果你要修改名称，需要同步修改 `background.js` 中的 `NATIVE_HOST_NAME`。

## 2) Windows 安装 Native Host

假设本项目路径为：

`C:\Job\Work\RPA浏览器扩展\native-host`

### 步骤 A：准备宿主脚本

已提供两个版本：

- Python：`native-host/host.py`（由 `host.cmd` 启动）
- Rust：`native-host/rust/`（由 `host-rust.cmd` 启动，需先编译）

Rust 版本编译：

```powershell
cd "C:\Job\Work\RPA浏览器扩展\native-host"
.\build-rust.cmd
```

编译产物：`native-host/rust/target/release/rpa_native_host.exe`

### 步骤 B：准备宿主 manifest

已提供模板：

- Python：`native-host/com.rpa.script_bridge.json`
- Rust：`native-host/com.rpa.script_bridge.rust.json`

注意：Windows 下建议使用 `host.cmd` / `host-rust.cmd` 作为 `path`，不要在 manifest 里使用 `args` 字段。

你需要把其中的扩展 ID 替换为你自己的：

- Chrome：`allowed_origins` 使用 `chrome-extension://<你的扩展ID>/`
- Edge：`allowed_origins` 仍按 Chromium 扩展 origin 规则填写。

### 步骤 C：写入注册表（当前用户）

Chrome：

`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.rpa.script_bridge`

默认值写为：

`C:\Job\Work\RPA浏览器扩展\native-host\com.rpa.script_bridge.json`

Edge：

`HKEY_CURRENT_USER\Software\Microsoft\Edge\NativeMessagingHosts\com.rpa.script_bridge`

默认值同上。

可直接执行（PowerShell）：

```powershell
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.rpa.script_bridge" /ve /t REG_SZ /d "C:\Job\Work\RPA浏览器扩展\native-host\com.rpa.script_bridge.json" /f
reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.rpa.script_bridge" /ve /t REG_SZ /d "C:\Job\Work\RPA浏览器扩展\native-host\com.rpa.script_bridge.json" /f
```
## 3) 消息协议

### Native -> Extension

```json
{
  "type": "inject",
  "requestId": "req-001",
  "action": "getFrameInfo",
  "params": { "frameUrlContains": "pay.example.com", "similarIndex": 0 },
  "executeMode": "isolated",
  "tabId": 123,
  "frameId": 2,
  "urlContains": "example.com"
}
```

字段说明：

- `action`：必填，预置动作名称（如 `getTabInfo` / `getFrameInfo` / `getInfos` / `click` / `setValue` / `getText` / `getValue` / `exists` / `waitFor`）。
- `params`：可选，动作参数对象（常见字段：`selector`、`value`、`timeoutMs`、`parentSelectors`）。`getFrameInfo` 使用 `params.frameUrlContains` + `params.similarIndex`。
- `executeMode`：可选，`main` 或 `isolated`，默认 `main`。
- `tabId`：可选，指定注入标签页。
- `frameId`：可选，元素相关动作与 `getInfos` 可指定目标 frame；不填时默认主框架 top frame。
- `urlContains`：可选，未指定 `tabId` 时可按 URL 关键字选页。

若 `tabId` 和 `urlContains` 都没给，扩展会默认注入当前窗口活动标签页。
`getFrameInfo` 会按 `params.frameUrlContains` 模糊匹配 frame URL；若命中多个，可用 `params.similarIndex` 取第 N 个（从 0 开始）。

### Extension -> Native

```json
{
  "type": "inject_result",
  "requestId": "req-001",
  "ok": true,
  "tabId": 123,
  "frameId": 2,
  "executeMode": "isolated",
  "result": {
    "tabId": 123,
    "frameUrlContains": "pay.example.com",
    "similarIndex": 0,
    "matchCount": 2,
    "frame": { "frameId": 2, "parentFrameId": 0, "url": "https://pay.example.com/embedded", "errorOccurred": false }
  }
}
```

失败时：

```json
{
  "type": "inject_result",
  "requestId": "req-001",
  "ok": false,
  "error": "错误信息"
}
```

另外，扩展会响应：

- `ping` -> `pong`

## 3.1) 本地 IPC 网关（RPA <-> native host）

宿主进程（Python 或 Rust 版）启动后会在本机开启 Named Pipe 服务：

- 管道名：`\\.\pipe\rpa_script_bridge`
- 协议：同一套 JSON（UTF-8 文本，单条请求/响应）

这让 RPA 程序无需直接接管 Native Messaging 的 stdin/stdout，只要连本地管道即可。

### RPA -> native host（示例）

```json
{
  "type": "inject",
  "requestId": "req-1001",
  "action": "getText",
  "params": { "selector": "h1" },
  "executeMode": "isolated",
  "urlContains": "example.com"
}
```

### native host -> RPA（示例）

```json
{
  "type": "inject_result",
  "requestId": "req-1001",
  "ok": true,
  "result": "Example Domain"
}
```

### Python 测试客户端

已提供：`client/ipc_client_test.py`

示例命令：

```powershell
python "C:\Job\Work\RPA浏览器扩展\client\ipc_client_test.py" --action getText --selector "h1" --url-contains "example.com"
python "C:\Job\Work\RPA浏览器扩展\client\ipc_client_test.py" --action getFrameInfo --frame-url-contains "pay.example.com" --similar-index 0
python "C:\Job\Work\RPA浏览器扩展\client\ipc_client_test.py" --action click --selector ".submit" --frame-id 2
```

### Native Host 日志开关

默认**不记录**日志。启用方式（Python / Rust 通用）：

1. 在 `host.cmd` 或 `host-rust.cmd` 中取消注释：`set RPA_NATIVE_HOST_LOG=1`
2. 或在系统/用户环境变量中设置 `RPA_NATIVE_HOST_LOG=1`（也支持 `true` / `yes` / `on`）

启用后会写入：

- `native-host/host.log`：消息流水
- `native-host/host-error.log`：错误与 stderr 重定向

## 4) 常见问题

- 无法连接 native host：多半是注册表路径或 manifest 路径错误。
- `Native host has exited`（Windows）：常见原因是 **stdin/stdout 未使用二进制模式**，`\n` 被转成 `\r\n` 会破坏 Chrome 的 Native Messaging 帧协议。Python 版 `host.py` 与 Rust 版均已处理二进制 stdio；若已启用日志开关，可查看 `native-host/host-error.log`。
- 提示不可注入：目标页可能不是 `http/https`，或属于浏览器受限页面（如 `chrome://`）。
- 提示 `unsafe-eval` / CSP：本项目已改为预置动作，不再执行任意 JS 字符串；优先使用 `executeMode: "isolated"`。
- 动作执行失败：优先检查 `selector` 是否匹配页面元素。
