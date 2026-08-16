// Core support for wrapping layers (transport, CLI): the `layers` option and
// `emitExternal`, which routes layer-checked diagnostics through the same
// catalog formatting, severity overrides, and summary as core diagnostics.
import { describe, expect, it } from "vitest"
import { createValidator } from "../../src/index.js"
import { inRun, validate } from "../helpers.js"

const TRANSPORT_RULES = ["AGUI501", "AGUI505", "AGUI506", "AGUI507", "AGUI508"]

describe("layers option", () => {
  it("transport rules are reported as skipped by default", () => {
    const { report } = validate(inRun())
    const skipped = report.skipped.map((s) => s.rule)
    for (const rule of TRANSPORT_RULES) expect(skipped).toContain(rule)
  })

  it("declaring the transport layer removes transport rules from skipped", () => {
    const { report } = validate(inRun(), { layers: ["core", "transport"] })
    const skipped = report.skipped.map((s) => s.rule)
    for (const rule of TRANSPORT_RULES) expect(skipped).not.toContain(rule)
  })
})

describe("emitExternal", () => {
  it("routes a transport diagnostic through catalog formatting and the summary", () => {
    const v = createValidator({ layers: ["core", "transport"] })
    const d = v.emitExternal("AGUI505", { contentType: "text/html" })
    expect(d).not.toBeNull()
    expect(d!.rule).toBe("AGUI505")
    expect(d!.severity).toBe("warning")
    expect(d!.message).toBe(
      "Content-Type 'text/html' is neither text/event-stream nor application/x-ndjson",
    )
    expect(d!.eventIndex).toBe(-1)
    expect(d!.specUrl).toMatch(/^https:/)
    const report = v.report()
    expect(report.summary.warnings).toBe(1)
    expect(report.diagnostics).toContainEqual(d)
  })

  it("respects severity overrides, including off", () => {
    const v = createValidator({ severityOverrides: { AGUI506: "off", AGUI507: "error" } })
    expect(v.emitExternal("AGUI506", { seconds: 47 })).toBeNull()
    expect(v.emitExternal("AGUI507", { detail: "single chunk" })!.severity).toBe("error")
  })

  it("unknown rules return null and land in internalErrors", () => {
    const v = createValidator()
    expect(v.emitExternal("AGUI999", {})).toBeNull()
    expect(v.report().internalErrors.some((e) => e.includes("AGUI999"))).toBe(true)
  })

  it("accepts an explicit eventIndex", () => {
    const v = createValidator()
    const d = v.emitExternal("AGUI501", { detail: "bad frame" }, { eventIndex: 4 })
    expect(d!.eventIndex).toBe(4)
  })
})
