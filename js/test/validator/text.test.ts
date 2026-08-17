import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, textMessage, validate } from "../helpers.js"

describe("AGUI101 — TEXT_MESSAGE_CONTENT without start", () => {
  it("fires for content with no open message", () => {
    const { diags } = validate(inRun({ type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "x" }))
    const hits = only(diags, "AGUI101")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("m1")
    expect(hits[0]!.pointer).toBe("/messageId")
  })

  it("fires for content after the message ended", () => {
    const { diags } = validate(
      inRun(...textMessage("m1"), { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "late" }),
    )
    expect(only(diags, "AGUI101")).toHaveLength(1)
  })

  it("does not fire inside a proper stream", () => {
    const { diags } = validate(inRun(...textMessage()))
    expect(rulesOf(diags)).not.toContain("AGUI101")
  })
})

describe("AGUI102 — TEXT_MESSAGE_END without start", () => {
  it("fires for an end with no open message", () => {
    const { diags } = validate(inRun({ type: "TEXT_MESSAGE_END", messageId: "m9" }))
    expect(only(diags, "AGUI102")).toHaveLength(1)
  })
})

describe("AGUI103 — text message unterminated at run end", () => {
  it("fires at the terminal event", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "x" },
      ),
    )
    const hits = only(diags, "AGUI103")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.relatedEventIndex).toBe(1)
  })

  it("fires at finalize for a stream with no terminal", () => {
    const { diags } = validate([
      { type: "RUN_STARTED", threadId: "t", runId: "r" },
      { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
    ])
    expect(rulesOf(diags)).toContain("AGUI103")
  })
})

describe("AGUI104 — duplicate messageId within a run", () => {
  it("fires when a completed messageId is reused", () => {
    const { diags } = validate(inRun(...textMessage("m1"), ...textMessage("m1")))
    const hits = only(diags, "AGUI104")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("m1")
  })

  it("does not fire across runs in a multi-run stream", () => {
    const { diags } = validate([
      { type: "RUN_STARTED", threadId: "t", runId: "r1" },
      ...textMessage("m1"),
      { type: "RUN_FINISHED", threadId: "t", runId: "r1" },
      { type: "RUN_STARTED", threadId: "t", runId: "r2", parentRunId: "r1" },
      ...textMessage("m1"),
      { type: "RUN_FINISHED", threadId: "t", runId: "r2" },
    ])
    expect(rulesOf(diags)).not.toContain("AGUI104")
  })
})

describe("AGUI105 — empty content delta", () => {
  it("warns on an empty TEXT_MESSAGE_CONTENT delta", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
      ),
    )
    const hits = only(diags, "AGUI105")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("warning")
    expect(hits[0]!.pointer).toBe("/delta")
  })
})

describe("AGUI106 — interleaved message streams sharing a messageId", () => {
  it("fires when a messageId is opened twice concurrently", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
      ),
    )
    expect(only(diags, "AGUI106")).toHaveLength(1)
    expect(rulesOf(diags)).not.toContain("AGUI104")
  })

  it("allows two concurrently open messages with different ids", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_START", messageId: "m2", role: "assistant" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "a" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m2", delta: "b" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
        { type: "TEXT_MESSAGE_END", messageId: "m2" },
      ),
    )
    expect(diags).toEqual([])
  })
})

describe("TEXT_MESSAGE_CHUNK handling", () => {
  it("a chunk-only message needs no explicit end (no AGUI103)", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_CHUNK", messageId: "m1", delta: "hel" },
        { type: "TEXT_MESSAGE_CHUNK", delta: "lo" },
      ),
    )
    expect(diags).toEqual([])
  })

  it("a first chunk without messageId fails schema validation (AGUI504)", () => {
    const { diags } = validate(inRun({ type: "TEXT_MESSAGE_CHUNK", delta: "hello" }))
    const hits = only(diags, "AGUI504")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.pointer).toBe("/messageId")
  })

  it("reusing a completed chunk messageId fires AGUI104", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_CHUNK", messageId: "m1", delta: "a" },
        ...textMessage("m2"),
        { type: "TEXT_MESSAGE_CHUNK", messageId: "m1", delta: "b" },
      ),
    )
    expect(rulesOf(diags)).toContain("AGUI104")
  })
})
