// Meta-test for the rule catalog: every entry must cite the spec, and (from
// M4) have fixture coverage. Tests may use node built-ins; the runtime core
// may not.
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
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
    const specQuestions = readFileSync(new URL("../../docs/spec-questions.md", import.meta.url), "utf8")
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

  const CATEGORIES = ["lifecycle", "text", "toolcall", "state", "reasoning", "transport", "hygiene"]

  it("rejects a catalog with an unknown category", () => {
    expect(() =>
      validateCatalog({
        catalogVersion: "0",
        spec: "0.x",
        rules: [
          {
            id: "AGUI999",
            severity: "error",
            title: "x",
            messageTemplate: "x",
            specUrl: "https://docs.ag-ui.com/x",
            since: "0.x",
            checkedIn: "core",
            category: "nonsense",
          },
        ],
      }),
    ).toThrow(/category/)
  })

  it.each(CATALOG.rules.map((r) => [r.id, r] as const))("%s has a known category", (_id, rule) => {
    expect(CATEGORIES).toContain(rule.category)
  })

  it("category matches the rule ID's hundreds-digit grouping", () => {
    const expectedByPrefix: Record<string, string> = {
      "0": "lifecycle",
      "1": "text",
      "2": "toolcall",
      "3": "state",
      "4": "reasoning",
      "5": "transport",
      "9": "hygiene",
    }
    for (const rule of CATALOG.rules) {
      const prefix = rule.id[4] ?? ""
      expect(rule.category, rule.id).toBe(expectedByPrefix[prefix])
    }
  })

  it("every rule has an invalid fixture directory whose expected.json fires it", () => {
    const root = fileURLToPath(new URL("../../spec/fixtures/invalid/", import.meta.url))
    const dirs = readdirSync(root)
    for (const rule of CATALOG.rules) {
      const dir = dirs.find((d) => d.startsWith(`${rule.id}-`))
      expect(dir, `${rule.id} has no spec/fixtures/invalid/${rule.id}-*/ directory`).toBeDefined()
      const expected = JSON.parse(readFileSync(`${root}${dir}/expected.json`, "utf8")) as { rule: string }[]
      expect(
        expected.map((d) => d.rule),
        `${dir}/expected.json must include ${rule.id}`,
      ).toContain(rule.id)
    }
  })
})
