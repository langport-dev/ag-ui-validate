"""Mirrors js/test/transport/ndjson.test.ts."""

from __future__ import annotations

from typing import List

from ag_ui_validate.transport.ndjson import ndjson_lines


async def _collect(*parts: str) -> List[str]:
    async def chunks():
        for p in parts:
            yield p.encode("utf-8")

    out = []
    async for line in ndjson_lines(chunks()):
        out.append(line)
    return out


async def test_splits_lines_and_skips_empties():
    assert await _collect('{"a":1}\n\n{"b":2}\n') == ['{"a":1}', '{"b":2}']


async def test_trims_carriage_returns():
    assert await _collect('{"a":1}\r\n{"b":2}\r\n') == ['{"a":1}', '{"b":2}']


async def test_reassembles_lines_split_across_chunks():
    assert await _collect('{"a"', ':1}\n{', '"b":2}\n') == ['{"a":1}', '{"b":2}']


async def test_yields_a_final_line_without_a_trailing_newline():
    assert await _collect('{"a":1}\n{"b":2}') == ['{"a":1}', '{"b":2}']
