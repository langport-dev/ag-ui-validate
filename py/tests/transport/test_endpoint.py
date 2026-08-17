"""Mirrors js/test/transport/endpoint.test.ts."""

from __future__ import annotations

import json
from typing import Any, AsyncGenerator, AsyncIterable, Dict, List, Optional

import pytest

from ag_ui_validate.transport import TransportError, TransportOptions, validate_body, validate_endpoint

RUN: List[Dict[str, Any]] = [
    {"type": "RUN_STARTED", "threadId": "t1", "runId": "r1", "timestamp": 1},
    {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "timestamp": 2},
    {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi", "timestamp": 3},
    {"type": "TEXT_MESSAGE_END", "messageId": "m1", "timestamp": 4},
    {"type": "RUN_FINISHED", "threadId": "t1", "runId": "r1", "timestamp": 5},
]


def frame(o: Any) -> str:
    return f"data: {json.dumps(o)}\n\n"


def body(*parts: str) -> AsyncGenerator[bytes, None]:
    async def gen():
        for p in parts:
            yield p.encode("utf-8")

    return gen()


class _Headers:
    def __init__(self, content_type: Optional[str]):
        self._content_type = content_type

    def get(self, name: str) -> Optional[str]:
        return self._content_type if name.lower() == "content-type" else None


def mock_fetch(status: int, content_type: Optional[str], body_gen, captured: Optional[dict] = None):
    from ag_ui_validate.transport import TransportResponseLike

    async def impl(url, *, method, headers, body, timeout_s):
        if captured is not None:
            captured["url"] = url
            captured["method"] = method
            captured["headers"] = headers
            captured["body"] = body
        return TransportResponseLike(status=status, headers=_Headers(content_type), body=body_gen)

    return impl


async def test_validates_a_clean_sse_endpoint_with_zero_findings():
    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(fetch_impl=mock_fetch(200, "text/event-stream", body(*[frame(e) for e in RUN]))),
    )
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0
    assert result.status == 200
    assert result.event_count == 5
    skipped = [s.rule for s in result.report.skipped]
    for rule in ["AGUI501", "AGUI505", "AGUI506", "AGUI507", "AGUI508"]:
        assert rule not in skipped


async def test_validates_an_ndjson_endpoint():
    lines = [f"{json.dumps(e)}\n" for e in RUN]
    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(fetch_impl=mock_fetch(200, "application/x-ndjson", body(*lines))),
    )
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0
    assert result.event_count == 5


async def test_agui505_unexpected_content_type_still_validates_via_sniffing():
    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(
            fetch_impl=mock_fetch(200, "text/html; charset=utf-8", body(*[frame(e) for e in RUN]))
        ),
    )
    rules = [d.rule for d in result.report.diagnostics]
    assert rules == ["AGUI505"]
    assert result.report.diagnostics[0].severity == "warning"
    assert result.event_count == 5


async def test_agui506_reports_the_longest_silent_gap_beyond_the_keepalive_window():
    clock = {"t": 0}

    async def timed():
        clock["t"] = 0
        yield "".join(frame(e) for e in RUN[:3]).encode("utf-8")
        clock["t"] = 47000
        yield "".join(frame(e) for e in RUN[3:]).encode("utf-8")

    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(
            fetch_impl=mock_fetch(200, "text/event-stream", timed()),
            now=lambda: clock["t"],
        ),
    )
    hits = [d for d in result.report.diagnostics if d.rule == "AGUI506"]
    assert len(hits) == 1
    assert hits[0].severity == "info"
    assert "47s" in hits[0].message


async def test_agui507_whole_multi_event_body_arriving_as_one_chunk_looks_buffered():
    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(
            fetch_impl=mock_fetch(200, "text/event-stream", body("".join(frame(e) for e in RUN)))
        ),
    )
    hits = [d for d in result.report.diagnostics if d.rule == "AGUI507"]
    assert len(hits) == 1
    assert hits[0].severity == "info"


async def test_agui508_a_mid_run_connection_drop_is_a_diagnostic_not_an_exception():
    async def dropping():
        yield "".join(frame(e) for e in RUN[:3]).encode("utf-8")
        raise RuntimeError("connection reset by peer")

    result = await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(fetch_impl=mock_fetch(200, "text/event-stream", dropping())),
    )
    rules = [d.rule for d in result.report.diagnostics]
    assert "AGUI508" in rules
    assert "AGUI003" in rules  # the observed stream also never terminated
    assert result.transport_error is not None
    assert "connection reset" in result.transport_error
    d508 = next(d for d in result.report.diagnostics if d.rule == "AGUI508")
    assert d508.severity == "error"
    assert "r1" in d508.message


async def test_non_2xx_responses_raise_transporterror():
    with pytest.raises(TransportError, match="500"):
        await validate_endpoint(
            "http://agent.test/agui", TransportOptions(fetch_impl=mock_fetch(500, "text/plain", None))
        )


async def test_posts_a_valid_minimal_runagentinput_by_default_and_merges_headers():
    captured: dict = {}
    await validate_endpoint(
        "http://agent.test/agui",
        TransportOptions(
            fetch_impl=mock_fetch(
                200, "text/event-stream", body(*[frame(e) for e in RUN]), captured=captured
            ),
            headers={"authorization": "Bearer test-token"},
        ),
    )
    assert captured["url"] == "http://agent.test/agui"
    assert captured["method"] == "POST"
    assert captured["headers"]["content-type"] == "application/json"
    assert "text/event-stream" in captured["headers"]["accept"]
    assert captured["headers"]["authorization"] == "Bearer test-token"
    input_ = json.loads(captured["body"])
    assert isinstance(input_["threadId"], str)
    assert isinstance(input_["runId"], str)
    assert len(input_["messages"]) == 1
    assert input_["messages"][0]["role"] == "user"
    assert input_["tools"] == []
    assert input_["context"] == []


async def test_null_content_type_recorded_input_skips_agui505_and_sniffs_the_format():
    result = await validate_body(body(*[frame(e) for e in RUN]), None)
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0
    assert result.event_count == 5
    assert result.status is None


async def test_sniffs_ndjson_when_the_first_line_is_bare_json():
    lines = [f"{json.dumps(e)}\n" for e in RUN]
    result = await validate_body(body(*lines), None)
    assert result.report.summary.errors == 0
    assert result.report.summary.warnings == 0
    assert result.report.summary.info == 0


async def test_agui501_json_lines_lacking_the_data_prefix_are_flagged_and_lost():
    parts = [
        frame(RUN[0]),
        f"{json.dumps(RUN[1])}\n\n",  # missing "data: " prefix — dropped by SSE parsing
        frame({"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi", "timestamp": 3}),
        frame(RUN[3]),
        frame(RUN[4]),
    ]
    result = await validate_body(body(*parts), "text/event-stream")
    rules = [d.rule for d in result.report.diagnostics]
    assert "AGUI501" in rules
    # The dropped TEXT_MESSAGE_START makes the survivors inconsistent:
    assert "AGUI101" in rules
