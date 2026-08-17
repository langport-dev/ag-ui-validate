#!/usr/bin/env node
// Generates docs/rules/*.md (one page per rule), docs/rules/README.md (the
// index), and llms.txt from src/rules/catalog.json + the fixture corpus.
// Deterministic: same inputs, byte-identical output. `--check` regenerates in
// memory and fails on any drift, so the pages can never fall out of sync with
// the catalog (test/docs.test.ts runs it in CI).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const catalog = JSON.parse(readFileSync(join(ROOT, "src/rules/catalog.json"), "utf8"))

const GROUPS = {
  0: "Lifecycle",
  1: "Text messages",
  2: "Tool calls",
  3: "State",
  4: "Reasoning",
  5: "Transport",
  9: "Protocol hygiene",
}
const groupOf = (id) => GROUPS[Number(id[4])] ?? "Other"

const fixtureDirs = readdirSync(join(ROOT, "fixtures/invalid"))
const fixtureFor = (id) => {
  const dir = fixtureDirs.find((d) => d.startsWith(`${id}-`))
  if (dir === undefined) throw new Error(`no fixture directory for ${id}`)
  return dir
}

const MAX_EXAMPLE_LINES = 30

function exampleSection(rule) {
  const dir = fixtureFor(rule.id)
  const base = join(ROOT, "fixtures/invalid", dir)
  const files = readdirSync(base)
  const lines = [`## Example`, ""]
  if (files.includes("stream.jsonl")) {
    lines.push(
      `A violating stream from the corpus ([\`fixtures/invalid/${dir}\`](../../fixtures/invalid/${dir})):`,
      "",
      "```jsonl",
    )
    const stream = readFileSync(join(base, "stream.jsonl"), "utf8").trimEnd().split("\n")
    lines.push(...stream.slice(0, MAX_EXAMPLE_LINES))
    if (stream.length > MAX_EXAMPLE_LINES) {
      lines.push(`… (${stream.length - MAX_EXAMPLE_LINES} more events)`)
    }
    lines.push("```")
  } else {
    lines.push(
      `This rule is checked at the transport layer, so its fixture is a timed`,
      `HTTP replay rather than a bare stream — see`,
      `[\`fixtures/invalid/${dir}\`](../../fixtures/invalid/${dir}) and the replay`,
      `protocol in [fixtures/README.md](../../fixtures/README.md):`,
      "",
      "```json",
      readFileSync(join(base, "scenario.json"), "utf8").trimEnd(),
      "```",
    )
  }
  const expected = JSON.parse(readFileSync(join(base, "expected.json"), "utf8"))
  lines.push("", "Expected findings:", "")
  for (const f of expected) {
    const where = f.eventIndex >= 0 ? `event ${f.eventIndex}` : "stream"
    lines.push(`- \`${f.severity}\` ${f.rule} at ${where} — ${f.message}`)
  }
  return lines
}

function rulePage(rule) {
  const lines = [
    `# ${rule.id} — ${rule.title}`,
    "",
    "<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.",
    "     Do not edit by hand; run `npm run docs:generate`. -->",
    "",
    `**Severity:** ${rule.severity} · **Group:** ${groupOf(rule.id)} · **Checked in:** ${rule.checkedIn} · **Since:** ${rule.since}`,
    "",
    `**Message:** \`${rule.messageTemplate}\``,
    "",
    "## Spec grounding",
    "",
    ...(rule.specQuote !== undefined
      ? [`> ${rule.specQuote}`]
      : [
          "The spec has no single quotable sentence for this behavior; the rule",
          "is grounded in the linked section as a whole.",
        ]),
    "",
    `Source: <${rule.specUrl}>`,
  ]
  if (rule.specQuestion !== undefined) {
    lines.push(
      "",
      `The spec is not fully explicit here; the ambiguity is tracked as`,
      `[${rule.specQuestion}](../spec-questions.md) and the severity is capped`,
      `accordingly (false positives are worse than false negatives).`,
    )
  }
  if (rule.requiresFeature !== undefined) {
    lines.push(
      "",
      `Only evaluated when the \`${rule.requiresFeature}\` feature is declared`,
      `(\`--features ${rule.requiresFeature}\` on the CLI, \`features: ["${rule.requiresFeature}"]\` in code);`,
      `otherwise it is reported as skipped.`,
    )
  }
  lines.push("", ...exampleSection(rule), "")
  return lines.join("\n")
}

