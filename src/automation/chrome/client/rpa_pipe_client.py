#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RPA 浏览器扩展 IPC 管道客户端。"""

from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import dataclass
from multiprocessing.connection import Client
from typing import Any, Iterable, Literal, Optional, TypedDict, Union

IPC_PIPE_NAME = "rpa_script_bridge"
IPC_PIPE_ADDRESS = rf"\\.\pipe\{IPC_PIPE_NAME}"

WaitMode = Literal["存在", "消失", "可见", "隐藏"]
WAIT_MODES: tuple[str, ...] = ("存在", "消失", "可见", "隐藏")
WAIT_MODE_ALIASES: dict[str, str] = {
    "exist": "存在",
    "exists": "存在",
    "gone": "消失",
    "disappear": "消失",
    "visible": "可见",
    "hidden": "隐藏",
    "hide": "隐藏",
}


def normalize_wait_mode(mode: Union[str, WaitMode]) -> str:
    key = str(mode).strip()
    normalized = WAIT_MODE_ALIASES.get(key.lower(), key)
    if normalized not in WAIT_MODES:
        raise ValueError(f"mode 必须是 {WAIT_MODES} 之一")
    return normalized


class WaitCondition(TypedDict, total=False):
    selector: str
    mode: Union[str, WaitMode]
    text: str
    similar_index: int
    parent_selectors: Iterable[str]
    frame_id: int


@dataclass
class CallResult:
    response: Optional[dict]
    elapsed_seconds: float
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.response is not None and not self.timed_out

    @property
    def inject_ok(self) -> bool:
        return self.ok and self.response.get("type") == "inject_result" and self.response.get("ok") is True

    @property
    def result(self) -> Any:
        if not self.ok:
            return None
        return self.response.get("result")

    @property
    def error(self) -> Optional[str]:
        if not self.ok:
            return None
        return self.response.get("error")


