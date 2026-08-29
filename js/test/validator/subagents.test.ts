import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, validate } from "../helpers.js"

const startedSub = (over: Record<string, unknown> = {}) => ({
  type: "SUBAGENT_STARTED",
  subagentRunId: "sub_1",
  name: "researcher",
  ...over,
})
const finishedSub = (over: Record<string, unknown> = {}) => ({
  type: "SUBAGENT_FINISHED",
  subagentRunId: "sub_1",
  ...over,
})

describe("subagent lifecycle — clean pairing", () => {
  it("produces no diagnostics for a started/finished pair", () => {
    const { diags } = validate(inRun(startedSub(), finishedSub()))
    expect(diags).toEqual([])
  })

  it("produces no diagnostics for a started/errored pair", () => {
    const { diags } = validate(
      inRun(startedSub(), { type: "SUBAGENT_ERROR", subagentRunId: "sub_1", message: "boom" }),
    )
    expect(diags).toEqual([])
  })

  it("tracks multiple concurrent subagents independently", () => {
    const { diags } = validate(
      inRun(
        startedSub({ subagentRunId: "sub_1" }),
        startedSub({ subagentRunId: "sub_2" }),
        finishedSub({ subagentRunId: "sub_1" }),
        finishedSub({ subagentRunId: "sub_2" }),
      ),
    )
    expect(diags).toEqual([])
  })
})

describe("AGUI601 — duplicate SUBAGENT_STARTED", () => {
  it("fires when a subagentRunId already open is started again", () => {
    const { diags } = validate(inRun(startedSub(), startedSub(), finishedSub()))
    expect(only(diags, "AGUI601")).toHaveLength(1)
  })

  it("fires when a subagentRunId is reused after a plain success close", () => {
    const { diags } = validate(inRun(startedSub(), finishedSub(), startedSub(), finishedSub()))
    expect(only(diags, "AGUI601")).toHaveLength(1)
  })

  it("fires when a subagentRunId is reused after SUBAGENT_ERROR", () => {
    const { diags } = validate(
      inRun(startedSub(), { type: "SUBAGENT_ERROR", subagentRunId: "sub_1", message: "boom" }, startedSub()),
    )
    expect(only(diags, "AGUI601")).toHaveLength(1)
  })

  it("does not fire when a suspended subagent's id is reused (resumption)", () => {
    const { diags } = validate(
      inRun(
        startedSub(),
        finishedSub({ outcome: { type: "suspended", interruptIds: ["int_1"] } }),
        startedSub(),
        finishedSub(),
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI601")
  })

  it("still detects a genuine duplicate after a resumed subagent closes normally", () => {
    const { diags } = validate(
      inRun(
        startedSub(),
        finishedSub({ outcome: { type: "suspended" } }),
        startedSub(),
        finishedSub(),
        startedSub(),
      ),
    )
    expect(only(diags, "AGUI601")).toHaveLength(1)
  })
})

describe("AGUI602/AGUI603 — terminal event without a matching start", () => {
  it("AGUI602 fires for SUBAGENT_FINISHED with no open SUBAGENT_STARTED", () => {
    const { diags } = validate(inRun(finishedSub()))
    expect(only(diags, "AGUI602")).toHaveLength(1)
  })

  it("AGUI603 fires for SUBAGENT_ERROR with no open SUBAGENT_STARTED", () => {
    const { diags } = validate(inRun({ type: "SUBAGENT_ERROR", subagentRunId: "sub_1", message: "boom" }))
    expect(only(diags, "AGUI603")).toHaveLength(1)
  })

  it("AGUI602 fires for a second SUBAGENT_FINISHED on an already-closed subagent", () => {
    const { diags } = validate(inRun(startedSub(), finishedSub(), finishedSub()))
    expect(only(diags, "AGUI602")).toHaveLength(1)
  })
})

describe("AGUI604 — subagent unterminated at run end", () => {
  it("fires at the terminal event and points back to the start", () => {
    const { diags } = validate(inRun(startedSub()))
    const hits = only(diags, "AGUI604")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.relatedEventIndex).toBe(1)
  })

  it("does not fire after RUN_ERROR (open subagents are expected debris)", () => {
    const { diags } = validate([{ type: "RUN_STARTED", threadId: "t", runId: "r" }, startedSub(), { type: "RUN_ERROR", message: "boom" }])
    expect(rulesOf(diags)).not.toContain("AGUI604")
  })

  it("does not fire for a suspended subagent (it did close, just not permanently)", () => {
    const { diags } = validate(inRun(startedSub(), finishedSub({ outcome: { type: "suspended" } })))
    expect(rulesOf(diags)).not.toContain("AGUI604")
  })
})

describe("AGUI605 — parentSubagentRunId references a subagent never started", () => {
  it("fires when the parent id was never observed", () => {
    const { diags } = validate(inRun(startedSub({ parentSubagentRunId: "ghost" }), finishedSub()))
    expect(only(diags, "AGUI605")).toHaveLength(1)
  })

  it("does not fire when the parent was started earlier, even if already finished", () => {
    const { diags } = validate(
      inRun(
        startedSub({ subagentRunId: "parent" }),
        finishedSub({ subagentRunId: "parent" }),
        startedSub({ subagentRunId: "child", parentSubagentRunId: "parent" }),
        finishedSub({ subagentRunId: "child" }),
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI605")
  })

  it("does not fire when the parent is still open (nested, concurrent)", () => {
    const { diags } = validate(
      inRun(
        startedSub({ subagentRunId: "parent" }),
        startedSub({ subagentRunId: "child", parentSubagentRunId: "parent" }),
        finishedSub({ subagentRunId: "child" }),
        finishedSub({ subagentRunId: "parent" }),
      ),
    )
    expect(rulesOf(diags)).not.toContain("AGUI605")
  })
})
