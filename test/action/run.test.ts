// The GitHub Action driver (action/run.mjs) tested the way GitHub runs it:
// inputs as INPUT_* env vars, outputs appended to $GITHUB_OUTPUT, markdown to
// $GITHUB_STEP_SUMMARY. AGUI_VALIDATE_CLI points it at the local build, which
// is also what `version: local` does in CI.
import { execFile } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const CLI = new URL("../../dist/cli.js", import.meta.url).pathname
const RUN_MJS = new URL("../../action/run.mjs", import.meta.url).pathname
const fixture = (p: string) => new URL(`../../spec/fixtures/${p}`, import.meta.url).pathname

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "agui-action-"))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function runAction(inputs: Record<string, string>) {
  const output = join(dir, "github_output")
  const summary = join(dir, "github_step_summary")
  writeFileSync(output, "")
  writeFileSync(summary, "")
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    AGUI_VALIDATE_CLI: CLI,
    GITHUB_OUTPUT: output,
    GITHUB_STEP_SUMMARY: summary,
  }
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase().replace(/-/g, "_")}`] = v
  return new Promise<{ code: number; stdout: string; stderr: string; output: string; summary: string }>(
    (resolve, reject) => {
      const child = execFile(process.execPath, [RUN_MJS], { encoding: "utf8", env }, (error, stdout, stderr) => {
        const code = error ? ((error as unknown as { code?: number }).code ?? 1) : 0
        resolve({
          code: typeof code === "number" ? code : 1,
          stdout,
          stderr,
          output: readFileSync(output, "utf8"),
          summary: readFileSync(summary, "utf8"),
        })
      })
      child.on("error", reject)
    },
  )
}

describe.skipIf(!existsSync(CLI))("action/run.mjs", () => {
  it("fails the step on a violating stream and reports outputs", async () => {
    const r = await runAction({ target: fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl") })
    expect(r.code).toBe(1)
    expect(r.output).toContain("errors=1")
    expect(r.output).toMatch(/exit-code=1/)
    expect(r.summary).toContain("AGUI203")
    expect(r.summary).toContain("docs.ag-ui.com") // spec link in the job summary
  })

  it("passes on a clean stream with zeroed outputs", async () => {
    const r = await runAction({ target: fixture("valid/agentic-chat.jsonl") })
    expect(r.code).toBe(0)
    expect(r.output).toContain("errors=0")
    expect(r.summary.toLowerCase()).toContain("no conformance violations")
  })

  it("writes a SARIF file when asked", async () => {
    const sarif = join(dir, "agui.sarif")
    const r = await runAction({
      target: fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"),
      "sarif-file": sarif,
    })
    expect(r.code).toBe(1)
    const doc = JSON.parse(readFileSync(sarif, "utf8"))
    expect(doc.version).toBe("2.1.0")
  })

  it("forwards rule overrides and max-warnings", async () => {
    const ok = await runAction({
      target: fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"),
      rules: "AGUI203=off",
    })
    expect(ok.code).toBe(0)
    const budget = await runAction({
      target: fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"),
      rules: "AGUI203=warning",
      "max-warnings": "0",
    })
    expect(budget.code).toBe(1)
  })

  it("a missing target is a hard failure (exit 2), not a finding", async () => {
    const r = await runAction({ target: fixture("does-not-exist.jsonl") })
    expect(r.code).toBe(2)
  })
})

if (!existsSync(CLI)) {
  describe("action/run.mjs", () => {
    it("SKIPPED: run `npm run build` first to produce dist/cli.js", () => {
      expect(true).toBe(true)
    })
  })
}
