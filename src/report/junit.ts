// JUnit XML output for CI systems. One testcase per finding: errors are
// <failure>, warnings and info are <skipped> (visible but not build-breaking —
// the exit code, not the XML, decides pass/fail). A clean report is a single
// passing testcase so the suite is never empty.
import type { Report } from "../types.js"

export interface JUnitOptions {
  /** Suite name — typically the validated target. */
  name: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function toJUnit(report: Report, opts: JUnitOptions): string {
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>']
  const suite = esc(opts.name)

  if (report.diagnostics.length === 0) {
    lines.push('<testsuites name="ag-ui-validate" tests="1" failures="0" errors="0" skipped="0">')
    lines.push(`  <testsuite name="${suite}" tests="1" failures="0" errors="0" skipped="0">`)
    lines.push(
      `    <testcase name="AG-UI conformance: no violations across ${report.eventCount} events" classname="${suite}"/>`,
    )
    lines.push("  </testsuite>")
    lines.push("</testsuites>")
    return `${lines.join("\n")}\n`
  }

  const failures = report.diagnostics.filter((d) => d.severity === "error").length
  const skipped = report.diagnostics.length - failures
  const counts = `tests="${report.diagnostics.length}" failures="${failures}" errors="0" skipped="${skipped}"`
  lines.push(`<testsuites name="ag-ui-validate" ${counts}>`)
  lines.push(`  <testsuite name="${suite}" ${counts}>`)
  for (const d of report.diagnostics) {
    const where = d.eventIndex >= 0 ? `event ${d.eventIndex}` : "stream"
    const name = esc(`${d.rule} (${where})`)
    lines.push(`    <testcase name="${name}" classname="${suite}">`)
    const body = `${esc(d.message)}\n${esc(d.specUrl)}`
    if (d.severity === "error") {
      lines.push(`      <failure message="${esc(d.message)}">${body}</failure>`)
    } else {
      lines.push(`      <skipped message="${esc(`${d.severity}: ${d.message}`)}">${body}</skipped>`)
    }
    lines.push("    </testcase>")
  }
  lines.push("  </testsuite>")
  lines.push("</testsuites>")
  return `${lines.join("\n")}\n`
}
