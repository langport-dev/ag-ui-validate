import { describe, expect, it } from "vitest"
import { createValidator } from "../../src/index.js"
import { finished, inRun, only, rulesOf, started, textMessage, toolCall, validate } from "../helpers.js"

describe("input handling — the validator never throws", () => {
  it("accepts raw JSON strings", () => {
    const v = createValidator()
    const diags = v.feed('{"type":"RUN_STARTED","threadId":"t","runId":"r"}')
    expect(diags).toEqual([])
  })

  it("malformed JSON is AGUI502, not an exception", () => {
    const { diags } = validate(['{"type": oops'])
    const hits = only(diags, "AGUI502")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("error")
  })

  it("non-object payloads are AGUI502", () => {
    for (const garbage of ["42", "null", '"hi"', 42, null, undefined, true, ["array"]]) {
      const { diags } = validate([garbage])
      expect(rulesOf(diags), JSON.stringify(garbage)).toContain("AGUI502")
    }
  })

  it("survives hostile objects", () => {
    const cyclic: Record<string, unknown> = { type: "RUN_STARTED", threadId: "t", runId: "r" }
    cyclic.self = cyclic
    const v = createValidator()
    expect(() => {
      v.feed(cyclic)
      v.feed({ type: { nested: "object" } })
      v.feed({ type: "STATE_DELTA", delta: [{ op: "add", path: null, value: 1 }] })
      v.feed(Object.create(null))
      v.finalize()
      v.report()
    }).not.toThrow()
    expect(v.report().internalErrors).toEqual([])
  })
})

describe("AGUI503 — unknown event type", () => {
  it("fires for a type the SDK does not define", () => {
    const { diags } = validate(inRun({ type: "BANANA" }))
    const hits = only(diags, "AGUI503")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("BANANA")
  })

  it("suggests the canonical casing for near-miss types", () => {
    const { diags } = validate(inRun({ type: "runStarted", threadId: "t", runId: "r" }))
    const hits = only(diags, "AGUI503")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("RUN_STARTED")
  })

  it("does not fire for RAW or CUSTOM", () => {
    const { diags } = validate(
      inRun({ type: "RAW", event: { anything: 1 } }, { type: "CUSTOM", name: "acme.ping", value: 1 }),
    )
    expect(rulesOf(diags)).not.toContain("AGUI503")
  })

  it("documented draft types (META) report at info, citing the draft page", () => {
    const { diags } = validate(inRun({ type: "META", metaType: "thumbs_up", payload: {} }))
    const hits = only(diags, "AGUI503")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
    expect(hits[0]!.specUrl).toContain("drafts/meta-events")
  })

  it("deprecated THINKING_* events are valid, not unknown", () => {
    const { diags } = validate(
      inRun(
        { type: "THINKING_START" },
        { type: "THINKING_TEXT_MESSAGE_START" },
        { type: "THINKING_TEXT_MESSAGE_CONTENT", delta: "x" },
        { type: "THINKING_TEXT_MESSAGE_END" },
        { type: "THINKING_END" },
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI503")
  })
})

describe("AGUI504 — schema validation for the declared type", () => {
  it("missing required field, with pointer", () => {
    const { diags } = validate(inRun({ type: "TOOL_CALL_START", toolCallId: "c1" }))
    const hits = only(diags, "AGUI504")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.pointer).toBe("/toolCallName")
    expect(hits[0]!.message).toContain("toolCallName")
  })

  it("wrong primitive kind", () => {
    const { diags } = validate(inRun({ type: "TEXT_MESSAGE_END", messageId: 42 }))
    const hits = only(diags, "AGUI504")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.pointer).toBe("/messageId")
  })

  it("enum violation (docs list 'tool' for TextMessageStart; the SDK rejects it — SQ-3)", () => {
    const { diags } = validate(
      inRun(
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "tool" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
      ),
    )
    expect(only(diags, "AGUI504")).toHaveLength(1)
  })

  it("extra fields are allowed (SDK schemas are passthrough)", () => {
    const { diags } = validate(
      inRun({ type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", vendorExtra: 1 },
        { type: "TEXT_MESSAGE_END", messageId: "m1" }),
    )
    expect(diags).toEqual([])
  })

  it("non-numeric timestamp is flagged on the base event", () => {
    const { diags } = validate(inRun({ type: "TEXT_MESSAGE_END", messageId: "m1", timestamp: "now" }))
    expect(only(diags, "AGUI504").some((d) => d.pointer === "/timestamp")).toBe(true)
  })
})

describe("hygiene rules", () => {
  it("AGUI901 — RAW wrapping a typed AG-UI event", () => {
    const { diags } = validate(
      inRun({ type: "RAW", event: { type: "TOOL_CALL_RESULT", toolCallId: "c1" } }),
    )
    const hits = only(diags, "AGUI901")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
    expect(hits[0]!.message).toContain("TOOL_CALL_RESULT")
  })

  it("AGUI901 does not fire for genuinely foreign events", () => {
    const { diags } = validate(inRun({ type: "RAW", event: { kind: "langgraph-internal" } }))
    expect(rulesOf(diags)).not.toContain("AGUI901")
  })

  it("AGUI902 — stream with no timestamps at all", () => {
    const { diags } = validate([
      { type: "RUN_STARTED", threadId: "t", runId: "r" },
      { type: "RUN_FINISHED", threadId: "t", runId: "r" },
    ])
    const hits = only(diags, "AGUI902")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.eventIndex).toBe(-1)
  })

  it("AGUI902 stays quiet when any event has a timestamp", () => {
    const { diags } = validate(inRun())
    expect(rulesOf(diags)).not.toContain("AGUI902")
  })

  it("AGUI903 — un-namespaced CUSTOM name", () => {
    const { diags } = validate(inRun({ type: "CUSTOM", name: "ping", value: null }))
    const hits = only(diags, "AGUI903")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
  })

  it("AGUI903 accepts namespaced names", () => {
    const { diags } = validate(inRun({ type: "CUSTOM", name: "acme.ping", value: null }))
    expect(rulesOf(diags)).not.toContain("AGUI903")
  })
})

