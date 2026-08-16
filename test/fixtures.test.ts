// The fixture runner: the corpus in fixtures/ is the test suite. Adding a
// rule means adding a fixture directory, not writing a test.
//
// Protocol (language-neutral, see fixtures/README.md): feed every non-empty
// line of the .jsonl as a RAW STRING (so malformed-JSON fixtures reach the
// parser), finalize, and deep-compare the report's diagnostics against
// expected.json.
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { EVENT_TABLE, createValidator } from "../src/index.js"
import type { Diagnostic, ValidatorOptions } from "../src/index.js"

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url))

function streamLines(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
}

function runFixture(lines: string[], options?: ValidatorOptions): Diagnostic[] {
  const v = createValidator(options)
  for (const line of lines) v.feed(line)
  v.finalize()
  return v.report().diagnostics
}

const validFiles = readdirSync(`${FIXTURES}valid`).filter((f) => f.endsWith(".jsonl"))
const invalidDirs = readdirSync(`${FIXTURES}invalid`)

describe("valid fixtures (false-positive guards)", () => {
  it.each(validFiles)("%s", (file) => {
    const lines = streamLines(`${FIXTURES}valid/${file}`)
    const expectedPath = `${FIXTURES}valid/${file.replace(/\.jsonl$/, ".expected.json")}`
    const expected: Diagnostic[] = existsSync(expectedPath)
      ? JSON.parse(readFileSync(expectedPath, "utf8"))
      : []
    expect(runFixture(lines)).toEqual(expected)
  })

  it("collectively exercise every core rule category", () => {
    const seen = new Set<string>()
    for (const file of validFiles) {
      for (const line of streamLines(`${FIXTURES}valid/${file}`)) {
        try {
          const type = (JSON.parse(line) as { type?: string }).type
          const spec = type !== undefined ? EVENT_TABLE[type] : undefined
          if (spec !== undefined) seen.add(spec.category)
        } catch {
          // valid fixtures contain only well-formed lines
        }
      }
    }
    for (const category of ["lifecycle", "text", "toolcall", "state", "reasoning", "special"]) {
      expect(seen, `no valid fixture exercises '${category}' events`).toContain(category)
    }
  })
})

describe("invalid fixtures (one per rule)", () => {
  it.each(invalidDirs)("%s", (dir) => {
    const base = `${FIXTURES}invalid/${dir}`
    const lines = streamLines(`${base}/stream.jsonl`)
    const expected: Diagnostic[] = JSON.parse(readFileSync(`${base}/expected.json`, "utf8"))
    const optionsPath = `${base}/options.json`
    const options: ValidatorOptions | undefined = existsSync(optionsPath)
      ? JSON.parse(readFileSync(optionsPath, "utf8"))
      : undefined
    const actual = runFixture(lines, options)
    expect(actual).toEqual(expected)
    // The directory's namesake rule must actually be among the findings.
    expect(actual.map((d) => d.rule)).toContain(dir.slice(0, 7))
  })
})
