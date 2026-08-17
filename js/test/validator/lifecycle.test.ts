import { describe, expect, it } from "vitest"
import { finished, inRun, only, rulesOf, started, textMessage, validate } from "../helpers.js"

describe("AGUI001 — RUN_STARTED must be the first event in a run", () => {
  it("fires when the stream opens with something else", () => {
    const { diags } = validate([{ type: "TEXT_MESSAGE_START", messageId: "m1" }])
    const hits = only(diags, "AGUI001")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.eventIndex).toBe(0)
    expect(hits[0]!.message).toContain("TEXT_MESSAGE_START")
    expect(hits[0]!.specUrl).toMatch(/^https:\/\/docs\.ag-ui\.com/)
  })

  it("fires once, not per pre-run event", () => {
    const { diags } = validate([
      { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "x" },
    ])
    expect(only(diags, "AGUI001")).toHaveLength(1)
  })

  it("does not fire on a well-formed run", () => {
    const { diags } = validate(inRun(...textMessage()))
    expect(rulesOf(diags)).not.toContain("AGUI001")
  })
})

describe("AGUI002 — exactly one RUN_STARTED per run", () => {
  it("fires on a second RUN_STARTED while the run is open", () => {
    const { diags } = validate([started(), started({ runId: "run_2" }), finished()])
    const hits = only(diags, "AGUI002")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.eventIndex).toBe(1)
  })

  it("does not fire for a new run after a clean terminal (multi-run stream)", () => {
    const { diags } = validate([
      started(),
      finished(),
      started({ runId: "run_2" }),
      finished({ runId: "run_2" }),
    ])
    expect(rulesOf(diags)).not.toContain("AGUI002")
    expect(rulesOf(diags)).not.toContain("AGUI004")
  })
})

describe("AGUI003 — run must terminate", () => {
  it("fires at finalize when the run never terminated", () => {
    const v = validate([started(), ...textMessage()])
    const hits = only(v.diags, "AGUI003")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("run_1")
  })

  it("does not fire when the run ends with RUN_ERROR", () => {
    const { diags } = validate([started(), { type: "RUN_ERROR", message: "boom" }])
    expect(rulesOf(diags)).not.toContain("AGUI003")
  })
})

describe("AGUI004 — no events after a terminal event", () => {
  it("fires for a non-lifecycle event after RUN_FINISHED", () => {
    const { diags } = validate([
      started(),
      finished(),
      { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
    ])
    const hits = only(diags, "AGUI004")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.eventIndex).toBe(2)
    expect(hits[0]!.relatedEventIndex).toBe(1)
  })

  it("fires for a duplicate RUN_FINISHED", () => {
    const { diags } = validate([started(), finished(), finished()])
    expect(rulesOf(diags)).toContain("AGUI004")
    expect(rulesOf(diags)).not.toContain("AGUI005")
  })
})

describe("AGUI005 — RUN_FINISHED and RUN_ERROR are mutually exclusive", () => {
  it("fires when RUN_ERROR follows RUN_FINISHED", () => {
    const { diags } = validate([started(), finished(), { type: "RUN_ERROR", message: "boom" }])
    const hits = only(diags, "AGUI005")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("RUN_FINISHED")
  })

  it("fires when RUN_FINISHED follows RUN_ERROR", () => {
    const { diags } = validate([started(), { type: "RUN_ERROR", message: "boom" }, finished()])
    expect(only(diags, "AGUI005")).toHaveLength(1)
  })
})

describe("AGUI006 — STEP_FINISHED without matching STEP_STARTED", () => {
  it("fires for an unknown stepName", () => {
    const { diags } = validate(inRun({ type: "STEP_FINISHED", stepName: "plan" }))
    const hits = only(diags, "AGUI006")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("plan")
  })

  it("does not fire for a matched pair", () => {
    const { diags } = validate(
      inRun({ type: "STEP_STARTED", stepName: "plan" }, { type: "STEP_FINISHED", stepName: "plan" }),
    )
    expect(rulesOf(diags)).not.toContain("AGUI006")
  })
})

describe("AGUI007 — step unterminated at run end", () => {
  it("fires at the terminal event for a step never finished", () => {
    const { diags } = validate(inRun({ type: "STEP_STARTED", stepName: "plan" }))
    const hits = only(diags, "AGUI007")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("plan")
  })

  it("fires at finalize when the run also never terminated", () => {
    const { diags } = validate([started(), { type: "STEP_STARTED", stepName: "plan" }])
    expect(rulesOf(diags)).toContain("AGUI007")
    expect(rulesOf(diags)).toContain("AGUI003")
  })
})

describe("AGUI008 — threadId/runId stable across the run", () => {
  it("fires when RUN_FINISHED ids do not match RUN_STARTED", () => {
    const { diags } = validate([started(), finished({ runId: "other_run" })])
    const hits = only(diags, "AGUI008")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("other_run")
    expect(hits[0]!.pointer).toBe("/runId")
  })

  it("fires per mismatched field", () => {
    const { diags } = validate([started(), finished({ runId: "r2", threadId: "t2" })])
    expect(only(diags, "AGUI008")).toHaveLength(2)
  })

  it("does not fire when ids match", () => {
    const { diags } = validate(inRun())
    expect(rulesOf(diags)).not.toContain("AGUI008")
  })
})

describe("clean streams", () => {
  it("a complete well-formed run yields zero diagnostics", () => {
    const { diags, report } = validate(inRun(...textMessage()))
    expect(diags).toEqual([])
    expect(report.summary).toEqual({ errors: 0, warnings: 0, info: 0 })
  })
})
