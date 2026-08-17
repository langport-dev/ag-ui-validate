// WHATWG-compliant incremental SSE (text/event-stream) parser.
// https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
//
// Beyond plain parsing it surfaces framing anomalies relevant to AGUI501:
//   - json-line-without-data-prefix: a line that looks like a JSON payload but
//     has no "data:" field prefix. Spec-wise it is an unknown field and gets
//     silently dropped by every SSE client — the classic broken-server bug.
//   - truncated-frame: the stream ended mid-frame (pending data never
//     dispatched, or a partial final line).

export type SseProblemCode = "json-line-without-data-prefix" | "truncated-frame"

export type SseItem =
  | { kind: "event"; data: string; event?: string; id?: string }
  | { kind: "comment"; text: string }
  | { kind: "problem"; code: SseProblemCode; detail: string }

const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s)

export async function* sseItems(source: AsyncIterable<Uint8Array>): AsyncGenerator<SseItem> {
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let sawFirstChars = false
  let dataLines: string[] = []
  let eventName = ""
  let lastId: string | undefined

  function handleLine(line: string): SseItem | null {
    if (line === "") {
      // Dispatch. Per spec, an empty data buffer dispatches nothing.
      const data = dataLines.join("\n")
      const hadData = dataLines.length > 0
      dataLines = []
      const name = eventName
      eventName = ""
      if (!hadData || data === "") return null
      const item: SseItem = { kind: "event", data }
      if (name !== "") item.event = name
      if (lastId !== undefined) item.id = lastId
      return item
    }
    if (line.startsWith(":")) return { kind: "comment", text: line.slice(1) }

    const colon = line.indexOf(":")
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? "" : line.slice(colon + 1)
    if (value.startsWith(" ")) value = value.slice(1)

    switch (field) {
      case "data":
        dataLines.push(value)
        return null
      case "event":
        eventName = value
        return null
      case "id":
        if (!value.includes("\0")) lastId = value
        return null
      case "retry":
        return null
      default: {
        // Unknown field: ignored per spec — but a JSON-looking line is almost
        // certainly a payload missing its "data:" prefix, silently lost.
        const trimmed = line.trimStart()
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          return {
            kind: "problem",
            code: "json-line-without-data-prefix",
            detail: `line '${truncate(trimmed, 60)}' looks like a JSON payload but lacks the 'data:' field prefix, so SSE clients silently drop it`,
          }
        }
        return null
      }
    }
  }

  function* drainLines(eof: boolean): Generator<SseItem> {
    for (;;) {
      const nl = buffer.indexOf("\n")
      const cr = buffer.indexOf("\r")
      let end: number
      let next: number
      if (cr !== -1 && (nl === -1 || cr < nl)) {
        // Hold back a trailing CR mid-stream: it may be a CRLF split across
        // chunk boundaries.
        if (cr === buffer.length - 1 && !eof) return
        end = cr
        next = buffer[cr + 1] === "\n" ? cr + 2 : cr + 1
      } else if (nl !== -1) {
        end = nl
        next = nl + 1
      } else {
        return
      }
      const line = buffer.slice(0, end)
      buffer = buffer.slice(next)
      const item = handleLine(line)
      if (item !== null) yield item
    }
  }

  for await (const chunk of source) {
    buffer += decoder.decode(chunk, { stream: true })
    if (!sawFirstChars && buffer.length > 0) {
      if (buffer.startsWith("﻿")) buffer = buffer.slice(1)
      sawFirstChars = true
    }
    yield* drainLines(false)
  }
  buffer += decoder.decode()
  yield* drainLines(true)

  if (buffer !== "") {
    yield {
      kind: "problem",
      code: "truncated-frame",
      detail: `stream ended mid-line: '${truncate(buffer, 60)}' (no trailing newline; the frame was never dispatched)`,
    }
  } else if (dataLines.length > 0) {
    yield {
      kind: "problem",
      code: "truncated-frame",
      detail: "stream ended with a pending frame that was never terminated by a blank line",
    }
  }
}
