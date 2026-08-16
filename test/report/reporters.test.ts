import { describe, expect, it } from "vitest"
import { formatDiagnosticLine, formatReportSummary } from "../../src/report/pretty.js"
import { toJsonReport } from "../../src/report/json.js"
import { toSarif } from "../../src/report/sarif.js"
import { toJUnit } from "../../src/report/junit.js"
import type { Diagnostic, Report } from "../../src/types.js"

const d203: Diagnostic = {
  rule: "AGUI203",
  severity: "error",
  message: "TOOL_CALL_START id 'call_7' never terminated",
  eventIndex: 42,
  eventType: "RUN_FINISHED",
  relatedEventIndex: 17,
  specUrl: "https://docs.ag-ui.com/concepts/events#tool-call-events",
}
const d902: Diagnostic = {
  rule: "AGUI902",
  severity: "info",
  message: "None of the 61 events carry the optional timestamp property",
  eventIndex: -1,
  specUrl: "https://docs.ag-ui.com/concepts/events#base-event-properties",
}
const d105: Diagnostic = {
  rule: "AGUI105",
  severity: "warning",
  message: "TEXT_MESSAGE_CONTENT for messageId 'm<1>' has an empty delta",
  eventIndex: 7,
  pointer: "/delta",
  specUrl: "https://docs.ag-ui.com/concepts/events#textmessagecontent",
}

const report: Report = {
  diagnostics: [d203, d105, d902],
  summary: { errors: 1, warnings: 1, info: 1 },
  features: {
    "agentic-chat": "exercised",
    "backend-tool-rendering": "exercised",
    "human-in-the-loop": "not-exercised",
    "agentic-generative-ui": "not-inferable",
    "tool-based-generative-ui": "not-inferable",
    "shared-state": "not-exercised",
    "predictive-state-updates": "not-exercised",
  },
  skipped: [{ rule: "AGUI506", reason: "keepalive timing is not meaningful for recorded input" }],
  eventCount: 61,
  internalErrors: [],
}

const clean: Report = {
  ...report,
  diagnostics: [],
  summary: { errors: 0, warnings: 0, info: 0 },
}

describe("pretty", () => {
  it("formats a diagnostic line like the spec's example output", () => {
    const line = formatDiagnosticLine(d203, { color: false })
    expect(line).toContain("✖ AGUI203")
    expect(line).toContain("error")
    expect(line).toContain("event 42")
    expect(line).toContain("TOOL_CALL_START id 'call_7' never terminated")
  })

  it("stream-level findings show — instead of an event index", () => {
    const line = formatDiagnosticLine(d902, { color: false })
    expect(line).toContain("ℹ AGUI902")
    expect(line).toContain("—")
  })

  it("no ANSI codes without color", () => {
    expect(formatDiagnosticLine(d203, { color: false })).not.toMatch(/\x1b\[/)
    expect(formatDiagnosticLine(d203, { color: true })).toMatch(/\x1b\[/)
  })

  it("summarizes counts and the feature matrix", () => {
    const s = formatReportSummary(report, { color: false })
    expect(s).toContain("1 error, 1 warning, 1 info")
    expect(s).toContain("2 of 7 AG-UI features exercised")
    expect(s).toContain("1 rule not evaluated")
  })

  it("celebrates a clean run", () => {
    const s = formatReportSummary(clean, { color: false })
    expect(s).toContain("no conformance violations")
    expect(s).toContain("61 events")
  })
})

describe("json", () => {
  it("wraps the report with tool metadata", () => {
    const out = toJsonReport(report, { tool: { name: "ag-ui-validate", version: "1.2.3" }, target: "run.jsonl" })
    expect(out.tool).toEqual({ name: "ag-ui-validate", version: "1.2.3" })
    expect(out.target).toBe("run.jsonl")
    expect(out.summary).toEqual({ errors: 1, warnings: 1, info: 1 })
    expect(out.diagnostics).toHaveLength(3)
    expect(JSON.parse(JSON.stringify(out))).toEqual(out) // JSON-safe
  })
})

describe("sarif", () => {
  it("emits valid SARIF 2.1.0 structure with level mapping and rule metadata", () => {
    const s = toSarif(report, { toolVersion: "1.2.3", artifactUri: "run.jsonl" })
    expect(s.version).toBe("2.1.0")
    expect(s.$schema).toContain("sarif")
    const run = s.runs[0]!
    expect(run.tool.driver.name).toBe("ag-ui-validate")
    expect(run.tool.driver.version).toBe("1.2.3")
    const levels = run.results.map((r) => r.level)
    expect(levels).toEqual(["error", "warning", "note"])
    // rule metadata comes from the catalog: title, catalog severity, citation
    const meta = run.tool.driver.rules.find((r) => r.id === "AGUI203")!
    expect(meta.helpUri).toContain("docs.ag-ui.com")
    expect(meta.shortDescription?.text).toBe("Unterminated tool call")
    expect(meta.defaultConfiguration?.level).toBe("error")
    const info = run.tool.driver.rules.find((r) => r.id === "AGUI902")!
    expect(info.defaultConfiguration?.level).toBe("note")
    // line-based location for line-oriented input: eventIndex 42 -> line 43
    expect(run.results[0]!.locations[0]!.physicalLocation.region.startLine).toBe(43)
    // stream-level findings carry no location
    expect(run.results[2]!.locations).toHaveLength(0)
  })

  it("omits locations entirely when there is no line-based artifact", () => {
    const s = toSarif(report, { toolVersion: "1.2.3" })
    expect(s.runs[0]!.results[0]!.locations).toHaveLength(0)
  })
})

describe("junit", () => {
  it("emits one testcase per finding, failures for errors, escaped XML", () => {
    const xml = toJUnit(report, { name: "run.jsonl" })
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(xml).toContain('tests="3"')
    expect(xml).toContain('failures="1"')
    expect(xml).toContain('skipped="2"')
    expect(xml).toContain("AGUI203")
    expect(xml).toContain("m&lt;1&gt;") // the < > in the message got escaped
    expect(xml).not.toContain("m<1>")
  })

  it("wraps the suite in a <testsuites> root for strict CI parsers", () => {
    const xml = toJUnit(report, { name: "run.jsonl" })
    expect(xml).toMatch(/<testsuites [^>]*tests="3"[^>]*>/)
    expect(xml.trim().endsWith("</testsuites>")).toBe(true)
  })

  it("a clean report is a single passing testcase", () => {
    const xml = toJUnit(clean, { name: "run.jsonl" })
    expect(xml).toContain('tests="1"')
    expect(xml).toContain('failures="0"')
    expect(xml).toContain("conformance")
  })
})
