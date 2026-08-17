// Rule documentation stays generated, complete, and in sync with the catalog.
// Pages are emitted by scripts/generate-rule-docs.mjs; hand-edits or a stale
// regeneration fail the drift check the same way protocol drift does.
import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import catalog from "../spec/catalog.json"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const page = (id: string) => `${ROOT}docs/rules/${id}.md`

describe("per-rule docs pages", () => {
  it.each(catalog.rules.map((r) => [r.id, r] as const))("%s has a complete page", (_id, rule) => {
    expect(existsSync(page(rule.id)), `${rule.id}.md missing — run npm run docs:generate`).toBe(true)
    const md = readFileSync(page(rule.id), "utf8")
    expect(md).toContain(`# ${rule.id} — ${rule.title}`)
    expect(md).toContain(rule.severity)
    expect(md).toContain(rule.specUrl)
    if (rule.specQuote !== undefined) {
      expect(md).toContain(rule.specQuote) // the grounding quote, verbatim
    }
    expect(md).not.toContain("> undefined")
    expect(md).toContain("generate-rule-docs") // generated-file notice
  })

  it("rules flagged as spec-ambiguous link their spec question", () => {
    for (const rule of catalog.rules) {
      if (rule.specQuestion === undefined) continue
      expect(readFileSync(page(rule.id), "utf8")).toContain(rule.specQuestion)
    }
  })

  it("every page shows a violating example from the fixture corpus", () => {
    for (const rule of catalog.rules) {
      const md = readFileSync(page(rule.id), "utf8")
      expect(md, `${rule.id}.md lacks an example section`).toContain("## Example")
      expect(md).toContain(`spec/fixtures/invalid/${rule.id}-`)
    }
  })
})

describe("rule index", () => {
  it("lists and links every rule", () => {
    const index = readFileSync(`${ROOT}docs/rules/README.md`, "utf8")
    for (const rule of catalog.rules) {
      expect(index).toContain(`[${rule.id}]`)
      expect(index).toContain(`(${rule.id}.md)`)
      expect(index).toContain(rule.title)
    }
  })
})

describe("llms.txt", () => {
  it("exists and points at the docs an LLM needs", () => {
    const txt = readFileSync(`${ROOT}llms.txt`, "utf8")
    expect(txt.startsWith("# ag-ui-validate")).toBe(true)
    expect(txt).toContain("docs/rules/README.md")
    expect(txt).toContain("docs/spec-questions.md")
    for (const rule of catalog.rules) expect(txt).toContain(`docs/rules/${rule.id}.md`)
  })
})

describe("drift", () => {
  it("regenerating produces exactly what is on disk", async () => {
    const r = await new Promise<{ code: number; out: string }>((resolve, reject) => {
      const child = execFile(
        process.execPath,
        [`${ROOT}scripts/generate-rule-docs.mjs`, "--check"],
        { encoding: "utf8" },
        (error, stdout, stderr) =>
          resolve({ code: error ? 1 : 0, out: `${stdout}${stderr}` }),
      )
      child.on("error", reject)
    })
    expect(r.code, `docs drift:\n${r.out}`).toBe(0)
  })
})
