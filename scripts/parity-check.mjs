#!/usr/bin/env node
// Runs every non-transport-scenario fixture in spec/fixtures/ through BOTH
// shipped CLIs — the built dist/cli.js and the installed `ag-ui-validate`
// Python console script — with --json, and deep-diffs their `diagnostics`
// arrays. This is stronger than "both language's own fixture test suite is
// green": it exercises the actual packaging/CLI-wiring path (argument
// parsing, reporter formatting, exit codes), not just each language's
// internal validator call. See docs/PYTHON-PORT-PLAN.md §5.
//
// Scope: spec/fixtures/valid/*.jsonl and spec/fixtures/invalid/*/stream.jsonl
// only. The 5 transport-scenario fixtures (spec/fixtures/invalid/AGUI50*/
// scenario.json) need timed byte-chunk replay with an injected clock, which
// neither shipped CLI exposes as a flag — those stay covered by each
// language's own fixtures.test.ts / test_fixtures.py instead, not this job.
//
// Known, permanent exceptions (also documented in spec/fixtures/README.md
// and py/tests/test_fixtures.py): AGUI204/AGUI502's message embeds the
// native JSON parser's own error text (V8 vs Python's json module);
// AGUI503's message embeds {sdkVersion}, independently versioned per SDK.
// Both are excluded from the message comparison only — every other field
// still compares exactly.
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const FIXTURES = `${ROOT}/spec/fixtures`
const TS_CLI = `${ROOT}/dist/cli.js`

const TOLERATE_MESSAGE = new Set(["AGUI204", "AGUI502", "AGUI503"])
const KNOWN_OPTION_KEYS = new Set(["features", "severityOverrides"])

function runCli(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" })
  } catch (e) {
    // Both CLIs exit 1 on findings — that's expected; we still want stdout.
    if (e.stdout !== undefined) return e.stdout
    throw e
  }
}

function optionArgs(optionsPath) {
  if (!existsSync(optionsPath)) return []
  const opts = JSON.parse(readFileSync(optionsPath, "utf8"))
  for (const key of Object.keys(opts)) {
    if (!KNOWN_OPTION_KEYS.has(key)) {
      console.warn(
        `warning: ${optionsPath} has unsupported key '${key}' for the CLI-diff — neither CLI ` +
          "exposes a flag for it, so this fixture's diff may not reflect that option",
      )
    }
  }
  const args = []
  if (opts.features !== undefined) args.push("--features", opts.features.join(","))
  if (opts.severityOverrides !== undefined) {
    for (const [id, severity] of Object.entries(opts.severityOverrides)) {
      args.push("--rule", `${id}=${severity}`)
    }
  }
  return args
}

// Canonical, key-order-independent JSON: object keys are sorted
// recursively before stringifying, so field insertion-order differences
// between the two languages' JSON serializers never register as a diff.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value)
}

function normalize(d) {
  if (!TOLERATE_MESSAGE.has(d.rule)) return d
  const { message, ...rest } = d
  return rest
}

function diff(tsDiags, pyDiags) {
  if (tsDiags.length !== pyDiags.length) {
    return [`diagnostics length differs: TS=${tsDiags.length} Python=${pyDiags.length}`]
  }
  const problems = []
  for (let i = 0; i < tsDiags.length; i += 1) {
    const a = canonicalJson(normalize(tsDiags[i]))
    const b = canonicalJson(normalize(pyDiags[i]))
    if (a !== b) problems.push(`diagnostic[${i}]: TS=${a} / Python=${b}`)
  }
  return problems
}

function checkFixture(label, streamPath, extraArgs) {
  const tsOut = runCli(process.execPath, [TS_CLI, streamPath, "--json", ...extraArgs])
  const pyOut = runCli("ag-ui-validate", [streamPath, "--json", ...extraArgs])
  const tsDiags = JSON.parse(tsOut).diagnostics
  const pyDiags = JSON.parse(pyOut).diagnostics
  return { fixture: label, problems: diff(tsDiags, pyDiags) }
}

const rows = []

for (const file of readdirSync(`${FIXTURES}/valid`).filter((f) => f.endsWith(".jsonl"))) {
  rows.push(checkFixture(`valid/${file}`, `${FIXTURES}/valid/${file}`, []))
}

let skipped = 0
for (const dir of readdirSync(`${FIXTURES}/invalid`)) {
  const base = `${FIXTURES}/invalid/${dir}`
  if (existsSync(`${base}/scenario.json`)) {
    skipped += 1
    continue // out of scope — see the file header
  }
  const args = optionArgs(`${base}/options.json`)
  rows.push(checkFixture(`invalid/${dir}`, `${base}/stream.jsonl`, args))
}

const failing = rows.filter((r) => r.problems.length > 0)

const lines = ["## Parity CI: TS vs Python CLI diagnostics diff", ""]
lines.push(
  `Checked ${rows.length} fixtures against both shipped CLIs (${skipped} transport-scenario ` +
    "fixtures excluded — see the workflow/script header for why).",
)
lines.push("")
if (failing.length === 0) {
  lines.push(`✅ All ${rows.length} fixtures match between the two shipped CLIs.`)
} else {
  lines.push(`❌ ${failing.length} of ${rows.length} fixtures diverged:`, "")
  lines.push("| Fixture | Divergence |", "|---|---|")
  for (const row of failing) {
    const cell = row.problems.join("<br>").replace(/\|/g, "\\|")
    lines.push(`| \`${row.fixture}\` | ${cell} |`)
  }
}
const summary = lines.join("\n")
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
}

process.exit(failing.length > 0 ? 1 : 0)
