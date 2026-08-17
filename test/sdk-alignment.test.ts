// The corpus's notion of validity must match the protocol steward's: every
// event in a valid/ fixture parses with @ag-ui/core's own EventSchemas, and
// the schema-violation fixtures are rejected by the SDK for the same reason
// we flag them. (@ag-ui/core is a devDependency — test-only, never runtime.)
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as core from "@ag-ui/core"
import { describe, expect, it } from "vitest"

const FIXTURES = fileURLToPath(new URL("../spec/fixtures/", import.meta.url))

const lines = (path: string): string[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")

describe("valid corpus vs @ag-ui/core EventSchemas", () => {
  const files = readdirSync(`${FIXTURES}valid`).filter((f) => f.endsWith(".jsonl"))

  it.each(files)("every event in %s parses with the SDK", (file) => {
    for (const line of lines(`${FIXTURES}valid/${file}`)) {
      const result = core.EventSchemas.safeParse(JSON.parse(line))
      expect(
        result.success,
        `SDK rejects ${file}: ${line.slice(0, 80)} — ${result.success ? "" : result.error.issues[0]?.message}`,
      ).toBe(true)
    }
  })
})

describe("invalid corpus vs the SDK, where the violation is schema-level", () => {
  const eventAt = (dir: string, index: number): unknown =>
    JSON.parse(lines(`${FIXTURES}invalid/${dir}/stream.jsonl`)[index]!)

  it("AGUI504's offending event is rejected by the SDK too", () => {
    expect(core.EventSchemas.safeParse(eventAt("AGUI504-schema-violation", 1)).success).toBe(false)
  })

  it("AGUI503's unknown type is rejected by the SDK too", () => {
    expect(core.EventSchemas.safeParse(eventAt("AGUI503-unknown-event-type", 1)).success).toBe(false)
  })

  it("sequencing-only fixtures stay schema-clean per the SDK", () => {
    // These violate ordering rules, not schemas — the SDK must accept every
    // individual event, which is exactly why a validator has to exist.
    for (const dir of ["AGUI203-unterminated-tool-call", "AGUI104-duplicate-message-id"]) {
      for (const line of lines(`${FIXTURES}invalid/${dir}/stream.jsonl`)) {
        expect(core.EventSchemas.safeParse(JSON.parse(line)).success, `${dir}: ${line.slice(0, 60)}`).toBe(true)
      }
    }
  })
})