describe("severity overrides", () => {
  it("'off' suppresses a rule", () => {
    const { diags } = validate(inRun({ type: "CUSTOM", name: "ping", value: null }), {
      severityOverrides: { AGUI903: "off" },
    })
    expect(rulesOf(diags)).not.toContain("AGUI903")
  })

  it("overridden severity lands in the diagnostic and the summary", () => {
    const { diags, report } = validate(inRun({ type: "CUSTOM", name: "ping", value: null }), {
      severityOverrides: { AGUI903: "error" },
    })
    expect(only(diags, "AGUI903")[0]!.severity).toBe("error")
    expect(report.summary.errors).toBe(1)
    expect(report.summary.info).toBe(0)
  })
})

describe("report()", () => {
  it("counts by severity and reports event count", () => {
    const { report } = validate([
      started(),
      { type: "TEXT_MESSAGE_CONTENT", messageId: "ghost", delta: "" },
      finished(),
    ])
    expect(report.eventCount).toBe(3)
    expect(report.summary.errors).toBeGreaterThan(0)
    expect(report.diagnostics.length).toBeGreaterThan(0)
  })

  it("reports transport rules as skipped, never silently", () => {
    const { report } = validate(inRun())
    const skippedRules = report.skipped.map((s) => s.rule)
    for (const rule of ["AGUI501", "AGUI505", "AGUI506", "AGUI507", "AGUI508"]) {
      expect(skippedRules).toContain(rule)
    }
    expect(report.skipped.every((s) => s.reason.length > 0)).toBe(true)
  })

  it("infers the feature matrix from observed events", () => {
    const { report } = validate(
      inRun(
        ...textMessage(),
        ...toolCall(),
        { type: "TOOL_CALL_RESULT", messageId: "tm", toolCallId: "call_1", content: "ok" },
        { type: "STATE_SNAPSHOT", snapshot: {} },
        { type: "CUSTOM", name: "PredictState", value: [] },
      ),
    )
    expect(report.features["agentic-chat"]).toBe("exercised")
    expect(report.features["backend-tool-rendering"]).toBe("exercised")
    expect(report.features["shared-state"]).toBe("exercised")
    expect(report.features["predictive-state-updates"]).toBe("exercised")
    expect(report.features["human-in-the-loop"]).toBe("not-exercised")
    expect(report.features["agentic-generative-ui"]).toBe("not-inferable")
    expect(report.features["tool-based-generative-ui"]).toBe("not-inferable")
  })

  it("an interrupt outcome marks human-in-the-loop exercised", () => {
    const { report } = validate([
      started(),
      finished({ outcome: { type: "interrupt", interrupts: [{ id: "i1" }] } }),
    ])
    expect(report.features["human-in-the-loop"]).toBe("exercised")
  })
})

describe("finalize()", () => {
  it("is idempotent", () => {
    const v = createValidator()
    v.feed(started())
    const first = v.finalize()
    expect(first.length).toBeGreaterThan(0)
    expect(v.finalize()).toEqual([])
  })
})

describe("multi-run streams (SQ-6)", () => {
  it("validates each run independently and accepts parentRunId branching", () => {
    const { diags } = validate([
      started({ runId: "r1" }),
      finished({ runId: "r1" }),
      started({ runId: "r2", parentRunId: "r1" }),
      { type: "TOOL_CALL_START", toolCallId: "c1", toolCallName: "t" },
      finished({ runId: "r2" }),
    ])
    expect(rulesOf(diags)).toEqual(["AGUI203"])
  })
})
