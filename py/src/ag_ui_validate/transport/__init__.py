"""ag-ui-validate.transport: SSE + NDJSON clients over the pure core.

This is the I/O layer - HTTP, streams, and clocks live here, never in the
core. The default HTTP client is httpx (optional [transport] extra); a
custom fetch_impl can be injected to avoid the dependency entirely.

Python-idiom simplifications versus the TS transport layer:
  - No ReadableStream/AsyncIterable duck-typing helper (iterateBody): Python
    async iterables are a single uniform protocol, so body is always just
    consumed with `async for`.
  - No AbortController/AbortSignal: cancellation is native asyncio (cancel
    the task / close the async generator). timeout_ms is passed to the
    fetch_impl as timeout_s, which the default httpx-based implementation
    honors as a connect+read+write+pool timeout - this reproduces both TS
    behaviors (timeout during connect -> TransportError; timeout mid-stream
    -> caught inside validate_body's read loop as a transportError
    diagnostic) without a separate cancellation-token mechanism.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import (
    Any,
    AsyncGenerator,
    AsyncIterable,
    Awaitable,
    Callable,
    Dict,
    List,
    Optional,
    Protocol,
)

from ..engine import create_validator
from ..types import Diagnostic, Report, ValidatorOptions
from .ndjson import ndjson_lines
from .sse import sse_items

__all__ = [
    "ndjson_lines",
    "sse_items",
    "TransportError",
    "TransportOptions",
    "TransportResult",
    "FetchLike",
    "TransportResponseLike",
    "default_run_agent_input",
    "validate_body",
    "validate_endpoint",
]

_DEFAULT_KEEPALIVE_MS = 30_000


class TransportError(Exception):
    """Operational failure (unreachable endpoint, non-2xx, no body) -
    distinct from conformance findings, which are diagnostics."""

    def __init__(self, message: str, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


class _HeadersLike(Protocol):
    def get(self, name: str) -> Optional[str]: ...


@dataclass
class TransportResponseLike:
    status: int
    headers: _HeadersLike
    body: Optional[AsyncIterable[bytes]]


FetchLike = Callable[..., Awaitable[TransportResponseLike]]


@dataclass
class TransportOptions:
    """Options passed to validate_body / validate_endpoint."""

    # Options passed through to create_validator ("transport" layer is added).
    validator: Optional[ValidatorOptions] = None
    # Extra request headers (validate_endpoint only).
    headers: Optional[Dict[str, str]] = None
    # RunAgentInput to POST; defaults to a minimal valid input with one user message.
    input: Optional[Any] = None
    method: str = "POST"
    # AGUI506 window; default 30 000 ms.
    keepalive_window_ms: int = _DEFAULT_KEEPALIVE_MS
    # Abort the request after this long (validate_endpoint only).
    timeout_ms: Optional[int] = None
    # Injectable fetch (tests, custom stacks). Default: an httpx-based client.
    fetch_impl: Optional[FetchLike] = None
    # Injectable clock for keepalive/buffering measurement. Default: time.monotonic (ms).
    now: Optional[Callable[[], float]] = None
    # The body is a recording (file, stdin) rather than a live connection.
    # Timing-based rules (AGUI506, AGUI507) and mid-stream disconnect detection
    # (AGUI508) are meaningless for recordings; they are reported as skipped
    # with a reason instead of risking false positives, and read failures
    # become TransportErrors (tool failure) rather than AGUI508 findings.
    recorded: bool = False
    # Called after each fed event with the diagnostics it produced.
    on_event: Optional[Callable[[str, List[Diagnostic]], None]] = None
    # Called for every diagnostic as soon as it is detected.
    on_diagnostic: Optional[Callable[[Diagnostic], None]] = None


@dataclass
class TransportResult:
    report: Report
    # HTTP status; None when validating a bare body/recording.
    status: Optional[int]
    content_type: Optional[str]
    # Events fed to the validator (SSE frames / NDJSON lines).
    event_count: int
    # Present when the connection failed mid-stream (see AGUI508).
    transport_error: Optional[str] = None


def _random_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def default_run_agent_input() -> Dict[str, Any]:
    """The minimal valid RunAgentInput POSTed when none is supplied."""
    return {
        "threadId": _random_id("thread"),
        "runId": _random_id("run"),
        "state": {},
        "messages": [
            {"id": _random_id("msg"), "role": "user", "content": "Hello! Please respond briefly."}
        ],
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }


async def _sniff_format(
    source: AsyncGenerator[bytes, None],
) -> "tuple[str, AsyncGenerator[bytes, None]]":
    """Buffers up to the first line to guess SSE vs NDJSON, then replays."""
    import codecs

    held: List[bytes] = []
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    text = ""
    while "\n" not in text and len(text) < 4096:
        try:
            value = await source.__anext__()
        except StopAsyncIteration:
            break
        held.append(value)
        text += decoder.decode(value)
    first_line = text.split("\n", 1)[0].strip()
    format_ = "ndjson" if first_line.startswith("{") or first_line.startswith("[") else "sse"

    async def replay() -> AsyncGenerator[bytes, None]:
        for chunk in held:
            yield chunk
        async for chunk in source:
            yield chunk

    return format_, replay()


async def validate_body(
    body: AsyncIterable[bytes],
    content_type: Optional[str],
    opts: Optional[TransportOptions] = None,
) -> TransportResult:
    import time

    opts = opts or TransportOptions()
    user_layers = list((opts.validator.layers if opts.validator and opts.validator.layers else []))
    layers = list(dict.fromkeys([*user_layers, "core", "transport"]))
    validator_opts = opts.validator or ValidatorOptions()
    v = create_validator(
        ValidatorOptions(
            spec=validator_opts.spec,
            features=validator_opts.features,
            severity_overrides=validator_opts.severity_overrides,
            layers=layers,
        )
    )
    now = opts.now or (lambda: time.monotonic() * 1000)
    keepalive_window = opts.keepalive_window_ms or _DEFAULT_KEEPALIVE_MS
    recorded = opts.recorded is True

    def emit_transport(
        rule: str, params: Optional[Dict[str, Any]] = None, extra: Optional[Dict[str, Any]] = None
    ) -> Optional[Diagnostic]:
        d = v.emit_external(rule, params, extra)
        if d is not None and opts.on_diagnostic is not None:
            opts.on_diagnostic(d)
        return d

    chunk_count = 0
    max_gap_ms = 0.0
    last_arrival: Optional[float] = None

    async def tapped() -> AsyncGenerator[bytes, None]:
        nonlocal chunk_count, max_gap_ms, last_arrival
        async for chunk in body:
            t = now()
            if last_arrival is not None:
                max_gap_ms = max(max_gap_ms, t - last_arrival)
            last_arrival = t
            chunk_count += 1
            yield chunk

    mime = None if content_type is None else content_type.split(";")[0].strip().lower()
    if content_type is None:
        v.mark_skipped("AGUI505", "no Content-Type header is available for this input")
    elif mime != "text/event-stream" and mime != "application/x-ndjson":
        emit_transport("AGUI505", {"contentType": mime if mime != "" else "(none)"})
    if recorded:
        v.mark_skipped("AGUI506", "keepalive timing is not meaningful for recorded input")
        v.mark_skipped("AGUI507", "chunk arrival timing is not meaningful for recorded input")
        v.mark_skipped(
            "AGUI508",
            "abnormal disconnects cannot be distinguished from end-of-capture in recorded input",
        )

    stream: AsyncGenerator[bytes, None] = tapped()
    if mime == "text/event-stream":
        format_ = "sse"
    elif mime == "application/x-ndjson":
        format_ = "ndjson"
    else:
        format_, stream = await _sniff_format(stream)
    if format_ == "ndjson":
        v.mark_skipped("AGUI501", "the stream is NDJSON; there is no SSE framing to check")

    event_count = 0
    run_open = False
    open_run_id: Optional[str] = None

    def feed_raw(raw: str) -> None:
        nonlocal event_count, run_open, open_run_id
        event_count += 1
        diags = v.feed(raw)
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                if parsed.get("type") == "RUN_STARTED":
                    run_open = True
                    run_id = parsed.get("runId")
                    open_run_id = run_id if isinstance(run_id, str) else None
                elif parsed.get("type") in ("RUN_FINISHED", "RUN_ERROR"):
                    run_open = False
        except (ValueError, TypeError):
            pass  # unparseable payloads are already AGUI502 diagnostics from the core
        if opts.on_event is not None:
            opts.on_event(raw, diags)
        if opts.on_diagnostic is not None:
            for d in diags:
                opts.on_diagnostic(d)

    transport_error: Optional[str] = None
    try:
        if format_ == "sse":
            async for item in sse_items(stream):
                if item.kind == "event":
                    feed_raw(item.data)
                elif item.kind == "problem":
                    emit_transport("AGUI501", {"detail": item.detail})
        else:
            async for line in ndjson_lines(stream):
                feed_raw(line)
    except Exception as e:  # noqa: BLE001 - mirrors TS's catch-all
        if recorded:
            # A read failure on a recording is a broken input, not an
            # observation about the agent's transport behavior.
            if isinstance(e, TransportError):
                raise
            raise TransportError(f"failed to read recorded input: {e}") from e
        transport_error = str(e)
        if run_open:
            # The connection died mid-run. The core's finalize will
            # additionally report the run (and any open streams) as
            # unterminated - both are true statements about the observed stream.
            emit_transport("AGUI508", {"runId": open_run_id or "(unknown)"})

    if not recorded:
        if last_arrival is not None:
            max_gap_ms = max(max_gap_ms, now() - last_arrival)
        if max_gap_ms > keepalive_window:
            emit_transport("AGUI506", {"seconds": round(max_gap_ms / 1000)})
        if chunk_count == 1 and event_count >= 3:
            emit_transport(
                "AGUI507", {"detail": f"entire body ({event_count} events) arrived in a single chunk"}
            )

    final_diags = v.finalize()
    if opts.on_diagnostic is not None:
        for d in final_diags:
            opts.on_diagnostic(d)

    return TransportResult(
        report=v.report(),
        status=None,
        content_type=content_type,
        event_count=event_count,
        transport_error=transport_error,
    )


async def _default_fetch(
    url: str,
    *,
    method: str,
    headers: Dict[str, str],
    body: Optional[bytes],
    timeout_s: Optional[float],
) -> TransportResponseLike:
    try:
        import httpx
    except ImportError as e:
        raise TransportError(
            "no fetch_impl was given and httpx is not installed; "
            "install with `pip install ag-ui-validate[transport]` or pass fetch_impl"
        ) from e

    client = httpx.AsyncClient(timeout=timeout_s)
    try:
        request = client.build_request(method, url, headers=headers, content=body)
        response = await client.send(request, stream=True)
    except Exception:
        await client.aclose()
        raise

    async def body_iter() -> AsyncGenerator[bytes, None]:
        try:
            async for chunk in response.aiter_bytes():
                yield chunk
        finally:
            await response.aclose()
            await client.aclose()

    return TransportResponseLike(status=response.status_code, headers=response.headers, body=body_iter())


async def validate_endpoint(url: str, opts: Optional[TransportOptions] = None) -> TransportResult:
    opts = opts or TransportOptions()
    fetch_impl = opts.fetch_impl or _default_fetch

    method = opts.method or "POST"
    headers: Dict[str, str] = {"accept": "text/event-stream, application/x-ndjson"}
    if method == "POST":
        headers["content-type"] = "application/json"
    if opts.headers:
        headers.update(opts.headers)

    timeout_s = opts.timeout_ms / 1000 if opts.timeout_ms is not None else None
    body_bytes = json.dumps(opts.input if opts.input is not None else default_run_agent_input()).encode(
        "utf-8"
    ) if method == "POST" else None

    try:
        res = await fetch_impl(url, method=method, headers=headers, body=body_bytes, timeout_s=timeout_s)
    except Exception as e:
        if isinstance(e, TransportError):
            raise
        raise TransportError(f"request failed: {e}") from e

    if res.status < 200 or res.status >= 300:
        raise TransportError(f"endpoint responded with HTTP {res.status}", res.status)
    if res.body is None:
        raise TransportError("response has no body", res.status)

    content_type = res.headers.get("content-type") or ""
    result = await validate_body(res.body, content_type, opts)
    result.status = res.status
    return result
