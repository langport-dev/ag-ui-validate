import { describe, expect, it } from "vitest"
import { TransportError, validateBody, validateEndpoint } from "../../src/transport/index.js"
import type { TransportRequestInit } from "../../src/transport/index.js"

const enc = new TextEncoder()

const RUN = [
  { type: "RUN_STARTED", threadId: "t1", runId: "r1", timestamp: 1 },
  { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", timestamp: 2 },
  { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hi", timestamp: 3 },
  { type: "TEXT_MESSAGE_END", messageId: "m1", timestamp: 4 },
  { type: "RUN_FINISHED", threadId: "t1", runId: "r1", timestamp: 5 },
]
const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`

function body(...parts: string[]): AsyncGenerator<Uint8Array> {
  async function* gen() {
    for (const p of parts) yield enc.encode(p)
  }
  return gen()
}

function mockFetch(
  status: number,
  contentType: string | null,
  bodyGen: AsyncIterable<Uint8Array> | null,
  captured?: { url?: string; init?: TransportRequestInit },
) {
  return async (url: string, init: TransportRequestInit) => {
    if (captured) {
      captured.url = url
      captured.init = init
    }
    return {
      status,
      headers: { get: (n: string) => (n.toLowerCase() === "content-type" ? contentType : null) },
      body: bodyGen,
    }
  }
}

describe("validateEndpoint", () => {
  it("validates a clean SSE endpoint with zero findings", async () => {
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/event-stream", body(...RUN.map(frame))),
    })
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
    expect(result.status).toBe(200)
    expect(result.eventCount).toBe(5)
    const skipped = result.report.skipped.map((s) => s.rule)
    for (const rule of ["AGUI501", "AGUI505", "AGUI506", "AGUI507", "AGUI508"]) {
      expect(skipped).not.toContain(rule)
    }
  })

  it("validates an NDJSON endpoint", async () => {
    const lines = RUN.map((e) => `${JSON.stringify(e)}\n`)
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "application/x-ndjson", body(...lines)),
    })
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
    expect(result.eventCount).toBe(5)
  })

  it("AGUI505 — unexpected Content-Type still validates via sniffing", async () => {
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/html; charset=utf-8", body(...RUN.map(frame))),
    })
    const rules = result.report.diagnostics.map((d) => d.rule)
    expect(rules).toEqual(["AGUI505"])
    expect(result.report.diagnostics[0]!.severity).toBe("warning")
    expect(result.eventCount).toBe(5)
  })

  it("AGUI506 — reports the longest silent gap beyond the keepalive window", async () => {
    const clock = { t: 0 }
    async function* timed(): AsyncGenerator<Uint8Array> {
      clock.t = 0
      yield enc.encode(RUN.slice(0, 3).map(frame).join(""))
      clock.t = 47000
      yield enc.encode(RUN.slice(3).map(frame).join(""))
    }
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/event-stream", timed()),
      now: () => clock.t,
    })
    const hits = result.report.diagnostics.filter((d) => d.rule === "AGUI506")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
    expect(hits[0]!.message).toContain("47s")
  })

  it("AGUI507 — whole multi-event body arriving as one chunk looks buffered", async () => {
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/event-stream", body(RUN.map(frame).join(""))),
    })
    const hits = result.report.diagnostics.filter((d) => d.rule === "AGUI507")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
  })

  it("AGUI508 — a mid-run connection drop is a diagnostic, not an exception", async () => {
    async function* dropping(): AsyncGenerator<Uint8Array> {
      yield enc.encode(RUN.slice(0, 3).map(frame).join(""))
      throw new Error("connection reset by peer")
    }
    const result = await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/event-stream", dropping()),
    })
    const rules = result.report.diagnostics.map((d) => d.rule)
    expect(rules).toContain("AGUI508")
    expect(rules).toContain("AGUI003") // the observed stream also never terminated
    expect(result.transportError).toContain("connection reset")
    const d508 = result.report.diagnostics.find((d) => d.rule === "AGUI508")!
    expect(d508.severity).toBe("error")
    expect(d508.message).toContain("r1")
  })

  it("non-2xx responses throw TransportError (tool failure, not a finding)", async () => {
    await expect(
      validateEndpoint("http://agent.test/agui", { fetchImpl: mockFetch(500, "text/plain", null) }),
    ).rejects.toThrow(TransportError)
    await expect(
      validateEndpoint("http://agent.test/agui", { fetchImpl: mockFetch(500, "text/plain", null) }),
    ).rejects.toThrow(/500/)
  })

  it("POSTs a valid minimal RunAgentInput by default and merges headers", async () => {
    const captured: { url?: string; init?: TransportRequestInit } = {}
    await validateEndpoint("http://agent.test/agui", {
      fetchImpl: mockFetch(200, "text/event-stream", body(...RUN.map(frame)), captured),
      headers: { authorization: "Bearer test-token" },
    })
    expect(captured.url).toBe("http://agent.test/agui")
    expect(captured.init!.method).toBe("POST")
    expect(captured.init!.headers["content-type"]).toBe("application/json")
    expect(captured.init!.headers.accept).toContain("text/event-stream")
    expect(captured.init!.headers.authorization).toBe("Bearer test-token")
    const input = JSON.parse(captured.init!.body!)
    expect(typeof input.threadId).toBe("string")
    expect(typeof input.runId).toBe("string")
    expect(input.messages).toHaveLength(1)
    expect(input.messages[0].role).toBe("user")
    expect(input.tools).toEqual([])
    expect(input.context).toEqual([])
  })
})

describe("validateBody", () => {
  it("null content type (recorded input) skips AGUI505 and sniffs the format", async () => {
    const result = await validateBody(body(...RUN.map(frame)), null)
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
    expect(result.eventCount).toBe(5)
    expect(result.status).toBeNull()
  })

  it("sniffs NDJSON when the first line is bare JSON", async () => {
    const lines = RUN.map((e) => `${JSON.stringify(e)}\n`)
    const result = await validateBody(body(...lines), null)
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
  })

  it("AGUI501 — JSON lines lacking the data: prefix are flagged and lost", async () => {
    const parts = [
      frame(RUN[0]),
      `${JSON.stringify(RUN[1])}\n\n`, // missing "data: " prefix — dropped by SSE parsing
      frame({ type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hi", timestamp: 3 }),
      frame(RUN[3]),
      frame(RUN[4]),
    ]
    const result = await validateBody(body(...parts), "text/event-stream")
    const rules = result.report.diagnostics.map((d) => d.rule)
    expect(rules).toContain("AGUI501")
    // The dropped TEXT_MESSAGE_START makes the survivors inconsistent:
    expect(rules).toContain("AGUI101")
  })
})
