#!/usr/bin/env python3
"""End-to-end check of the transport layer against a REAL HTTP server on
loopback - no mocks: real sockets, real chunked delivery, a real mid-run
socket drop. Also validates the RunAgentInput we POST against
ag-ui-protocol's own schema. Exits 1 if any endpoint produces unexpected
findings. Mirrors js/scripts/e2e-live-server.mjs's eight endpoint
personalities and expectations exactly (see docs/TESTING.md §6 for why this
script exists - it was run by hand during PM5's review but never
committed until now).

Usage: python py/scripts/e2e_live_server.py
"""

from __future__ import annotations

import asyncio
import json
import socket
import struct
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import ag_ui.core as core  # noqa: E402
from pydantic import ValidationError  # noqa: E402

from ag_ui_validate.transport import TransportError, validate_endpoint  # noqa: E402

RUN = [
    {"type": "RUN_STARTED", "threadId": "t1", "runId": "r1", "timestamp": 1},
    {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "timestamp": 2},
    {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hello from a real server", "timestamp": 3},
    {"type": "TEXT_MESSAGE_END", "messageId": "m1", "timestamp": 4},
    {"type": "RUN_FINISHED", "threadId": "t1", "runId": "r1", "timestamp": 5},
]


def frame(o: dict) -> bytes:
    return f"data: {json.dumps(o)}\n\n".encode()


last_input_validation = None


class Handler(BaseHTTPRequestHandler):
    # Default protocol_version ("HTTP/1.0") closes the connection after
    # every response — no Content-Length or chunked-encoding bookkeeping
    # needed to stream a body of unknown-in-advance length, and it gives
    # /drop a real, unbuffered connection to sever mid-write.
    server_version = "e2e-live-server/1"

    def log_message(self, format, *args):  # noqa: A002 - stdlib signature
        pass  # silence per-request access log noise

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionError, OSError):
            pass  # expected on /drop's abrupt close

    def do_POST(self):
        global last_input_validation
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            core.RunAgentInput.model_validate(json.loads(body))
            last_input_validation = "SDK-VALID"
        except ValidationError as e:
            last_input_validation = "SDK-INVALID: " + "; ".join(
                f"{'.'.join(str(p) for p in issue['loc'])} {issue['msg']}" for issue in e.errors()
            )
        except (ValueError, TypeError) as e:
            last_input_validation = f"SDK-INVALID: {e}"
        self._route()

    def do_GET(self):
        self._route()

    def _sse_header(self, content_type: str = "text/event-stream") -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()

    def _write(self, data: bytes) -> None:
        self.wfile.write(data)
        self.wfile.flush()

    def _route(self) -> None:  # noqa: PLR0912 - one branch per endpoint personality, mirrors the TS switch
        path = self.path
        if path == "/good-sse":
            self._sse_header()
            for e in RUN:
                self._write(frame(e))
                time.sleep(0.005)
        elif path == "/good-ndjson":
            self._sse_header("application/x-ndjson")
            for e in RUN:
                self._write((json.dumps(e) + "\n").encode())
                time.sleep(0.005)
        elif path == "/missing-prefix":
            self._sse_header()
            self._write(frame(RUN[0]))
            time.sleep(0.005)
            # The classic broken server: a payload with no "data:" prefix.
            self._write((json.dumps({"type": "CUSTOM", "name": "acme.ping", "value": 1, "timestamp": 2}) + "\n\n").encode())
            time.sleep(0.005)
            for e in RUN[1:]:
                self._write(frame(e))
                time.sleep(0.005)
        elif path == "/wrong-content-type":
            self._sse_header("application/json")
            for e in RUN:
                self._write(frame(e))
                time.sleep(0.005)
        elif path == "/buffered":
            self._sse_header()
            self._write(b"".join(frame(e) for e in RUN))  # one write, never incrementally flushed
        elif path == "/drop":
            self._sse_header()
            self._write(frame(RUN[0]))
            time.sleep(0.005)
            self._write(frame(RUN[1]))
            time.sleep(0.005)
            # SO_LINGER(0) forces a hard RST on close, the same abrupt
            # mid-run failure Node's res.destroy() produces.
            self.connection.setsockopt(socket.SOL_SOCKET, socket.SO_LINGER, struct.pack("ii", 1, 0))
            self.connection.close()
            self.close_connection = True
        elif path == "/protocol-bugs":
            self._sse_header()
            self._write(frame({"type": "RUN_STARTED", "threadId": "t1", "runId": "r9", "timestamp": 1}))
            time.sleep(0.005)
            self._write(frame({"type": "TOOL_CALL_START", "toolCallId": "call_7", "toolCallName": "x", "timestamp": 2}))
            time.sleep(0.005)
            self._write(frame({"type": "RUN_FINISHED", "threadId": "t1", "runId": "r9", "timestamp": 3}))
        else:
            self.send_response(503)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self._write(b"nope")

    def handle_error(self, request, client_address):  # noqa: ARG002 - stdlib signature
        pass  # /drop's forced RST is expected; don't spam stderr with it


# endpoint -> exactly the rules it must fire
EXPECT = {
    "good-sse": [],
    "good-ndjson": [],
    "missing-prefix": ["AGUI501"],
    "wrong-content-type": ["AGUI505"],
    "buffered": ["AGUI507"],
    "drop": ["AGUI508", "AGUI003", "AGUI103"],
    "protocol-bugs": ["AGUI203"],
}


async def main() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    server.daemon_threads = True
    thread = None
    import threading

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"

    failures = 0
    try:
        for route, expected in EXPECT.items():
            result = await validate_endpoint(f"{base}/{route}")
            fired = [d.rule for d in result.report.diagnostics]
            ok = fired == expected
            if not ok:
                failures += 1
            print(
                "PASS" if ok else "FAIL",
                route.ljust(20),
                f"events={str(result.event_count).ljust(3)}",
                f"findings=[{','.join(fired) or 'none'}]",
                "" if ok else f"expected=[{','.join(expected)}]",
            )

        if last_input_validation != "SDK-VALID":
            failures += 1
            print("FAIL RunAgentInput:", last_input_validation)
        else:
            print("PASS POSTed RunAgentInput validates against ag-ui-protocol")

        try:
            await validate_endpoint(f"{base}/http-error")
            failures += 1
            print("FAIL http-error: expected TransportError, none thrown")
        except TransportError as e:
            ok = "503" in str(e)
            if not ok:
                failures += 1
            print("PASS" if ok else "FAIL", "http-error".ljust(20), str(e))
    finally:
        server.shutdown()
        thread.join(timeout=5)

    if failures > 0:
        print(f"\n{failures} e2e check(s) failed", file=sys.stderr)
        return 1
    print("\nall live-transport checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
