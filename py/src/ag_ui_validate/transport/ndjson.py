"""Incremental NDJSON (application/x-ndjson) line splitter. Yields non-empty
lines with trailing CR stripped; the core decides whether they parse.
Mirrors js/src/transport/ndjson.ts.
"""

from __future__ import annotations

import codecs
from typing import AsyncGenerator, AsyncIterable, Optional


def _clean(line: str) -> Optional[str]:
    trimmed = line[:-1] if line.endswith("\r") else line
    return None if trimmed.strip() == "" else trimmed


async def ndjson_lines(source: AsyncIterable[bytes]) -> AsyncGenerator[str, None]:
    # errors="replace" matches JS's default (non-fatal) TextDecoder.
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    buffer = ""

    async for chunk in source:
        buffer += decoder.decode(chunk)
        i = buffer.find("\n")
        while i != -1:
            line = _clean(buffer[:i])
            buffer = buffer[i + 1 :]
            if line is not None:
                yield line
            i = buffer.find("\n")

    buffer += decoder.decode(b"", final=True)
    last = _clean(buffer)
    if last is not None:
        yield last
