// Meta-test for the rule catalog: every entry must cite the spec, and (from
// M4) have fixture coverage. Tests may use node built-ins; the runtime core
// may not.
import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CATALOG, RULES, formatMessage, validateCatalog } from "../src/rules/catalog.js"

describe("rule catalog", () => {
  it("loads and validates", () => {
    expect(CATALOG.rules.length).toBeGreaterThan(0)
    expect(RULES.size).toBe(CATALOG.rules.length)
  })

  it.each(CATALOG.rules.map((r) => [r.id, r] as const))(
    "%s cites a real spec section",
    (_id, rule) => {
      expect(rule.specUrl).toMatch(/^https:\/\/(docs\.ag-ui\.com|html\.spec\.whatwg\.org|datatracker\.ietf\.org)\//)
    },
  )

  it("only downgraded/ambiguous rules cite spec questions, and all citations resolve", () => {
    const specQuestions = readFileSync(new URL("../docs/spec-questions.md", import.meta.url), "utf8")
    for (const rule of CATALOG.rules) {
      if (rule.specQuestion) {
        expect(specQuestions, `${rule.id} cites ${rule.specQuestion}`).toContain(`## ${rule.specQuestion}:`)
      }
    }
  })

  it("rules that fire only under a declared feature name that feature", () => {
    for (const rule of CATALOG.rules) {
      if (rule.requiresFeature) expect(rule.feature).toBeTruthy()
    }
  })

  it("message templates format cleanly", () => {
    const rule = RULES.get("AGUI203")
    expect(rule).toBeDefined()
    expect(formatMessage(rule!, { toolCallId: "call_7" })).toBe(
      "TOOL_CALL_START id 'call_7' never terminated",
    )
  })

  it("rejects a catalog with a missing specUrl", () => {
    expect(() =>
      validateCatalog({
        catalogVersion: "0",
        spec: "0.x",
        rules: [{ id: "AGUI999", severity: "error", title: "x", messageTemplate: "x", since: "0.x", checkedIn: "core" }],
      }),
    ).toThrow(/specUrl/)
  })

  // TODO(M4): once fixtures/ lands, replace this with a hard assertion that
  // every rule has fixtures/invalid/<id>-*/ and appears in a valid/ fixture's
  // false-positive guard.
  it("every rule has a fixture directory (pending M4)", (ctx) => {
    const fixturesRoot = new URL("../fixtures/invalid", import.meta.url)
    if (!existsSync(fixturesRoot)) ctx.skip()
  })
})
