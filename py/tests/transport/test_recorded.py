"""Mirrors js/test/transport/recorded.test.ts.

Recorded-input mode: validating a capture (file/stdin) rather than a live
connection. Timing-based transport rules are meaningless there and must be
reported as skipped — never silently, and never as false positives.
"""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator, Dict, List

import pytest

from ag_ui_validate.transport import TransportError, TransportOptions, validate_body

RUN: List[Dict[str, Any]] = [
    {"type": "RUN_STARTED", "threadId": "t1", "runId": "r1", "timestamp": 1},
    {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "timestamp": 2},
    {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi", "timestamp": 3},
    {"type": "TEXT_MESSAGE_END", "messageId": "m1", "timestamp": 4},
    {"type": "RUN_FINISHED", "threadId": "t1", "runId": "r1", "timestamp": 5},
]


def frame(o: Any) -> str:
    return f"data: {json.dumps(o)}\n\n"


def bytes_(*parts: str) -> AsyncGenerator[bytes, None]:
    async def gen():
        for p in parts:
            yield p.encode("utf-8")

    return gen()


async def test_a_single_chunk_sse_capture_does_not_look_buffered_and_timing_rules_report_as_skipped():
    result = await validate_body(
        bytes_("".join(frame(e) for e in RUN)), None, TransportOptions(recorded=True)
    )
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0
    skipped = {s.rule: s.reason for s in result.report.skipped}
    for rule in ["AGUI505", "AGUI506", "AGUI507", "AGUI508"]:
        assert skipped.get(rule), f"{rule} should be skipped with a reason"
    # SSE framing IS present in the bytes, so AGUI501 stays evaluated.
    assert "AGUI501" not in skipped


async def test_sse_framing_problems_still_fire_on_recordings():
    capture = [
        frame(RUN[0]),
        f"{json.dumps({'type': 'CUSTOM', 'name': 'acme.ping', 'value': 1, 'timestamp': 2})}\n\n",
        frame(RUN[4]),
    ]
    result = await validate_body(bytes_(*capture), None, TransportOptions(recorded=True))
    assert [d.rule for d in result.report.diagnostics] == ["AGUI501"]


async def test_an_ndjson_recording_additionally_reports_agui501_as_not_applicable():
    lines = [f"{json.dumps(e)}\n" for e in RUN]
    result = await validate_body(bytes_(*lines), None, TransportOptions(recorded=True))
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0
    assert "AGUI501" in [s.rule for s in result.report.skipped]


async def test_read_failures_are_tool_failures_transporterror_not_agui508_findings():
    async def failing():
        yield frame(RUN[0]).encode("utf-8")
        raise RuntimeError("EIO: disk exploded")

    with pytest.raises(TransportError):
        await validate_body(failing(), None, TransportOptions(recorded=True))


async def test_live_ndjson_also_reports_agui501_as_not_applicable():
    lines = [f"{json.dumps(e)}\n" for e in RUN]
    result = await validate_body(bytes_(*lines), "application/x-ndjson")
    assert "AGUI501" in [s.rule for s in result.report.skipped]
