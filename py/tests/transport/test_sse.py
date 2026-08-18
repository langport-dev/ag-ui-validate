"""Mirrors js/test/transport/sse.test.ts."""

from __future__ import annotations

from typing import List

from ag_ui_validate.transport.sse import SseComment, SseEvent, SseItem, SseProblem, sse_items


async def _chunks(*parts: str):
    for p in parts:
        yield p.encode("utf-8")


async def _collect(*parts: str) -> List[SseItem]:
    out = []
    async for item in sse_items(_chunks(*parts)):
        out.append(item)
    return out


def _events(items):
    return [i for i in items if isinstance(i, SseEvent)]


def _problems(items):
    return [i for i in items if isinstance(i, SseProblem)]


async def test_parses_a_single_data_frame():
    items = await _collect('data: {"a":1}\n\n')
    assert items == [SseEvent(data='{"a":1}')]


async def test_joins_multi_line_data_with_newlines():
    items = await _collect("data: line1\ndata: line2\n\n")
    assert _events(items)[0].data == "line1\nline2"


async def test_reassembles_frames_split_across_arbitrary_chunk_boundaries():
    items = await _collect("da", "ta: hel", "lo\n", "\nda", "ta: again\n\n")
    assert [e.data for e in _events(items)] == ["hello", "again"]


async def test_handles_crlf_and_lone_cr_line_endings():
    assert _events(await _collect("data: a\r\n\r\n"))[0].data == "a"
    assert _events(await _collect("data: b\r\r"))[0].data == "b"


async def test_holds_back_a_trailing_cr_that_might_be_a_split_crlf():
    items = await _collect("data: a\r", "\ndata: b\n\n")
    assert _events(items)[0].data == "a\nb"


async def test_treats_colon_prefixed_lines_as_comments_keepalives():
    items = await _collect(": keepalive\n\ndata: x\n\n")
    assert items[0] == SseComment(text=" keepalive")
    assert len(_events(items)) == 1


async def test_value_may_omit_the_space_after_the_colon():
    assert _events(await _collect("data:tight\n\n"))[0].data == "tight"


async def test_captures_event_and_id_fields():
    items = await _collect("event: message\nid: 7\ndata: x\n\n")
    assert _events(items)[0] == SseEvent(data="x", event="message", id="7")


async def test_ignores_known_non_data_fields_and_unknown_word_fields_silently():
    items = await _collect("retry: 300\nfoo: bar\ndata: x\n\n")
    assert items == [SseEvent(data="x")]


async def test_flags_a_json_line_missing_the_data_prefix():
    items = await _collect('{"type":"RUN_STARTED"}\n\ndata: x\n\n')
    p = _problems(items)
    assert len(p) == 1
    assert p[0].code == "json-line-without-data-prefix"
    assert len(_events(items)) == 1


async def test_flags_a_frame_truncated_at_eof():
    items = await _collect('data: {"a"')
    p = _problems(items)
    assert len(p) == 1
    assert p[0].code == "truncated-frame"


async def test_dispatches_nothing_for_frames_with_no_data():
    items = await _collect("event: ping\n\n")
    assert items == []


async def test_strips_a_leading_bom():
    items = await _collect("﻿data: x\n\n")
    assert _events(items)[0].data == "x"


async def test_multi_byte_utf8_split_across_chunks_survives():
    bytes_ = "data: héllo\n\n".encode("utf-8")
    async def split():
        yield bytes_[:8]  # cuts é in half
        yield bytes_[8:]

    out = []
    async for item in sse_items(split()):
        out.append(item)
    assert _events(out)[0].data == "héllo"
