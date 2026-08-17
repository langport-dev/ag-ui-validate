import { describe, expect, it } from "vitest"
import { sseItems } from "../../src/transport/sse.js"
import type { SseItem } from "../../src/transport/sse.js"

const enc = new TextEncoder()

async function* chunks(...parts: string[]): AsyncGenerator<Uint8Array> {
  for (const p of parts) yield enc.encode(p)
}

async function collect(...parts: string[]): Promise<SseItem[]> {
  const out: SseItem[] = []
  for await (const item of sseItems(chunks(...parts))) out.push(item)
  return out
}

const events = (items: SseItem[]) => items.filter((i) => i.kind === "event")
const problems = (items: SseItem[]) => items.filter((i) => i.kind === "problem")

describe("sseItems — WHATWG event-stream parsing", () => {
  it("parses a single data frame", async () => {
    const items = await collect('data: {"a":1}\n\n')
    expect(items).toEqual([{ kind: "event", data: '{"a":1}' }])
  })

  it("joins multi-line data with newlines", async () => {
    const items = await collect("data: line1\ndata: line2\n\n")
    expect(events(items)[0]!.data).toBe("line1\nline2")
  })

  it("reassembles frames split across arbitrary chunk boundaries", async () => {
    const items = await collect("da", "ta: hel", "lo\n", "\nda", "ta: again\n\n")
    expect(events(items).map((e) => e.data)).toEqual(["hello", "again"])
  })

  it("handles CRLF and lone-CR line endings", async () => {
    expect(events(await collect("data: a\r\n\r\n"))[0]!.data).toBe("a")
    expect(events(await collect("data: b\r\r"))[0]!.data).toBe("b")
  })

  it("holds back a trailing CR that might be a split CRLF", async () => {
    const items = await collect("data: a\r", "\ndata: b\n\n")
    expect(events(items)[0]!.data).toBe("a\nb")
  })

  it("treats colon-prefixed lines as comments (keepalives)", async () => {
    const items = await collect(": keepalive\n\ndata: x\n\n")
    expect(items[0]).toEqual({ kind: "comment", text: " keepalive" })
    expect(events(items)).toHaveLength(1)
  })

  it("value may omit the space after the colon", async () => {
    expect(events(await collect("data:tight\n\n"))[0]!.data).toBe("tight")
  })

  it("captures event and id fields", async () => {
    const items = await collect("event: message\nid: 7\ndata: x\n\n")
    expect(events(items)[0]).toEqual({ kind: "event", data: "x", event: "message", id: "7" })
  })

  it("ignores known non-data fields and unknown word fields silently", async () => {
    const items = await collect("retry: 300\nfoo: bar\ndata: x\n\n")
    expect(items).toEqual([{ kind: "event", data: "x" }])
  })

  it("flags a JSON line missing the data: prefix (AGUI501's marquee case)", async () => {
    const items = await collect('{"type":"RUN_STARTED"}\n\ndata: x\n\n')
    const p = problems(items)
    expect(p).toHaveLength(1)
    expect(p[0]!.code).toBe("json-line-without-data-prefix")
    expect(events(items)).toHaveLength(1)
  })

  it("flags a frame truncated at EOF", async () => {
    const items = await collect('data: {"a"')
    const p = problems(items)
    expect(p).toHaveLength(1)
    expect(p[0]!.code).toBe("truncated-frame")
  })

  it("dispatches nothing for frames with no data", async () => {
    const items = await collect("event: ping\n\n")
    expect(items).toEqual([])
  })

  it("strips a leading BOM", async () => {
    const items = await collect("﻿data: x\n\n")
    expect(events(items)[0]!.data).toBe("x")
  })

  it("multi-byte UTF-8 split across chunks survives", async () => {
    const bytes = enc.encode("data: héllo\n\n")
    async function* split(): AsyncGenerator<Uint8Array> {
      yield bytes.slice(0, 8) // cuts é in half
      yield bytes.slice(8)
    }
    const out: SseItem[] = []
    for await (const item of sseItems(split())) out.push(item)
    expect(events(out)[0]!.data).toBe("héllo")
  })
})
