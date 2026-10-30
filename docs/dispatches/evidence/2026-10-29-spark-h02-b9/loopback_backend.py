"""Scripted OpenAI-compatible loopback backend for B9 rehearsals.

Mirrors the StubBackend in crates/harness-sovereign/tests/b9_binary.rs
at the reviewed H01 revision: GET /models -> {}; POST
/chat/completions -> pops one scripted text per request (default
"done") wrapped as SSE data: {"choices":[{"delta":{"content": ...}}]}
followed by data: [DONE]. Logs every request line to a log file.

Usage: python loopback_backend.py <port> <script_file> <log_file>
<script_file>: JSON list of response texts, in order.
"""

import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

port = int(sys.argv[1])
with open(sys.argv[2], encoding="utf-8") as f:
    script = list(json.load(f))
log_path = sys.argv[3]
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, content_type, payload: bytes):
        body = payload
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _handle(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else b""
        with lock:
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"{self.command} {self.path} body_bytes={len(body)}\n")
        if self.path == "/models" or self.path.startswith("/models?"):
            self._send("application/json", b"{}")
        elif self.path.startswith("/chat/completions"):
            with lock:
                text = script.pop(0) if script else "done"
                with open(log_path, "a", encoding="utf-8") as f:
                    f.write(f"  -> scripted reply {len(text)} chars\n")
            event = json.dumps({"choices": [{"delta": {"content": text}}]})
            payload = f"data: {event}\n\ndata: [DONE]\n\n".encode("utf-8")
            self._send("text/event-stream", payload)
        else:
            self._send("text/plain", b"not found")

    do_GET = _handle
    do_POST = _handle

    def log_message(self, *args):
        pass


ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
