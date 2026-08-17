import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, validate } from "../helpers.js"

const reasoningFlow = (): unknown[] => [
  { type: "REASONING_START", messageId: "r1" },
  { type: "REASONING_MESSAGE_START", messageId: "rm1", role: "reasoning" },
  { type: "REASONING_MESSAGE_CONTENT", messageId: "rm1", delta: "thinking…" },
  { type: "REASONING_MESSAGE_END", messageId: "rm1" },
  { type: "REASONING_END", messageId: "r1" },
]

describe("AGUI401 — REASONING_MESSAGE_CONTENT without start", () => {
  it("fires for content with no open reasoning message", () => {
    const { diags } = validate(
      inRun({ type: "REASONING_MESSAGE_CONTENT", messageId: "rm1", delta: "x" }),
    )
    const hits = only(diags, "AGUI401")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("rm1")
  })

  it("does not fire for a complete reasoning flow", () => {
    const { diags } = validate(inRun(...reasoningFlow()))
    expect(diags).toEqual([])
  })

  it("does not fire for reasoning message events outside a REASONING_START block (SQ-4)", () => {
    const { diags } = validate(
      inRun(
        { type: "REASONING_MESSAGE_START", messageId: "rm1", role: "reasoning" },
        { type: "REASONING_MESSAGE_CONTENT", messageId: "rm1", delta: "x" },
        { type: "REASONING_MESSAGE_END", messageId: "rm1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI401")
  })
})

describe("AGUI402 — reasoning unterminated at run end", () => {
  it("fires for an unterminated REASONING_START block", () => {
    const { diags } = validate(inRun({ type: "REASONING_START", messageId: "r1" }))
    const hits = only(diags, "AGUI402")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("warning")
    expect(hits[0]!.message).toContain("REASONING_START")
  })

  it("fires for an unterminated REASONING_MESSAGE_START", () => {
    const { diags } = validate(
      inRun(
        { type: "REASONING_START", messageId: "r1" },
        { type: "REASONING_MESSAGE_START", messageId: "rm1", role: "reasoning" },
        { type: "REASONING_END", messageId: "r1" },
      ),
    )
    const hits = only(diags, "AGUI402")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("REASONING_MESSAGE_START")
  })
})

describe("REASONING_MESSAGE_CHUNK handling", () => {
  it("chunked reasoning closes implicitly on empty delta", () => {
    const { diags } = validate(
      inRun(
        { type: "REASONING_MESSAGE_CHUNK", messageId: "rm1", delta: "thinking" },
        { type: "REASONING_MESSAGE_CHUNK", delta: "" },
      ),
    )
    expect(diags).toEqual([])
  })
})