class RpaPipeClient:
    def __init__(
        self,
        pipe_address: str = IPC_PIPE_ADDRESS,
        wait_timeout_ms: int = 15000,
        verbose: bool = False,
    ):
        self.pipe_address = pipe_address
        self.wait_timeout_ms = wait_timeout_ms
        self.verbose = verbose

    def _log(self, message: str) -> None:
        if self.verbose:
            print(message)

    def _new_request_id(self) -> str:
        return str(uuid.uuid4())

    def _build_inject_request(
        self,
        action: str,
        params: Optional[dict] = None,
        *,
        request_id: Optional[str] = None,
        tab_id: Optional[int] = None,
        frame_id: Optional[int] = None,
        url_contains: Optional[str] = None,
        execute_mode: str = "isolated",
    ) -> dict:
        req = {
            "type": "inject",
            "requestId": request_id or self._new_request_id(),
            "action": action,
            "params": dict(params or {}),
            "executeMode": execute_mode,
        }
        if tab_id is not None:
            req["tabId"] = tab_id
        if frame_id is not None:
            if frame_id < 0:
                raise ValueError("frameId 必须是大于等于 0 的整数")
            req["frameId"] = frame_id
        if url_contains:
            req["urlContains"] = url_contains.strip()
        return req

    def _recv_json_lines(self, conn):
        while True:
            line = conn.recv_bytes().decode("utf-8")
            if not line:
                return
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)

    def call(
        self,
        request: dict,
        *,
        result_type: str = "inject_result",
        wait_timeout_ms: Optional[int] = None,
        verbose: Optional[bool] = None,
    ) -> CallResult:
        request_id = request.get("requestId")
        if not request_id:
            raise ValueError("requestId 不能为空")

        timeout_ms = self.wait_timeout_ms if wait_timeout_ms is None else wait_timeout_ms
        show_log = self.verbose if verbose is None else verbose
        result = CallResult(response=None, elapsed_seconds=0.0)
        started = time.perf_counter()

        def log(message: str) -> None:
            if show_log:
                print(message)

        try:
            with Client(address=self.pipe_address, family="AF_PIPE") as conn:
                log(f"[INFO] Connected to pipe: {self.pipe_address}")
                wire = json.dumps(request, ensure_ascii=False) + "\n"
                conn.send_bytes(wire.encode("utf-8"))
                log(
                    f"[INFO] Request sent: requestId={request_id}, type={request.get('type')}, "
                    f"action={request.get('action')}, wait_timeout_ms={timeout_ms}"
                )

                timer = None
                if timeout_ms and timeout_ms > 0:
                    timer = threading.Timer(timeout_ms / 1000.0, conn.close)
                    timer.daemon = True
                    timer.start()

                for msg in self._recv_json_lines(conn):
                    log("[RECV] " + json.dumps(msg, ensure_ascii=False))
                    msg_type = msg.get("type")
                    if msg.get("requestId") == request_id and msg_type == result_type:
                        result.response = msg
                        break
                    if msg_type not in ("hello",):
                        log(
                            f"[INFO] Ignore message: type={msg_type}, requestId={msg.get('requestId')}"
                        )

                if timer:
                    timer.cancel()
        except (FileNotFoundError, ConnectionRefusedError, OSError) as e:
            elapsed = time.perf_counter() - started
            if elapsed * 1000 >= timeout_ms > 0:
                result.elapsed_seconds = elapsed
                result.timed_out = True
                log(f"[ERROR] Request timed out: requestId={request_id}, waited={timeout_ms}ms")
                return result
            raise ConnectionError(
                "无法连接 Native Host IPC 管道。\n"
                "请确认：\n"
                "1) Chrome 浏览器已经启动；\n"
                "2) 浏览器扩展已安装并启用；\n"
                "3) native-host 已被扩展成功拉起（Python host.py 或 Rust rpa_native_host.exe）；\n"
                "4) 若刚切换/更新 Rust 宿主，请重新加载扩展或重启 Chrome。"
            ) from e

        result.elapsed_seconds = time.perf_counter() - started
        return result

    def ping(self, *, request_id: Optional[str] = None, wait_timeout_ms: Optional[int] = None) -> CallResult:
        req = {"type": "ping", "requestId": request_id or self._new_request_id()}
        return self.call(req, result_type="ping_sent", wait_timeout_ms=wait_timeout_ms)

    def inject(
        self,
        action: str,
        params: Optional[dict] = None,
        *,
        tab_id: Optional[int] = None,
        frame_id: Optional[int] = None,
        url_contains: Optional[str] = None,
        execute_mode: str = "isolated",
        request_id: Optional[str] = None,
        wait_timeout_ms: Optional[int] = None,
    ) -> CallResult:
        req = self._build_inject_request(
            action,
            params,
            request_id=request_id,
            tab_id=tab_id,
            frame_id=frame_id,
            url_contains=url_contains,
            execute_mode=execute_mode,
        )
        return self.call(req, wait_timeout_ms=wait_timeout_ms)

    def get_tab_info(self, **kwargs) -> CallResult:
        return self.inject("getTabInfo", **kwargs)

    def get_frame_info(
        self,
        *,
        frame_url_contains: str = "",
        similar_index: int = 0,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        if similar_index < 0:
            raise ValueError("similarIndex 必须是大于等于 0 的整数")
        params = {"similarIndex": similar_index}
        if frame_url_contains:
            params["frameUrlContains"] = frame_url_contains.strip()
        return self.inject("getFrameInfo", params, tab_id=tab_id, **kwargs)

    def get_infos(self, *, frame_id: Optional[int] = None, tab_id: Optional[int] = None, **kwargs) -> CallResult:
        return self.inject("getInfos", tab_id=tab_id, frame_id=frame_id, **kwargs)

    def click(
        self,
        selector: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        return self.inject("click", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def set_value(
        self,
        selector: str,
        value: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        params["value"] = value
        return self.inject("setValue", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def get_value(
        self,
        selector: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        return self.inject("getValue", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def set_text(
        self,
        selector: str,
        content: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        params["content"] = content
        return self.inject("setText", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def get_text(
        self,
        selector: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        return self.inject("getText", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def set_attribute(
        self,
        selector: str,
        name: str,
        value: str = "",
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        params["name"] = name.strip()
        params["value"] = value
        return self.inject("setAttribute", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def get_attribute(
        self,
        selector: str,
        name: str,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        params["name"] = name.strip()
        return self.inject("getAttribute", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def exists(
        self,
        selector: str,
        *,
        mode: Optional[Union[str, WaitMode]] = None,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        if mode is not None:
            params["mode"] = normalize_wait_mode(mode)
        return self.inject("exists", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    def wait_for(
        self,
        selector: str,
        *,
        mode: Union[str, WaitMode] = "存在",
        timeout_ms: int = 5000,
        poll_interval_ms: int = 100,
        text: Optional[str] = None,
        similar_index: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        if timeout_ms < 100:
            raise ValueError("timeout_ms 必须 >= 100")
        if poll_interval_ms < 0:
            raise ValueError("poll_interval_ms 必须 >= 0")

        normalized_mode = normalize_wait_mode(mode)
        exists_kwargs = dict(kwargs)
        per_call_timeout = exists_kwargs.pop("wait_timeout_ms", self.wait_timeout_ms)
        started = time.perf_counter()
        deadline = started + timeout_ms / 1000.0

        while time.perf_counter() < deadline:
            result = self.exists(
                selector,
                mode=normalized_mode,
                text=text,
                similar_index=similar_index,
                parent_selectors=parent_selectors,
                frame_id=frame_id,
                tab_id=tab_id,
                wait_timeout_ms=per_call_timeout,
                **exists_kwargs,
            )
            if result.inject_ok:
                if result.result is True:
                    return CallResult(
                        response={"type": "inject_result", "ok": True, "result": True},
                        elapsed_seconds=time.perf_counter() - started,
                    )
            elif not result.timed_out:
                return CallResult(
                    response=result.response,
                    elapsed_seconds=time.perf_counter() - started,
                )

            remaining = deadline - time.perf_counter()
            if remaining <= 0:
                break
            time.sleep(min(poll_interval_ms / 1000.0, remaining))

        mode_errors = {
            "存在": f"等待元素出现超时: {selector}",
            "消失": f"等待元素消失超时: {selector}",
            "可见": f"等待元素可见超时: {selector}",
            "隐藏": f"等待元素隐藏超时: {selector}",
        }
        return CallResult(
            response={
                "type": "inject_result",
                "ok": False,
                "error": mode_errors.get(normalized_mode, f"等待元素超时: {selector}"),
            },
            elapsed_seconds=time.perf_counter() - started,
        )

    def wait_for_one(
        self,
        conditions: Iterable[Union[WaitCondition, dict[str, Any]]],
        *,
        timeout_ms: int = 5000,
        poll_interval_ms: int = 100,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        if timeout_ms < 100:
            raise ValueError("timeout_ms 必须 >= 100")
        if poll_interval_ms < 0:
            raise ValueError("poll_interval_ms 必须 >= 0")

        normalized_conditions = [self._normalize_wait_condition(item) for item in conditions]
        if not normalized_conditions:
            raise ValueError("conditions 不能为空")

        exists_kwargs = dict(kwargs)
        per_call_timeout = exists_kwargs.pop("wait_timeout_ms", self.wait_timeout_ms)
        started = time.perf_counter()
        deadline = started + timeout_ms / 1000.0

        while time.perf_counter() < deadline:
            for index, condition in enumerate(normalized_conditions):
                result = self.exists(
                    condition["selector"],
                    mode=condition["mode"],
                    text=condition.get("text"),
                    similar_index=condition.get("similar_index", 0),
                    parent_selectors=condition.get("parent_selectors"),
                    frame_id=condition.get("frame_id"),
                    tab_id=tab_id,
                    wait_timeout_ms=per_call_timeout,
                    **exists_kwargs,
                )
                if result.inject_ok:
                    if result.result is True:
                        return CallResult(
                            response={"type": "inject_result", "ok": True, "result": index},
                            elapsed_seconds=time.perf_counter() - started,
                        )
                elif not result.timed_out:
                    return CallResult(
                        response=result.response,
                        elapsed_seconds=time.perf_counter() - started,
                    )

            remaining = deadline - time.perf_counter()
            if remaining <= 0:
                break
            time.sleep(min(poll_interval_ms / 1000.0, remaining))

        return CallResult(
            response={"type": "inject_result", "ok": True, "result": -1},
            elapsed_seconds=time.perf_counter() - started,
        )

    def trigger(
        self,
        selector: str,
        events: Iterable[str],
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
        event_init: Optional[dict] = None,
        delay_ms: int = 0,
        parent_selectors: Optional[Iterable[str]] = None,
        frame_id: Optional[int] = None,
        tab_id: Optional[int] = None,
        **kwargs,
    ) -> CallResult:
        params = self._selector_params(selector, parent_selectors, text=text, similar_index=similar_index)
        params["events"] = list(events)
        if event_init:
            params["eventInit"] = event_init
        if delay_ms > 0:
            params["delayMs"] = delay_ms
        return self.inject("trigger", params, tab_id=tab_id, frame_id=frame_id, **kwargs)

    @staticmethod
    def _normalize_wait_condition(condition: Union[WaitCondition, dict[str, Any]]) -> dict[str, Any]:
        if not isinstance(condition, dict):
            raise ValueError("每个等待条件必须是 dict")

        selector = str(condition.get("selector", "")).strip()
        if not selector:
            raise ValueError("每个等待条件都必须包含非空 selector")

        mode = normalize_wait_mode(condition.get("mode", "存在"))
        similar_index = condition.get("similar_index", 0)
        if not isinstance(similar_index, int) or similar_index < 0:
            raise ValueError("similar_index 必须是大于等于 0 的整数")

        frame_id = condition.get("frame_id")
        if frame_id is not None and (not isinstance(frame_id, int) or frame_id < 0):
            raise ValueError("frame_id 必须是大于等于 0 的整数")

        text = condition.get("text")
        parent_selectors = condition.get("parent_selectors")

        normalized: dict[str, Any] = {
            "selector": selector,
            "mode": mode,
            "similar_index": similar_index,
        }
        if text:
            normalized["text"] = str(text).strip()
        if parent_selectors:
            normalized["parent_selectors"] = list(parent_selectors)
        if frame_id is not None:
            normalized["frame_id"] = frame_id
        return normalized

    @staticmethod
    def _selector_params(
        selector: str,
        parent_selectors: Optional[Iterable[str]] = None,
        *,
        text: Optional[str] = None,
        similar_index: int = 0,
    ) -> dict:
        if similar_index < 0:
            raise ValueError("similar_index 必须是大于等于 0 的整数")
        params = {"selector": selector, "similarIndex": similar_index}
        if parent_selectors:
            params["parentSelectors"] = list(parent_selectors)
        if text:
            params["text"] = text.strip()
        return params
