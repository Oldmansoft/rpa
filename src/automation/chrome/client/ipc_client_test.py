#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPA IPC 客户端集成测试。

直接运行本文件即可依次执行各 action 测试（无需命令行参数）：
  python ipc_client_test.py

运行前请确保 Chrome 已启动、扩展已启用，且当前窗口有 http/https 页面。
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Callable, List, Optional

from rpa_pipe_client import CallResult, IPC_PIPE_ADDRESS, RpaPipeClient

# 可按实际页面调整
TEST_SELECTOR = "body"
TEST_INPUT_SELECTOR = "input"
TEST_FRAME_URL_CONTAINS = ""
TEST_URL_CONTAINS = ""


@dataclass
class CaseOutcome:
    name: str
    passed: bool
    detail: str
    elapsed_seconds: float = 0.0


def _fmt_result(result: CallResult) -> str:
    if result.timed_out:
        return "timeout"
    if result.response is None:
        return "no response"
    return json.dumps(result.response, ensure_ascii=False)


def assert_ping(result: CallResult) -> None:
    if result.timed_out:
        raise AssertionError("ping 超时")
    if not result.ok:
        raise AssertionError("未收到 ping_sent")
    if result.response.get("ok") is not True:
        raise AssertionError(f"ping 失败: {_fmt_result(result)}")


def assert_inject_ok(result: CallResult, *, expect_result: Optional[Callable[[object], None]] = None) -> None:
    if result.timed_out:
        raise AssertionError("请求超时")
    if not result.inject_ok:
        raise AssertionError(f"inject 失败: {_fmt_result(result)}")
    if expect_result is not None:
        expect_result(result.result)


def _assert_has_keys(obj, keys) -> None:
    if not isinstance(obj, dict):
        raise AssertionError(f"期望 dict，实际 {type(obj).__name__}")
    for key in keys:
        if key not in obj:
            raise AssertionError(f"结果缺少字段: {key}")


def _assert_is_bool(value) -> None:
    if not isinstance(value, bool):
        raise AssertionError(f"期望 bool，实际 {type(value).__name__}")


def _assert_wait_for_one_hit(value) -> None:
    if not isinstance(value, int):
        raise AssertionError(f"期望 int，实际 {type(value).__name__}")
    if value < 0:
        raise AssertionError(f"期望命中下标 >= 0，实际 {value}")


def run_ping_case(name: str, fn: Callable[[RpaPipeClient], CallResult]) -> CaseOutcome:
    client = RpaPipeClient(pipe_address=IPC_PIPE_ADDRESS, verbose=True)
    print(f"\n{'=' * 60}\n[TEST] {name}\n{'=' * 60}")
    result = None
    try:
        result = fn(client)
        assert_ping(result)
        return CaseOutcome(
            name=name,
            passed=True,
            detail=f"ok, response={_fmt_result(result)}",
            elapsed_seconds=result.elapsed_seconds,
        )
    except AssertionError as e:
        elapsed = result.elapsed_seconds if result else 0.0
        return CaseOutcome(name=name, passed=False, detail=str(e), elapsed_seconds=elapsed)
    except ConnectionError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(3) from e


def run_inject_case(
    name: str,
    fn: Callable[[RpaPipeClient], CallResult],
    *,
    expect_result: Optional[Callable[[object], None]] = None,
) -> CaseOutcome:
    client = RpaPipeClient(pipe_address=IPC_PIPE_ADDRESS, verbose=True)
    print(f"\n{'=' * 60}\n[TEST] {name}\n{'=' * 60}")
    result = None
    try:
        result = fn(client)
        assert_inject_ok(result, expect_result=expect_result)
        return CaseOutcome(
            name=name,
            passed=True,
            detail=f"ok, result={json.dumps(result.result, ensure_ascii=False)}",
            elapsed_seconds=result.elapsed_seconds,
        )
    except AssertionError as e:
        elapsed = result.elapsed_seconds if result else 0.0
        return CaseOutcome(name=name, passed=False, detail=str(e), elapsed_seconds=elapsed)
    except ConnectionError as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(3) from e


def build_cases():
    url_kw = {"url_contains": TEST_URL_CONTAINS} if TEST_URL_CONTAINS else {}

    return [
        ("ping", "ping", lambda c: c.ping(), None),
        ("getTabInfo", "inject", lambda c: c.get_tab_info(**url_kw), lambda r: _assert_has_keys(r, ("tabs",))),
        (
            "getFrameInfo",
            "inject",
            lambda c: c.get_frame_info(frame_url_contains=TEST_FRAME_URL_CONTAINS, similar_index=0, **url_kw),
            lambda r: _assert_has_keys(r, ("tabId", "matchCount", "frame")),
        ),
        ("getInfos", "inject", lambda c: c.get_infos(**url_kw), lambda r: _assert_has_keys(r, ("location", "title"))),
        ("exists", "inject", lambda c: c.exists(TEST_SELECTOR, **url_kw), _assert_is_bool),
        ("getText", "inject", lambda c: c.get_text(TEST_SELECTOR, **url_kw), None),
        ("waitFor", "inject", lambda c: c.wait_for(TEST_SELECTOR, timeout_ms=5000, **url_kw), _assert_is_bool),
        (
            "waitForOne",
            "inject",
            lambda c: c.wait_for_one(
                [
                    {"selector": TEST_SELECTOR, "mode": "存在"},
                    {"selector": "html", "mode": "存在"},
                ],
                timeout_ms=5000,
                **url_kw,
            ),
            _assert_wait_for_one_hit,
        ),
        ("getValue", "inject", lambda c: c.get_value(TEST_INPUT_SELECTOR, **url_kw), None),
        ("setValue", "inject", lambda c: c.set_value(TEST_INPUT_SELECTOR, "rpa-test", **url_kw), None),
        ("click", "inject", lambda c: c.click(TEST_SELECTOR, **url_kw), None),
        (
            "trigger",
            "inject",
            lambda c: c.trigger(TEST_SELECTOR, ["mouseover", "mouseout"], delay_ms=50, **url_kw),
            lambda r: _assert_has_keys(r, ("triggered", "count")),
        ),
    ]


def print_summary(outcomes: List[CaseOutcome]) -> int:
    passed = sum(1 for x in outcomes if x.passed)
    total = len(outcomes)
    print(f"\n{'=' * 60}\n[SUMMARY] {passed}/{total} passed\n{'=' * 60}")
    for item in outcomes:
        mark = "PASS" if item.passed else "FAIL"
        elapsed = f", {item.elapsed_seconds:.3f}s" if item.elapsed_seconds else ""
        print(f"  [{mark}] {item.name}{elapsed} — {item.detail}")
    if passed < total:
        print("\n[HINT] 部分用例失败通常是因为当前页面没有匹配元素（如 input）。")
        print("       可在文件顶部调整 TEST_SELECTOR / TEST_INPUT_SELECTOR / TEST_URL_CONTAINS。")
    return 0 if passed == total else 1


def main() -> int:
    outcomes: List[CaseOutcome] = []
    for name, kind, fn, validator in build_cases():
        if kind == "ping":
            outcomes.append(run_ping_case(name, fn))
        else:
            outcomes.append(run_inject_case(name, fn, expect_result=validator))
    return print_summary(outcomes)


if __name__ == "__main__":
    sys.exit(main())
