// End-to-end CLI tests: spawn the built binary against real fixture files.
// These run against dist/cli.js, so they are skipped (loudly) until `npm run build`.
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"

const run = promisify(execFile)
const CLI = new URL("../../../dist/cli.js", import.meta.url).pathname
const fixture = (p: string) => new URL(`../../../spec/fixtures/${p}`, import.meta.url).pathname

async function cli(args: string[], opts: { stdin?: string } = {}) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [CLI, ...args],
      { encoding: "utf8" },
      (error, stdout, stderr) => {
        const code = error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === "number"
          ? ((error as unknown as { code: number }).code)
          : error
            ? 1
            : 0
        resolve({ code, stdout, stderr })
      },
    )
    child.on("error", reject)
    if (opts.stdin !== undefined) {
      child.stdin!.end(opts.stdin)
    } else {
      child.stdin!.end()
    }
  })
}

describe.skipIf(!existsSync(CLI))("cli integration (dist/cli.js)", () => {
  it("invalid fixture exits 1 and names the rule", async () => {
    const r = await cli([fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl")])
    expect(r.code).toBe(1)
    expect(r.stdout).toContain("AGUI203")
  })

  it("valid fixture exits 0", async () => {
    const r = await cli([fixture("valid/agentic-chat.jsonl")])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain("no conformance violations")
  })

  it("reads from stdin with -", async () => {
    const { readFileSync } = await import("node:fs")
    const body = readFileSync(fixture("valid/agentic-chat.jsonl"), "utf8")
    const r = await cli(["-"], { stdin: body })
    expect(r.code).toBe(0)
  })

  it("--json prints a parseable report document", async () => {
    const r = await cli([fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--json"])
    expect(r.code).toBe(1)
    const doc = JSON.parse(r.stdout)
    expect(doc.tool.name).toBe("ag-ui-validate")
    expect(doc.diagnostics.some((d: { rule: string }) => d.rule === "AGUI203")).toBe(true)
  })

  it("--sarif prints a parseable SARIF log", async () => {
    const r = await cli([fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--sarif"])
    const doc = JSON.parse(r.stdout)
    expect(doc.version).toBe("2.1.0")
  })

  it("--off silences the only finding and exits 0", async () => {
    const r = await cli([fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--off", "AGUI203"])
    expect(r.code).toBe(0)
  })

  it("a missing file is a tool failure: exit 2", async () => {
    const r = await cli([fixture("does-not-exist.jsonl")])
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/no such file|cannot read|ENOENT/i)
  })

  it("bad flags exit 2 with usage on stderr", async () => {
    const r = await cli(["--frobnicate"])
    expect(r.code).toBe(2)
    expect(r.stderr).toMatch(/unknown/i)
  })

  it("--help exits 0 and prints usage", async () => {
    const r = await cli(["--help"])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain("ag-ui-validate")
    expect(r.stdout).toContain("--max-warnings")
  })

  it("--group collapses repeated findings but keeps totals correct", async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const dir = mkdtempSync(join(tmpdir(), "agui-group-"))
    try {
      // three empty deltas -> three AGUI105 warnings
      const events = [
        { type: "RUN_STARTED", threadId: "t", runId: "r", timestamp: 1 },
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", timestamp: 2 },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "", timestamp: 3 },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "", timestamp: 4 },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "", timestamp: 5 },
        { type: "TEXT_MESSAGE_END", messageId: "m1", timestamp: 6 },
        { type: "RUN_FINISHED", threadId: "t", runId: "r", timestamp: 7 },
      ]
      const file = join(dir, "dups.jsonl")
      writeFileSync(file, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`)
      const r = await cli([file, "--group"])
      expect(r.code).toBe(0)
      expect(r.stdout.split("AGUI105").length - 1).toBe(1) // one grouped line, not three
      expect(r.stdout).toContain("×3")
      expect(r.stdout).toContain("3 warnings") // summary totals unchanged
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("file-output flags write all requested formats in a single run", async () => {
    const { mkdtempSync, readFileSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const dir = mkdtempSync(join(tmpdir(), "agui-cli-"))
    try {
      const sarif = join(dir, "out.sarif")
      const junit = join(dir, "out.xml")
      const json = join(dir, "report.json")
      const r = await cli([
        fixture("invalid/AGUI203-unterminated-tool-call/stream.jsonl"),
        "--sarif-file", sarif,
        "--junit-file", junit,
        "--json-file", json,
      ])
      expect(r.code).toBe(1)
      expect(r.stdout).toContain("AGUI203") // stdout still pretty
      const sarifDoc = JSON.parse(readFileSync(sarif, "utf8"))
      expect(sarifDoc.version).toBe("2.1.0")
      expect(readFileSync(junit, "utf8")).toContain("<testsuites")
      const jsonDoc = JSON.parse(readFileSync(json, "utf8"))
      expect(jsonDoc.summary.errors).toBe(1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

if (!existsSync(CLI)) {
  describe("cli integration", () => {
    it("SKIPPED: run `npm run build` first to produce dist/cli.js", () => {
      expect(true).toBe(true)
    })
  })
}
