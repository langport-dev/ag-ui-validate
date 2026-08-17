// The ag-ui-validate/vitest subpath: expect(events).toBeValidAGUI().
// Importing the entry registers the matcher; the raw matcher function is also
// exported so its failure messages can be asserted directly (and so Jest users
// can expect.extend it themselves).
import { describe, expect, it } from "vitest"
import "../../src/vitest/index.js"
import { toBeValidAGUI } from "../../src/vitest/matcher.js"
import { finished, inRun, started, textMessage, toolCall } from "../helpers.js"

const good = inRun(...textMessage())
// TOOL_CALL_START that never terminates -> AGUI203 (error)
const bad = [started(), toolCall("call_7")[0], finished()]

describe("toBeValidAGUI (registered matcher)", () => {
  it("passes on a well-formed stream", () => {
    expect(good).toBeValidAGUI()
  })

  it("fails on a violating stream, naming the rule", () => {
    expect(bad).not.toBeValidAGUI()
    expect(() => expect(bad).toBeValidAGUI()).toThrow(/AGUI203/)
  })

  it(".not on a valid stream fails with a message that says it was valid", () => {
    expect(() => expect(good).not.toBeValidAGUI()).toThrow(/valid/i)
  })

  it("warning-severity findings do not fail by default", () => {
    expect(bad).toBeValidAGUI({ severityOverrides: { AGUI203: "warning" } })
  })

  it("maxWarnings makes warnings fail", () => {
    const options = { severityOverrides: { AGUI203: "warning" as const }, maxWarnings: 0 }
    expect(bad).not.toBeValidAGUI(options)
    expect(() => expect(bad).toBeValidAGUI(options)).toThrow(/warning/i)
  })

  it("severityOverrides can disable a rule entirely", () => {
    expect(bad).toBeValidAGUI({ severityOverrides: { AGUI203: "off" } })
  })

  it("declared features are forwarded to the validator", () => {
    expect(good).toBeValidAGUI({ features: ["shared-state"] })
  })

  it("accepts a JSONL string (e.g. a capture read from disk)", () => {
    const capture = `${good.map((e) => JSON.stringify(e)).join("\n")}\n`
    expect(capture).toBeValidAGUI()
    expect(`${capture}{not json\n`).not.toBeValidAGUI()
    expect(() => expect(`${capture}{not json\n`).toBeValidAGUI()).toThrow(/AGUI502/)
  })

  it("throws on a received value that is neither an array nor a string", () => {
    expect(() => expect(42).toBeValidAGUI()).toThrow(/array|JSONL/i)
    // a single event object must be wrapped in an array
    expect(() => expect(started()).toBeValidAGUI()).toThrow(/array|JSONL/i)
  })
})

describe("toBeValidAGUI (raw matcher function)", () => {
  it("failure message carries the pretty-formatted findings and spec links", () => {
    const result = toBeValidAGUI(bad)
    expect(result.pass).toBe(false)
    const message = result.message()
    expect(message).toContain("✖ AGUI203")
    expect(message).toContain("docs.ag-ui.com")
    expect(message).not.toMatch(/\x1b\[/) // never ANSI-colored
  })

  it("pass message (shown for .not) reports the clean result", () => {
    const result = toBeValidAGUI(good)
    expect(result.pass).toBe(true)
    expect(result.message()).toMatch(/valid/i)
    expect(result.message()).toContain(`${good.length} events`)
  })

  it("mentions the warning budget when maxWarnings caused the failure", () => {
    const result = toBeValidAGUI(bad, {
      severityOverrides: { AGUI203: "warning" },
      maxWarnings: 0,
    })
    expect(result.pass).toBe(false)
    expect(result.message()).toMatch(/1 warning.*max-?Warnings|max-?Warnings.*1 warning/is)
  })
})
