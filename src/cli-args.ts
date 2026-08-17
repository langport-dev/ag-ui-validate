// Pure CLI argument parsing — no Node APIs, so it obeys the core purity rules
// and tests without spawning processes. The Node-only entry lives in cli.ts.
import type { Severity } from "./types.js"

export type CliFormat = "pretty" | "json" | "sarif" | "junit"

export interface CliConfig {
  /** URL, file path, or "-" for stdin. Empty only with --help/--version. */
  target: string
  format: CliFormat
  /** true/false forced; null = auto-detect from TTY. */
  color: boolean | null
  maxWarnings?: number
  timeoutMs?: number
  /** Header names lowercased. */
  headers: Record<string, string>
  features?: string[]
  severityOverrides: Record<string, Severity | "off">
  /** Write these formats to files in the same run, whatever stdout shows. */
  sarifFile?: string
  junitFile?: string
  jsonFile?: string
  /** Pretty output only: one line per rule with a count, not one per finding. */
  group: boolean
  help: boolean
  version: boolean
}

export type ParseResult = { ok: true; config: CliConfig } | { ok: false; error: string }

export const USAGE = `ag-ui-validate — conformance validator for the AG-UI protocol

Usage:
  ag-ui-validate <url>            connect to a live endpoint and validate the stream
  ag-ui-validate <file>           validate a recorded stream (SSE capture or NDJSON/JSONL)
  ag-ui-validate -                read a recorded stream from stdin

Output (default: human-readable):
  --json                          machine-readable report on stdout
  --sarif                         SARIF 2.1.0 log on stdout (code scanning)
  --junit                         JUnit XML on stdout (CI test reports)
  --json-file <path>              additionally write the JSON report to a file
  --sarif-file <path>             additionally write a SARIF log to a file
  --junit-file <path>             additionally write JUnit XML to a file
  --group                         one line per rule with a count (large streams)
  --no-color                      disable ANSI colors

Rules:
  --rule AGUI###=<severity>       override a rule's severity (error|warning|info|off)
  --off AGUI###                   shorthand for --rule AGUI###=off
  --features <a,b,...>            declare exercised features (enables e.g. AGUI305)
  --max-warnings <n>              exit 1 when warnings exceed n

Endpoint options:
  --header "Name: value"          extra request header (repeatable)
  --timeout <seconds>             abort the request after this long

Exit codes: 0 clean, 1 findings at error level (or warnings over --max-warnings), 2 tool failure.
`

const SEVERITIES = new Set(["error", "warning", "info", "off"])
const RULE_ID = /^AGUI\d{3}$/

interface Flag {
  takesValue: boolean
  apply(config: CliConfig, value: string): string | null
}

const FLAGS: Record<string, Flag> = {
  "--help": { takesValue: false, apply: (c) => ((c.help = true), null) },
  "--version": { takesValue: false, apply: (c) => ((c.version = true), null) },
  "--no-color": { takesValue: false, apply: (c) => ((c.color = false), null) },
  "--group": { takesValue: false, apply: (c) => ((c.group = true), null) },
  "--json": { takesValue: false, apply: (c) => setFormat(c, "json") },
  "--sarif": { takesValue: false, apply: (c) => setFormat(c, "sarif") },
  "--junit": { takesValue: false, apply: (c) => setFormat(c, "junit") },
  "--off": {
    takesValue: true,
    apply: (c, v) => {
      if (!RULE_ID.test(v)) return `--off expects a rule ID like AGUI203, got '${v}'`
      c.severityOverrides[v] = "off"
      return null
    },
  },
  "--rule": {
    takesValue: true,
    apply: (c, v) => {
      const eq = v.indexOf("=")
      if (eq === -1) return `--rule expects ID=severity (e.g. AGUI105=warning), got '${v}'`
      const id = v.slice(0, eq)
      const severity = v.slice(eq + 1)
      if (!RULE_ID.test(id)) return `--rule expects a rule ID like AGUI105, got '${id}'`
      if (!SEVERITIES.has(severity)) {
        return `'${severity}' is not a severity; use error, warning, info, or off`
      }
      c.severityOverrides[id] = severity as Severity | "off"
      return null
    },
  },
  "--max-warnings": {
    takesValue: true,
    apply: (c, v) => {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0) return `--max-warnings expects a non-negative integer, got '${v}'`
      c.maxWarnings = n
      return null
    },
  },
  "--timeout": {
    takesValue: true,
    apply: (c, v) => {
      const n = Number(v)
      if (!Number.isFinite(n) || n <= 0) return `--timeout expects a positive number of seconds, got '${v}'`
      c.timeoutMs = Math.round(n * 1000)
      return null
    },
  },
  "--header": {
    takesValue: true,
    apply: (c, v) => {
      const colon = v.indexOf(":")
      if (colon <= 0) return `--header expects "Name: value", got '${v}'`
      c.headers[v.slice(0, colon).trim().toLowerCase()] = v.slice(colon + 1).trim()
      return null
    },
  },
  "--sarif-file": { takesValue: true, apply: (c, v) => ((c.sarifFile = v), null) },
  "--junit-file": { takesValue: true, apply: (c, v) => ((c.junitFile = v), null) },
  "--json-file": { takesValue: true, apply: (c, v) => ((c.jsonFile = v), null) },
  "--features": {
    takesValue: true,
    apply: (c, v) => {
      c.features = v
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f !== "")
      return null
    },
  },
}

function setFormat(c: CliConfig, format: CliFormat): string | null {
  if (c.format !== "pretty" && c.format !== format) {
    return `pick at most one of --json, --sarif, --junit`
  }
  c.format = format
  return null
}

export function parseCliArgs(argv: string[]): ParseResult {
  const config: CliConfig = {
    target: "",
    format: "pretty",
    color: null,
    headers: {},
    severityOverrides: {},
    group: false,
    help: false,
    version: false,
  }

  const targets: string[] = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!
    if (arg === "-" || !arg.startsWith("-")) {
      targets.push(arg)
      continue
    }
    let name = arg
    let inlineValue: string | null = null
    const eq = arg.indexOf("=")
    if (eq !== -1) {
      name = arg.slice(0, eq)
      inlineValue = arg.slice(eq + 1)
    }
    const flag = FLAGS[name]
    if (flag === undefined) return { ok: false, error: `unknown flag '${name}'` }
    let value = ""
    if (flag.takesValue) {
      if (inlineValue !== null) value = inlineValue
      else if (i + 1 < argv.length) value = argv[(i += 1)]!
      else return { ok: false, error: `${name} requires a value` }
    } else if (inlineValue !== null) {
      return { ok: false, error: `${name} does not take a value` }
    }
    const error = flag.apply(config, value)
    if (error !== null) return { ok: false, error }
  }

  if (config.group && config.format !== "pretty") {
    return {
      ok: false,
      error: "--group only applies to the default pretty output, not --json/--sarif/--junit",
    }
  }
  if (targets.length > 1) {
    return { ok: false, error: `expected exactly one target, got ${targets.length}` }
  }
  if (targets.length === 1) config.target = targets[0]!
  else if (!config.help && !config.version) {
    return { ok: false, error: "missing target: a URL, a file path, or - for stdin" }
  }
  return { ok: true, config }
}

export function decideExitCode(
  summary: { errors: number; warnings: number; info: number },
  maxWarnings?: number,
): 0 | 1 {
  if (summary.errors > 0) return 1
  if (maxWarnings !== undefined && summary.warnings > maxWarnings) return 1
  return 0
}
