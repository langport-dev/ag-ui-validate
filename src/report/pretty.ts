// Human-readable output. Pure string formatting — the CLI decides where it
// goes and whether a TTY wants color.
import { RULES } from "../rules/catalog.js"
import type { Diagnostic, Report, Severity } from "../types.js"

export interface PrettyOptions {
  color: boolean
}

const SYMBOL: Record<Severity, string> = { error: "✖", warning: "⚠", info: "ℹ" }
const SGR: Record<Severity, string> = { error: "31", warning: "33", info: "36" }

function paint(code: string, s: string, on: boolean): string {
  return on ? `\x1b[${code}m${s}\x1b[0m` : s
}

export function formatDiagnosticLine(d: Diagnostic, opts: PrettyOptions): string {
  const where = d.eventIndex >= 0 ? `event ${d.eventIndex}` : "—"
  const head = paint(SGR[d.severity], `${SYMBOL[d.severity]} ${d.rule}`, opts.color)
  const meta = paint("2", `${d.severity.padEnd(7)} ${where.padEnd(10)}`, opts.color)
  const cite = paint("2", `  ↳ ${d.specUrl}`, opts.color)
  return `${head}  ${meta} ${d.message}\n${cite}`
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
const SAMPLE_INDEXES = 3

/**
 * One line per rule instead of one per occurrence — for large streams where
 * the same violation repeats. Totals stay honest in the summary; this only
 * changes what is listed.
 */
export function formatGroupedDiagnostics(diagnostics: Diagnostic[], opts: PrettyOptions): string {
  const groups = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const list = groups.get(d.rule)
    if (list === undefined) groups.set(d.rule, [d])
    else list.push(d)
  }

  const sorted = [...groups.values()].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a[0]!.severity] - SEVERITY_RANK[b[0]!.severity]
    return bySeverity !== 0 ? bySeverity : a[0]!.rule.localeCompare(b[0]!.rule)
  })

  const lines: string[] = []
  for (const group of sorted) {
    const first = group[0]!
    const title = RULES.get(first.rule)?.title ?? first.message
    const indexes = group.map((d) => d.eventIndex).filter((i) => i >= 0)
    let where: string
    if (indexes.length === 0) {
      where = "stream-level"
    } else {
      const sample = indexes.slice(0, SAMPLE_INDEXES).join(", ")
      const rest = indexes.length - SAMPLE_INDEXES
      where = `events ${sample}${rest > 0 ? ` (+${rest} more)` : ""}`
    }
    const head = paint(SGR[first.severity], `${SYMBOL[first.severity]} ${first.rule}`, opts.color)
    const meta = paint("2", `${first.severity.padEnd(7)} ×${group.length}`, opts.color)
    const cite = paint("2", `  ↳ ${first.specUrl}`, opts.color)
    lines.push(`${head}  ${meta}  ${title} — ${where}`, cite)
  }
  return lines.join("\n")
}

export function formatReportSummary(report: Report, opts: PrettyOptions): string {
  const { errors, warnings, info } = report.summary
  const lines: string[] = []

  if (errors + warnings + info === 0) {
    lines.push(
      paint("32", `✔ no conformance violations across ${count(report.eventCount, "event")}`, opts.color),
    )
  } else {
    lines.push(
      `${count(errors, "error")}, ${count(warnings, "warning")}, ${info} info across ${count(report.eventCount, "event")}`,
    )
  }

  const features = Object.entries(report.features)
  const exercised = features.filter(([, s]) => s === "exercised").map(([f]) => f)
  const suffix = exercised.length > 0 ? `: ${exercised.join(", ")}` : ""
  lines.push(`${exercised.length} of ${features.length} AG-UI features exercised${suffix}`)

  if (report.skipped.length > 0) {
    lines.push(`${count(report.skipped.length, "rule")} not evaluated:`)
    for (const s of report.skipped) {
      lines.push(paint("2", `  – ${s.rule}: ${s.reason}`, opts.color))
    }
  }

  for (const e of report.internalErrors) {
    lines.push(paint("31", `! internal validator error: ${e}`, opts.color))
  }

  return lines.join("\n")
}
