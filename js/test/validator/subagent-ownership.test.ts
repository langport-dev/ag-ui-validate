// AGUI606 — continuation/close event's subagentRunId must agree with its
// entity's owner. Fixture coverage (spec/fixtures/invalid/AGUI606-*) exercises
// the text-message case; these cover the toolcall/step variants and the
// documented exceptions (TOOL_CALL_RESULT, omitted tags, parentMessageId
// inheritance).
import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, validate } from "../helpers.js"

describe("AGUI606 — text message ownership", () => {
  it("does not fire when the continuation omits subagentRunId entirely", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", subagentRunId: "sub_1" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hi" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI606")
  })

  it("does not fire when the continuation repeats the same tag", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", subagentRunId: "sub_1" },
        { type: "TEXT_MESSAGE_END", messageId: "m1", subagentRunId: "sub_1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI606")
  })

  it("fires when a message opened under the run is continued under a subagent", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hi", subagentRunId: "sub_1" },
      ),
    )
    const hits = only(diags, "AGUI606")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("the run")
  })
})

describe("AGUI606 — tool call ownership and inheritance", () => {
  it("fires when TOOL_CALL_END disagrees with TOOL_CALL_START's explicit owner", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", subagentRunId: "sub_1" },
        { type: "TOOL_CALL_END", toolCallId: "c1", subagentRunId: "sub_2" },
      ),
    )
    expect(only(diags, "AGUI606")).toHaveLength(1)
  })

  it("an untagged tool call inherits its parent message's owner", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", subagentRunId: "sub_1" },
        { type: "TEXT_MESSAGE_END", messageId: "m1", subagentRunId: "sub_1" },
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", parentMessageId: "m1" },
        // Repeats the inherited owner explicitly — must not be flagged as a mismatch.
        { type: "TOOL_CALL_END", toolCallId: "c1", subagentRunId: "sub_1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI606")
  })

  it("flags a tool call continuation that contradicts the inherited owner", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", subagentRunId: "sub_1" },
        { type: "TEXT_MESSAGE_END", messageId: "m1", subagentRunId: "sub_1" },
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", parentMessageId: "m1" },
        { type: "TOOL_CALL_END", toolCallId: "c1", subagentRunId: "sub_2" },
      ),
    )
    expect(only(diags, "AGUI606")).toHaveLength(1)
  })

  it("an explicit subagentRunId on TOOL_CALL_START overrides parentMessageId inheritance", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", subagentRunId: "sub_1" },
        { type: "TEXT_MESSAGE_END", messageId: "m1", subagentRunId: "sub_1" },
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", parentMessageId: "m1", subagentRunId: "sub_2" },
        { type: "TOOL_CALL_END", toolCallId: "c1", subagentRunId: "sub_2" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI606")
  })

  it("TOOL_CALL_RESULT is exempt — it states its own attribution", () => {
    const { diags } = validate(
      inRun(
        { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t", subagentRunId: "sub_1" },
        { type: "TOOL_CALL_RESULT", messageId: "tm1", toolCallId: "c1", content: "ok", subagentRunId: "sub_2" },
        { type: "TOOL_CALL_END", toolCallId: "c1", subagentRunId: "sub_1" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI606")
  })
})

describe("AGUI606 — step ownership", () => {
  it("fires when STEP_FINISHED disagrees with the owner STEP_STARTED recorded", () => {
    const { diags } = validate(
      inRun(
        { type: "STEP_STARTED", stepName: "plan", subagentRunId: "sub_1" },
        { type: "STEP_FINISHED", stepName: "plan", subagentRunId: "sub_2" },
      ),
    )
    expect(only(diags, "AGUI606")).toHaveLength(1)
  })

  it("a re-entrant STEP_STARTED does not change the recorded owner", () => {
    const { diags } = validate(
      inRun(
        { type: "STEP_STARTED", stepName: "plan", subagentRunId: "sub_1" },
        { type: "STEP_STARTED", stepName: "plan", subagentRunId: "sub_2" },
        { type: "STEP_FINISHED", stepName: "plan", subagentRunId: "sub_2" },
        { type: "STEP_FINISHED", stepName: "plan", subagentRunId: "sub_1" },
      ),
    )
    // The second STEP_FINISHED("sub_1") is the one that agrees with the
    // first opener; the first STEP_FINISHED("sub_2") disagrees with it.
    expect(only(diags, "AGUI606")).toHaveLength(1)
  })
})
