#!/usr/bin/env node
// Driver for the composite action. Reads INPUT_* env vars (set by action.yml),
// runs the ag-ui-validate CLI, mirrors its exit code, appends summary numbers
// to $GITHUB_OUTPUT, and renders a findings table into $GITHUB_STEP_SUMMARY.
import { spawnSync } from "node:child_process"
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const input = (name) => {
  const v = process.env[`INPUT_${name.toUpperCase().replace(/-/g, "_")}`]
  return v === undefined || v === "" ? undefined : v
}

const target = input("target")
if (target === undefined) {
  console.error("error: the 'target' input is required (URL, file path, or - for stdin)")
  process.exit(2)
}

// How to invoke the CLI, in order of precedence:
//  - AGUI_VALIDATE_CLI: explicit path to a cli.js (used by the test suite)
//  - version: local     — the dist/ build next to this action (repo self-test)
//  - version: <semver|latest> — the published package via npx
const version = input("version") ?? "latest"
let command
let baseArgs
if (process.env.AGUI_VALIDATE_CLI !== undefined && process.env.AGUI_VALIDATE_CLI !== "") {
  command = process.execPath
  baseArgs = [process.env.AGUI_VALIDATE_CLI]
} else if (version === "local") {
  command = process.execPath
  baseArgs = [fileURLToPath(new URL("../dist/cli.js", import.meta.url))]
} else {
  command = "npx"
  baseArgs = ["--yes", `ag-ui-validate@${version}`]
}

const workDir = mkdtempSync(join(tmpdir(), "ag-ui-validate-action-"))
const jsonFile = input("json-file") ?? join(workDir, "report.json")

const args = [...baseArgs, target, "--json-file", jsonFile]
const maxWarnings = input("max-warnings")
if (maxWarnings !== undefined) args.push("--max-warnings", maxWarnings)
const features = input("features")
if (features !== undefined) args.push("--features", features)
const timeout = input("timeout")
if (timeout !== undefined) args.push("--timeout", timeout)
const sarifFile = input("sarif-file")
if (sarifFile !== undefined) args.push("--sarif-file", sarifFile)
const junitFile = input("junit-file")
if (junitFile !== undefined) args.push("--junit-file", junitFile)
for (const rule of (input("rules") ?? "").split(/[\s,]+/).filter((r) => r !== "")) {
  args.push("--rule", rule)
}
for (const header of (input("headers") ?? "").split("\n").map((h) => h.trim()).filter((h) => h !== "")) {
  args.push("--header", header)
}

const result = spawnSync(command, args, { stdio: "inherit" })
const exitCode = result.status ?? 2

const appendTo = (envName, text) => {
  const path = process.env[envName]
  if (path !== undefined && path !== "") appendFileSync(path, text)
}

let report = null
try {
  report = JSON.parse(readFileSync(jsonFile, "utf8"))
} catch {
  // exit 2 before a report could be written (bad flags, unreachable target)
}

appendTo("GITHUB_OUTPUT", `exit-code=${exitCode}\n`)
if (report !== null) {
  const { errors, warnings, info } = report.summary
  appendTo("GITHUB_OUTPUT", `errors=${errors}\nwarnings=${warnings}\ninfo=${info}\n`)

  const md = ["## AG-UI conformance", "", `**Target:** \`${target}\``, ""]
  const count = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`
  if (report.diagnostics.length === 0) {
    md.push(`✅ No conformance violations across ${count(report.eventCount, "event")}.`)
  } else {
    md.push(`**${count(errors, "error")}, ${count(warnings, "warning")}, ${info} info** across ${count(report.eventCount, "event")}.`, "")
    md.push("| Rule | Severity | Event | Message |", "|---|---|---|---|")
    const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ")
    for (const d of report.diagnostics.slice(0, 50)) {
      const where = d.eventIndex >= 0 ? d.eventIndex : "—"
      md.push(`| [${d.rule}](${d.specUrl}) | ${d.severity} | ${where} | ${cell(d.message)} |`)
    }
    if (report.diagnostics.length > 50) {
      md.push("", `…and ${report.diagnostics.length - 50} more findings (see the log or report files).`)
    }
  }
  const exercised = Object.values(report.features).filter((s) => s === "exercised").length
  md.push("", `${exercised} of ${Object.keys(report.features).length} AG-UI features exercised.`, "")
  appendTo("GITHUB_STEP_SUMMARY", `${md.join("\n")}\n`)
}

rmSync(workDir, { recursive: true, force: true })
process.exit(exitCode)
