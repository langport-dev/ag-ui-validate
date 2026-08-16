import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, textMessage, toolCall, validate } from "../helpers.js"

describe("AGUI201 — TOOL_CALL_ARGS without start", () => {
  it("fires for args with no open tool call", () => {
    const { diags } = validate(inRun({ type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: "{}" }))
    const hits = only(diags, "AGUI201")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("c1")
  })
})

describe("AGUI202 — TOOL_CALL_END without start", () => {
  it("fires for an end with no open tool call", () => {
    const { diags } = validate(inRun({ type: "TOOL_CALL_END", toolCallId: "c1" }))
    expect(only(diags, "AGUI202")).toHaveLength(1)
  })

  it("fires for a double end", () => {
    const { diags } = validate(inRun(...toolCall("c1"), { type: "TOOL_CALL_END", toolCallId: "c1" }))
    expect(only(diags, "AGUI202")).toHaveLength(1)
  })
})

describe("AGUI203 — unterminated tool call", () => {
  it("fires at the terminal event and points back to the start", () => {
    const { diags } = validate(
      inRun({ type: "TOOL_CALL_START", toolCallId: "call_7", toolCallName: "t" }),
    )
    const hits = only(diags, "AGUI203")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toBe("TOOL_CALL_START id 'call_7' never terminated")
    expect(hits[0]!.relatedEventIndex).toBe(1)
  })
})

describe("AGUI204 — concatenated args must parse as JSON", () => {
  it("fires at TOOL_CALL_END when accumulated args are invalid", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: '{"a":' },
        { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: "oops}" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    const hits = only(diags, "AGUI204")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("c1")
  })

  it("accepts args split across deltas", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: '{"city":"Ber' },
        { type: "TOOL_CALL_ARGS", toolCallId: "c1", delta: 'lin"}' },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    expect(diags).toEqual([])
  })

  it("does not fire for a call that streamed no args at all", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI204")
  })
})

describe("AGUI205 — duplicate toolCallId within a run", () => {
  it("fires when a completed toolCallId is reused", () => {
    const { diags } = validate(inRun(...toolCall("c1"), ...toolCall("c1")))
    expect(only(diags, "AGUI205")).toHaveLength(1)
  })

  it("fires when an open toolCallId is opened again", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    expect(only(diags, "AGUI205")).toHaveLength(1)
  })
})

describe("AGUI206 — TOOL_CALL_RESULT before TOOL_CALL_END", () => {
  it("warns when the result arrives while the call is open", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
        { type: "TOOL_CALL_RESULT", messageId: "tm1", toolCallId: "c1", content: "42" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    const hits = only(diags, "AGUI206")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("warning")
  })

  it("does not fire for a result after the end", () => {
    const { diags } = validate(
      inRun(...toolCall("c1"), {
        type: "TOOL_CALL_RESULT",
        messageId: "tm1",
        toolCallId: "c1",
        content: "42",
      }),
    )
    expect(diags).toEqual([])
  })
})

describe("AGUI207 — TOOL_CALL_RESULT references unknown toolCallId", () => {
  it("fires for a never-started id", () => {
    const { diags } = validate(
      inRun({ type: "TOOL_CALL_RESULT", messageId: "tm1", toolCallId: "ghost", content: "x" }),
    )
    const hits = only(diags, "AGUI207")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("ghost")
  })

  it("does not fire when the id came from a MESSAGES_SNAPSHOT (prior-run history)", () => {
    const { diags } = validate(
      inRun(
        {
          type: "MESSAGES_SNAPSHOT",
          messages: [
            {
              id: "am1",
              role: "assistant",
              toolCalls: [{ id: "c_hist", type: "function", function: { name: "t", arguments: "{}" } }],
            },
          ],
        },
        { type: "TOOL_CALL_RESULT", messageId: "tm1", toolCallId: "c_hist", content: "x" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI207")
  })
})

describe("AGUI208 — parentMessageId references unknown message", () => {
  it("reports at info severity", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", parentMessageId: "nope" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    const hits = only(diags, "AGUI208")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
  })

  it("does not fire when the parent message streamed in this run", () => {
    const { diags } = validate(
      inRun(
        ...textMessage("m1"),
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", parentMessageId: "m1" },
        { type: "TOOL_CALL_END", toolCallId: "c1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI208")
  })
})

describe("TOOL_CALL_CHUNK handling", () => {
  it("a chunk-only tool call needs no explicit end", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_CHUNK", toolCallId: "c1", toolCallName: "t", delta: '{"a"' },
        { type: "TOOL_CALL_CHUNK", delta: ":1}" },
      ),
    )
    expect(diags).toEqual([])
  })

  it("invalid accumulated chunk args fire AGUI204 when the chunk stream closes", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_CHUNK", toolCallId: "c1", toolCallName: "t", delta: "{oops" },
        ...textMessage("m1"),
      ),
    )
    expect(rulesOf(diags)).toContain("AGUI204")
  })

  it("a first chunk without toolCallId fails schema validation (AGUI504)", () => {
    const { diags } = validate(inRun({ type: "TOOL_CALL_CHUNK", delta: "{}" }))
    expect(only(diags, "AGUI504").length).toBeGreaterThan(0)
  })
})
