#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import os
import struct
import sys
import threading


def configure_windows_binary_stdio():
    if sys.platform != "win32":
        return
    import msvcrt

    msvcrt.setmode(sys.stdin.fileno(), os.O_BINARY)
    msvcrt.setmode(sys.stdout.fileno(), os.O_BINARY)


def _read_message():
    raw_len = sys.stdin.buffer.read(4)
    if len(raw_len) == 0:
        return None
    if len(raw_len) < 4:
        raise RuntimeError("Invalid message length")
    message_len = struct.unpack("=I", raw_len)[0]
    data = sys.stdin.buffer.read(message_len)
    if len(data) < message_len:
        raise RuntimeError("Incomplete message payload")
    return json.loads(data.decode("utf-8"))


def _send_message(payload):
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("=I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


class NativeBridge:
    def __init__(self):
        self._lock = threading.Lock()

    def send(self, payload):
        with self._lock:
            _send_message(payload)

    def run_read_loop(self, on_message):
        while True:
            msg = _read_message()
            if msg is None:
                break
            on_message(msg)
