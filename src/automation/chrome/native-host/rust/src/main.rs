//! Native host 编排层：连接 NativeBridge 与 IpcGateway。

mod ipc_gateway;
mod native_bridge;

use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

use ipc_gateway::{AcceptHandler, ClientCloseHandler, ErrorHandler, IpcGateway, RequestHandler, IPC_PIPE_NAME};
use native_bridge::{configure_windows_binary_stdio, NativeBridge};
use serde_json::{json, Map, Value};

fn new_request_id() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("req-{nanos}")
}

fn is_log_enabled() -> bool {
    match std::env::var("RPA_NATIVE_HOST_LOG") {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
        }
        Err(_) => false,
    }
}

struct HostContext {
    pending: Mutex<HashMap<String, u64>>,
    native: NativeBridge,
    log_enabled: bool,
    log_path: PathBuf,
    error_log_path: PathBuf,
}

impl HostContext {
    fn write_log(&self, payload: &Value) {
        if !self.log_enabled {
            return;
        }
        if let Ok(line) = serde_json::to_string(payload) {
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.log_path)
            {
                let _ = writeln!(file, "{line}");
            }
        }
    }

    fn write_error(&self, err: impl std::fmt::Display) {
        if !self.log_enabled {
            return;
        }
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.error_log_path)
        {
            let _ = writeln!(file, "{err}");
        }
    }

    fn pop_pending_client(&self, request_id: &str) -> Option<u64> {
        self.pending
            .lock()
            .expect("pending lock poisoned")
            .remove(request_id)
    }

    fn set_pending_client(&self, request_id: String, client_id: u64) {
        self.pending
            .lock()
            .expect("pending lock poisoned")
            .insert(request_id, client_id);
    }

    fn remove_client_from_pending(&self, client_id: u64) {
        let mut pending = self.pending.lock().expect("pending lock poisoned");
        pending.retain(|_, value| *value != client_id);
    }

    fn handle_native_message(&self, gateway: &IpcGateway, msg: Value) {
        self.write_log(&msg);

        if msg.get("type").and_then(Value::as_str) == Some("inject_result") {
            let req_id = msg
                .get("requestId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if req_id.is_empty() {
                return;
            }
            let Some(client_id) = self.pop_pending_client(req_id) else {
                return;
            };
            let _ = gateway.send_to(client_id, &msg);
            return;
        }

        gateway.broadcast(&msg);
    }

    fn normalize_ipc_request(obj: &Value) -> Result<Value, String> {
        let Some(obj) = obj.as_object() else {
            return Err("请求必须为 JSON 对象".to_string());
        };

        let msg_type = obj.get("type").and_then(Value::as_str).unwrap_or_default();
        if msg_type == "ping" {
            let request_id = obj
                .get("requestId")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(new_request_id);
            return Ok(json!({
                "type": "ping",
                "requestId": request_id,
            }));
        }

        if msg_type == "inject" {
            let request_id = obj
                .get("requestId")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(new_request_id);
            let action = obj
                .get("action")
                .and_then(Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .ok_or_else(|| "inject 请求必须包含 action".to_string())?;

            let params = obj
                .get("params")
                .and_then(Value::as_object)
                .cloned()
                .unwrap_or_else(Map::new);

            let mut payload = json!({
                "type": "inject",
                "requestId": request_id,
                "action": action,
                "params": params,
                "executeMode": obj
                    .get("executeMode")
                    .and_then(Value::as_str)
                    .unwrap_or("isolated"),
            });

            if let Some(tab_id) = obj.get("tabId").and_then(Value::as_i64) {
                payload["tabId"] = json!(tab_id);
            }
            if let Some(frame_id) = obj.get("frameId").and_then(Value::as_i64) {
                if frame_id >= 0 {
                    payload["frameId"] = json!(frame_id);
                }
            }
            if let Some(url_contains) = obj.get("urlContains").and_then(Value::as_str) {
                let trimmed = url_contains.trim();
                if !trimmed.is_empty() {
                    payload["urlContains"] = json!(trimmed);
                }
            }
            return Ok(payload);
        }

        Err("仅支持 type=inject 或 type=ping".to_string())
    }

    fn handle_ipc_request(&self, gateway: &IpcGateway, client_id: u64, req: Value) {
        let native_req = match Self::normalize_ipc_request(&req) {
            Ok(value) => value,
            Err(err) => {
                let _ = gateway.send_to(
                    client_id,
                    &json!({
                        "type": "error",
                        "ok": false,
                        "error": err,
                    }),
                );
                return;
            }
        };

        let req_id = native_req
            .get("requestId")
            .and_then(Value::as_str)
            .map(str::to_string);
        if let Some(request_id) = req_id.clone() {
            self.set_pending_client(request_id, client_id);
        }

        if let Err(err) = self.native.send(&native_req) {
            self.write_error(err);
            return;
        }

        if native_req.get("type").and_then(Value::as_str) == Some("ping") {
            let _ = gateway.send_to(
                client_id,
                &json!({
                    "type": "ping_sent",
                    "requestId": req_id,
                    "ok": true,
                }),
            );
        }
    }

    fn on_client_accept(&self, gateway: &IpcGateway, client_id: u64) {
        let pool = gateway.get_pool_status();
        let message = format!(
            "connected from {client_id}; 线程池状态={}/{}, 活跃连接={}",
            pool["poolThreads"], pool["poolMaxWorkers"], pool["clients"]
        );
        let _ = gateway.send_to(
            client_id,
            &json!({
                "type": "hello",
                "ok": true,
                "version": "1.0.0",
                "message": message,
            }),
        );
    }
}

