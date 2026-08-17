"""WHATWG-compliant incremental SSE (text/event-stream) parser.
https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation

Beyond plain parsing it surfaces framing anomalies relevant to AGUI501:
  - json-line-without-data-prefix: a line that looks like a JSON payload but
    has no "data:" field prefix. Spec-wise it is an unknown field and gets
    silently dropped by every SSE client - the classic broken-server bug.
  - truncated-frame: the stream ended mid-frame (pending data never
    dispatched, or a partial final line).

Mirrors js/src/transport/sse.ts.
"""

from __future__ import annotations

import codecs
from dataclasses import dataclass, field
from typing import AsyncGenerator, AsyncIterable, List, Optional, Tuple, Union


@dataclass
class SseEvent:
    data: str = ""
    event: Optional[str] = None
    id: Optional[str] = None
    kind: str = field(default="event", init=False)


@dataclass
class SseComment:
    text: str
    kind: str = field(default="comment", init=False)


@dataclass
class SseProblem:
    code: str  # "json-line-without-data-prefix" | "truncated-frame"
    detail: str
    kind: str = field(default="problem", init=False)


SseItem = Union[SseEvent, SseComment, SseProblem]


def _truncate(s: str, n: int) -> str:
    return f"{s[:n]}…" if len(s) > n else s


async def sse_items(source: AsyncIterable[bytes]) -> AsyncGenerator[SseItem, None]:
    # errors="replace" matches JS's default (non-fatal) TextDecoder: malformed
    # or truncated UTF-8 becomes U+FFFD rather than raising, preserving the
    # "never throws on hostile input" invariant.
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    buffer = ""
    saw_first_chars = False
    data_lines: List[str] = []
    event_name = ""
    last_id: Optional[str] = None

    def handle_line(line: str) -> Optional[SseItem]:
        nonlocal data_lines, event_name, last_id
        if line == "":
            # Dispatch. Per spec, an empty data buffer dispatches nothing.
            data = "\n".join(data_lines)
            had_data = len(data_lines) > 0
            data_lines = []
            name = event_name
            event_name = ""
            if not had_data or data == "":
                return None
            item = SseEvent(data=data)
            if name != "":
                item.event = name
            if last_id is not None:
                item.id = last_id
            return item
        if line.startswith(":"):
            return SseComment(text=line[1:])

        colon = line.find(":")
        field_name = line if colon == -1 else line[:colon]
        value = "" if colon == -1 else line[colon + 1 :]
        if value.startswith(" "):
            value = value[1:]

        if field_name == "data":
            data_lines.append(value)
            return None
        if field_name == "event":
            event_name = value
            return None
        if field_name == "id":
            if "\0" not in value:
                last_id = value
            return None
        if field_name == "retry":
            return None
        # Unknown field: ignored per spec - but a JSON-looking line is almost
        # certainly a payload missing its "data:" prefix, silently lost.
        trimmed = line.lstrip()
        if trimmed.startswith("{") or trimmed.startswith("["):
            return SseProblem(
                code="json-line-without-data-prefix",
                detail=(
                    f"line '{_truncate(trimmed, 60)}' looks like a JSON payload but lacks the "
                    "'data:' field prefix, so SSE clients silently drop it"
                ),
            )
        return None

    def drain(buf: str, eof: bool) -> Tuple[str, List[SseItem]]:
        items: List[SseItem] = []
        while True:
            nl = buf.find("\n")
            cr = buf.find("\r")
            if cr != -1 and (nl == -1 or cr < nl):
                # Hold back a trailing CR mid-stream: it may be a CRLF split
                # across chunk boundaries.
                if cr == len(buf) - 1 and not eof:
                    break
                end = cr
                nxt = cr + 2 if len(buf) > cr + 1 and buf[cr + 1] == "\n" else cr + 1
            elif nl != -1:
                end = nl
                nxt = nl + 1
            else:
                break
            line = buf[:end]
            buf = buf[nxt:]
            item = handle_line(line)
            if item is not None:
                items.append(item)
        return buf, items

    async for chunk in source:
        buffer += decoder.decode(chunk)
        if not saw_first_chars and len(buffer) > 0:
            if buffer.startswith("﻿"):
                buffer = buffer[1:]
            saw_first_chars = True
        buffer, items = drain(buffer, False)
        for item in items:
            yield item

    buffer += decoder.decode(b"", final=True)
    buffer, items = drain(buffer, True)
    for item in items:
        yield item

    if buffer != "":
        yield SseProblem(
            code="truncated-frame",
            detail=f"stream ended mid-line: '{_truncate(buffer, 60)}' (no trailing newline; the frame was never dispatched)",
        )
    elif len(data_lines) > 0:
        yield SseProblem(
            code="truncated-frame",
            detail="stream ended with a pending frame that was never terminated by a blank line",
        )
