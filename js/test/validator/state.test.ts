import { describe, expect, it } from "vitest"
import { inRun, only, rulesOf, validate } from "../helpers.js"

const snapshot = (snap: unknown): Record<string, unknown> => ({ type: "STATE_SNAPSHOT", snapshot: snap })
const delta = (ops: unknown): Record<string, unknown> => ({ type: "STATE_DELTA", delta: ops })

describe("AGUI301 — STATE_DELTA before any STATE_SNAPSHOT", () => {
  it("reports at info severity, once per run", () => {
    const { diags } = validate(
      inRun(delta([{ op: "add", path: "/a", value: 1 }]), delta([{ op: "add", path: "/b", value: 2 }])),
    )
    const hits = only(diags, "AGUI301")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
  })

  it("does not fire when a snapshot came first", () => {
    const { diags } = validate(
      inRun(snapshot({}), delta([{ op: "add", path: "/a", value: 1 }])),
    )
    expect(rulesOf(diags)).not.toContain("AGUI301")
  })
})

describe("AGUI302 — STATE_DELTA fails to apply", () => {
  it("fires when a patch path does not exist in reconstructed state", () => {
    const { diags } = validate(
      inRun(snapshot({ items: [] }), delta([{ op: "replace", path: "/items/3", value: "x" }])),
    )
    const hits = only(diags, "AGUI302")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.message).toContain("/items/3")
  })

  it("applies deltas cumulatively", () => {
    const { diags } = validate(
      inRun(
        snapshot({ items: [] }),
        delta([{ op: "add", path: "/items/-", value: "a" }]),
        delta([{ op: "replace", path: "/items/0", value: "b" }]),
      ),
    )
    expect(diags).toEqual([])
  })

  it("does not fire when no snapshot established a base (unknown seed state)", () => {
    const { diags } = validate(inRun(delta([{ op: "replace", path: "/items/3", value: "x" }])))
    expect(rulesOf(diags)).not.toContain("AGUI302")
  })

  it("a failed test op is a failed patch", () => {
    const { diags } = validate(
      inRun(snapshot({ a: 1 }), delta([{ op: "test", path: "/a", value: 2 }])),
    )
    expect(only(diags, "AGUI302")).toHaveLength(1)
  })
})

describe("AGUI303 — STATE_DELTA is not a valid RFC 6902 patch document", () => {
  it("fires for a non-array delta", () => {
    const { diags } = validate(inRun(delta({ op: "add", path: "/a", value: 1 })))
    expect(only(diags, "AGUI504").length + only(diags, "AGUI303").length).toBeGreaterThan(0)
  })

  it("fires for an unknown op", () => {
    const { diags } = validate(inRun(delta([{ op: "merge", path: "/a", value: 1 }])))
    const hits = only(diags, "AGUI303")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.pointer).toBe("/delta/0/op")
  })

  it("fires when add is missing value", () => {
    const { diags } = validate(inRun(delta([{ op: "add", path: "/a" }])))
    expect(only(diags, "AGUI303")).toHaveLength(1)
  })

  it("fires for an invalid path pointer", () => {
    const { diags } = validate(inRun(delta([{ op: "add", path: "no-leading-slash", value: 1 }])))
    expect(only(diags, "AGUI303")).toHaveLength(1)
  })

  it("move needs from", () => {
    const { diags } = validate(inRun(delta([{ op: "move", path: "/a" }])))
    expect(only(diags, "AGUI303")).toHaveLength(1)
  })
})

describe("AGUI304 — mid-run STATE_SNAPSHOT discards accumulated deltas", () => {
  it("reports at info when a snapshot follows applied deltas", () => {
    const { diags } = validate(
      inRun(
        snapshot({ a: 1 }),
        delta([{ op: "replace", path: "/a", value: 2 }]),
        snapshot({ a: 99 }),
      ),
    )
    const hits = only(diags, "AGUI304")
    expect(hits).toHaveLength(1)
    expect(hits[0]!.severity).toBe("info")
    expect(hits[0]!.message).toContain("1 delta")
  })

  it("does not fire for the first snapshot or delta-less resyncs", () => {
    const { diags } = validate(inRun(snapshot({ a: 1 }), snapshot({ a: 2 })))
    expect(rulesOf(diags)).not.toContain("AGUI304")
  })
})

describe("AGUI305 — shared state declared but never established", () => {
  it("fires only when the feature is declared", () => {
    const declared = validate(inRun(), { features: ["shared-state"] })
    expect(rulesOf(declared.diags)).toContain("AGUI305")
    expect(only(declared.diags, "AGUI305")[0]!.severity).toBe("warning")

    const undeclared = validate(inRun())
    expect(rulesOf(undeclared.diags)).not.toContain("AGUI305")
  })

  it("does not fire when a snapshot was emitted", () => {
    const { diags } = validate(inRun(snapshot({})), { features: ["shared-state"] })
    expect(rulesOf(diags)).not.toContain("AGUI305")
  })
})