fn log_paths() -> (PathBuf, PathBuf) {
    let base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    (base.join("host.log"), base.join("host-error.log"))
}

fn main() {
    #[cfg(not(windows))]
    {
        eprintln!("rpa_native_host 目前仅支持 Windows。");
        std::process::exit(1);
    }

    configure_windows_binary_stdio();

    let (log_path, error_log_path) = log_paths();
    let log_enabled = is_log_enabled();
    let ctx = Arc::new(HostContext {
        pending: Mutex::new(HashMap::new()),
        native: NativeBridge::new(),
        log_enabled,
        log_path,
        error_log_path,
    });

    let gateway_slot: Arc<Mutex<Option<Arc<IpcGateway>>>> = Arc::new(Mutex::new(None));

    let ctx_for_request = Arc::clone(&ctx);
    let gateway_slot_for_request = Arc::clone(&gateway_slot);
    let on_request: RequestHandler = Arc::new(move |client_id, req| {
        let gateway = gateway_slot_for_request
            .lock()
            .expect("gateway slot lock poisoned")
            .clone()
            .expect("gateway not initialized");
        ctx_for_request.handle_ipc_request(&gateway, client_id, req);
    });

    let ctx_for_close = Arc::clone(&ctx);
    let on_client_close: ClientCloseHandler = Arc::new(move |client_id| {
        ctx_for_close.remove_client_from_pending(client_id);
    });

    let ctx_for_accept = Arc::clone(&ctx);
    let gateway_slot_for_accept = Arc::clone(&gateway_slot);
    let on_accept: AcceptHandler = Arc::new(move |client_id| {
        let gateway = gateway_slot_for_accept
            .lock()
            .expect("gateway slot lock poisoned")
            .clone()
            .expect("gateway not initialized");
        ctx_for_accept.on_client_accept(&gateway, client_id);
    });

    let gateway = Arc::new(IpcGateway::new(
        on_request,
        on_client_close,
        Some(on_accept),
        32,
    ));
    *gateway_slot.lock().expect("gateway slot lock poisoned") = Some(Arc::clone(&gateway));

    ctx.write_log(&json!({
        "type": "ipc_server_started",
        "pipe": IPC_PIPE_NAME,
        "runtime": "rust",
    }));

    let gateway_for_thread = Arc::clone(&gateway);
    let ctx_for_errors = Arc::clone(&ctx);
    let on_error: ErrorHandler = Arc::new(move |err| {
        ctx_for_errors.write_error(err);
    });
    thread::spawn(move || gateway_for_thread.run_server_loop(on_error));

    let ctx_for_native = Arc::clone(&ctx);
    let gateway_for_native = Arc::clone(&gateway);
    if let Err(err) = ctx.native.run_read_loop(move |msg| {
        ctx_for_native.handle_native_message(&gateway_for_native, msg);
    }) {
        ctx.write_error(err);
    }
}
