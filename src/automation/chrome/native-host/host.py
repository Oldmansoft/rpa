#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Native host 编排层：连接 NativeBridge 与 IpcGateway。"""

import json
import os
import threading
import traceback
import uuid
from pathlib import Path
import sys

from native_bridge import NativeBridge, configure_windows_binary_stdio
from ipc_gateway import IpcGateway, IPC_PIPE_ADDRESS

PENDING = {}
PENDING_LOCK = threading.Lock()
GATEWAY = None

LOG_PATH = Path(__file__).with_name("host.log")
ERROR_LOG_PATH = Path(__file__).with_name("host-error.log")
NATIVE = NativeBridge()


def is_log_enabled() -> bool:
    value = os.environ.get("RPA_NATIVE_HOST_LOG", "").strip().lower()
    return value in ("1", "true", "yes", "on")


LOG_ENABLED = is_log_enabled()


def write_log(payload):
    if not LOG_ENABLED:
        return
    line = json.dumps(payload, ensure_ascii=False)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line + "\n")


def write_error(exc):
    if not LOG_ENABLED:
        return
    with ERROR_LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(repr(exc) + "\n")
        traceback.print_exc(file=f)


def pop_pending_client(request_id):
    with PENDING_LOCK:
        return PENDING.pop(request_id, None)


def set_pending_client(request_id, client_id):
    with PENDING_LOCK:
        PENDING[request_id] = client_id


def remove_client_from_pending(client_id):
    with PENDING_LOCK:
        stale_keys = [k for k, v in PENDING.items() if v == client_id]
        for k in stale_keys:
            PENDING.pop(k, None)


def handle_native_message(msg):
    write_log(msg)

    msg_type = msg.get("type")
    if msg_type == "inject_result":
        req_id = msg.get("requestId")
        client_id = pop_pending_client(req_id)
        if client_id is None:
            return
        try:
            GATEWAY.send_to(client_id, msg)
        except Exception:
            pass
        return

    # 非 request/response 消息广播给所有已连接 IPC 客户端（如 pong、状态事件）
    GATEWAY.broadcast(msg)


def normalize_ipc_request(obj):
    if not isinstance(obj, dict):
        raise ValueError("请求必须为 JSON 对象")

    if obj.get("type") == "ping":
        return {"type": "ping", "requestId": obj.get("requestId") or str(uuid.uuid4())}

    if obj.get("type") == "inject":
        request_id = obj.get("requestId") or str(uuid.uuid4())
        action = obj.get("action")
        if not isinstance(action, str) or not action.strip():
            raise ValueError("inject 请求必须包含 action")
        payload = {
            "type": "inject",
            "requestId": request_id,
            "action": action.strip(),
            "params": obj.get("params") if isinstance(obj.get("params"), dict) else {},
            "executeMode": obj.get("executeMode") or "isolated",
        }
        if isinstance(obj.get("tabId"), int):
            payload["tabId"] = obj["tabId"]
        if isinstance(obj.get("frameId"), int) and obj["frameId"] >= 0:
            payload["frameId"] = obj["frameId"]
        if isinstance(obj.get("urlContains"), str) and obj["urlContains"].strip():
            payload["urlContains"] = obj["urlContains"].strip()
        return payload

    raise ValueError("仅支持 type=inject 或 type=ping")


def handle_ipc_request(client_id, req):
    native_req = normalize_ipc_request(req)
    req_id = native_req.get("requestId")
    if req_id:
        set_pending_client(req_id, client_id)
    NATIVE.send(native_req)
    if native_req["type"] == "ping":
        GATEWAY.send_to(client_id, {"type": "ping_sent", "requestId": req_id, "ok": True})


def on_client_accept(client_id):
    try:
        pool = GATEWAY.get_pool_status()
        message = (
            f"connected from {client_id}; "
            f"线程池状态={pool['poolThreads']}/{pool['poolMaxWorkers']}, "
            f"活跃连接={pool['clients']}"
        )
        GATEWAY.send_to(client_id, {"type": "hello", "ok": True, "version": "1.0.0", "message": message})
    except Exception:
        pass


def on_client_close(client_id):
    remove_client_from_pending(client_id)


if __name__ == "__main__":
    configure_windows_binary_stdio()
    GATEWAY = IpcGateway(
        on_request=handle_ipc_request,
        on_client_close=on_client_close,
        on_error=write_error,
        on_accept=on_client_accept,
    )
    write_log({"type": "ipc_server_started", "pipe": IPC_PIPE_ADDRESS})
    ipc_thread = threading.Thread(target=GATEWAY.run_server_loop, daemon=True)
    ipc_thread.start()

    try:
        NATIVE.run_read_loop(handle_native_message)
    except Exception as e:
        try:
            write_error(e)
        except Exception:
            pass
