#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from multiprocessing.connection import Listener

IPC_PIPE_NAME = "rpa_script_bridge"
IPC_PIPE_ADDRESS = rf"\\.\pipe\{IPC_PIPE_NAME}"


class IpcGateway:
    def __init__(self, on_request, on_client_close, on_error, on_accept=None, max_workers=32):
        self._on_request = on_request
        self._on_client_close = on_client_close
        self._on_error = on_error
        self._on_accept = on_accept
        self._clients = {}
        self._clients_lock = threading.Lock()
        self._next_client_id = 1
        self._listener = None
        self._max_workers = max_workers
        self._executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="ipc-client")

    def get_pool_status(self):
        with self._clients_lock:
            clients = len(self._clients)
        return {
            "poolThreads": len(self._executor._threads),
            "poolMaxWorkers": self._max_workers,
            "clients": clients,
        }

    def _register_client(self, conn):
        with self._clients_lock:
            client_id = self._next_client_id
            self._next_client_id += 1
            self._clients[client_id] = conn
            return client_id

    def _unregister_client(self, client_id):
        with self._clients_lock:
            self._clients.pop(client_id, None)

    def send_to(self, client_id, payload):
        with self._clients_lock:
            conn = self._clients.get(client_id)
        if conn is None:
            return False
        wire = (json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8")
        conn.send_bytes(wire)
        return True

    def broadcast(self, payload):
        with self._clients_lock:
            ids = list(self._clients.keys())
        for client_id in ids:
            try:
                self.send_to(client_id, payload)
            except Exception:
                pass

    def _handle_client(self, client_id, conn):
        try:
            if self._on_accept:
                self._on_accept(client_id)
            while True:
                raw_bytes = conn.recv_bytes()
                raw = raw_bytes.decode("utf-8").strip()
                if not raw:
                    continue
                req = json.loads(raw)
                self._on_request(client_id, req)
        except Exception:
            pass
        finally:
            try:
                conn.close()
            except Exception:
                pass
            self._unregister_client(client_id)
            self._on_client_close(client_id)

    def run_server_loop(self):
        self._listener = Listener(address=IPC_PIPE_ADDRESS, family="AF_PIPE")
        while True:
            try:
                conn = self._listener.accept()
                client_id = self._register_client(conn)
                self._executor.submit(self._handle_client, client_id, conn)
            except Exception as e:
                self._on_error(e)
                break
