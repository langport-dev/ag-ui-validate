// Recorded-input mode: validating a capture (file/stdin) rather than a live
// connection. Timing-based transport rules are meaningless there and must be
// reported as skipped — never silently, and never as false positives.
import { describe, expect, it } from "vitest"
import { TransportError, validateBody } from "../../src/transport/index.js"

const enc = new TextEncoder()

const RUN = [
  { type: "RUN_STARTED", threadId: "t1", runId: "r1", timestamp: 1 },
  { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", timestamp: 2 },
  { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hi", timestamp: 3 },
  { type: "TEXT_MESSAGE_END", messageId: "m1", timestamp: 4 },
  { type: "RUN_FINISHED", threadId: "t1", runId: "r1", timestamp: 5 },
]
const frame = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`

function bytes(...parts: string[]): AsyncGenerator<Uint8Array> {
  async function* gen() {
    for (const p of parts) yield enc.encode(p)
  }
  return gen()
}

describe("validateBody with recorded: true", () => {
  it("a single-chunk SSE capture does not look buffered, and timing rules report as skipped", async () => {
    const result = await validateBody(bytes(RUN.map(frame).join("")), null, { recorded: true })
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
    const skipped = Object.fromEntries(result.report.skipped.map((s) => [s.rule, s.reason]))
    for (const rule of ["AGUI505", "AGUI506", "AGUI507", "AGUI508"]) {
      expect(skipped[rule], `${rule} should be skipped with a reason`).toBeTruthy()
    }
    // SSE framing IS present in the bytes, so AGUI501 stays evaluated.
    expect(skipped.AGUI501).toBeUndefined()
  })

  it("SSE framing problems still fire on recordings", async () => {
    const capture = [
      frame(RUN[0]),
      `${JSON.stringify({ type: "CUSTOM", name: "acme.ping", value: 1, timestamp: 2 })}\n\n`,
      frame(RUN[4]),
    ]
    const result = await validateBody(bytes(...capture), null, { recorded: true })
    expect(result.report.diagnostics.map((d) => d.rule)).toEqual(["AGUI501"])
  })

  it("an NDJSON recording additionally reports AGUI501 as not applicable", async () => {
    const lines = RUN.map((e) => `${JSON.stringify(e)}\n`)
    const result = await validateBody(bytes(...lines), null, { recorded: true })
    expect(result.report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
    expect(result.report.skipped.map((s) => s.rule)).toContain("AGUI501")
  })

  it("read failures are tool failures (TransportError), not AGUI508 findings", async () => {
    async function* failing(): AsyncGenerator<Uint8Array> {
      yield enc.encode(frame(RUN[0]))
      throw new Error("EIO: disk exploded")
    }
    await expect(validateBody(failing(), null, { recorded: true })).rejects.toThrow(TransportError)
  })
})

describe("live NDJSON", () => {
  it("also reports AGUI501 as not applicable (no SSE framing to check)", async () => {
    const lines = RUN.map((e) => `${JSON.stringify(e)}\n`)
    const result = await validateBody(bytes(...lines), "application/x-ndjson")
    expect(result.report.skipped.map((s) => s.rule)).toContain("AGUI501")
  })
})