function index() {
  const lines = [
    "# Rule index",
    "",
    "<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.",
    "     Do not edit by hand; run `npm run docs:generate`. -->",
    "",
    `All ${catalog.rules.length} conformance rules, grouped by the part of the`,
    "protocol they guard. Every diagnostic links to the spec section it is",
    "grounded in; ambiguous spec behavior is capped at `info` severity and",
    "tracked in [spec-questions.md](../spec-questions.md).",
    "",
  ]
  for (const groupName of Object.values(GROUPS)) {
    const rules = catalog.rules.filter((r) => groupOf(r.id) === groupName)
    if (rules.length === 0) continue
    lines.push(`## ${groupName}`, "", "| Rule | Severity | Layer | Title |", "|---|---|---|---|")
    for (const r of rules) {
      lines.push(`| [${r.id}](${r.id}.md) | ${r.severity} | ${r.checkedIn} | ${r.title} |`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

function llmsTxt() {
  const lines = [
    "# ag-ui-validate",
    "",
    "> Conformance validator for the AG-UI protocol (https://docs.ag-ui.com).",
    "> Feed it an event stream or endpoint; every violation comes back with a",
    "> rule ID, a severity, and a link to the governing spec section. The core",
    "> is a pure function with zero runtime dependencies; transport (SSE and",
    "> NDJSON clients), a CLI, a Vitest matcher, and a GitHub Action wrap it.",
    "",
    "## Docs",
    "",
    "- [README](README.md): install, CLI, API, and CI quickstarts",
    "- [Rule index](docs/rules/README.md): all rules by group with severities",
    "- [Spec questions](docs/spec-questions.md): tracked ambiguities in the AG-UI spec",
    "- [Testing guide](docs/TESTING.md): how every layer is verified",
    "- [Fixture corpus](fixtures/README.md): language-neutral valid/invalid streams and the replay protocol",
    "",
    "## Rules",
    "",
  ]
  for (const r of catalog.rules) {
    lines.push(`- [${r.id} — ${r.title}](docs/rules/${r.id}.md)`)
  }
  lines.push("")
  return lines.join("\n")
}

const files = new Map()
for (const rule of catalog.rules) files.set(`docs/rules/${rule.id}.md`, rulePage(rule))
files.set("docs/rules/README.md", index())
files.set("llms.txt", llmsTxt())

if (process.argv.includes("--check")) {
  const drifted = []
  for (const [rel, content] of files) {
    let onDisk = null
    try {
      onDisk = readFileSync(join(ROOT, rel), "utf8")
    } catch {
      // missing counts as drift
    }
    if (onDisk !== content) drifted.push(rel)
  }
  // Stray hand-written rule pages are drift too.
  let stray = []
  try {
    stray = readdirSync(join(ROOT, "docs/rules")).filter(
      (f) => f.endsWith(".md") && !files.has(`docs/rules/${f}`),
    )
  } catch {
    // docs/rules missing entirely — already reported above
  }
  if (drifted.length > 0 || stray.length > 0) {
    for (const f of drifted) console.error(`drift: ${f} differs from generated output`)
    for (const f of stray) console.error(`drift: docs/rules/${f} is not a generated page`)
    console.error("run `npm run docs:generate` and commit the result")
    process.exit(1)
  }
  console.log(`rule docs in sync: ${files.size} generated files match disk`)
} else {
  mkdirSync(join(ROOT, "docs/rules"), { recursive: true })
  for (const [rel, content] of files) writeFileSync(join(ROOT, rel), content)
  console.log(`wrote ${files.size} files (${catalog.rules.length} rule pages + index + llms.txt)`)
}
