// The matcher itself is framework-agnostic and pure: it takes the received
// value and options, runs the core validator, and returns {pass, message}.
// vitest/index.ts registers it with expect.extend; Jest users can do the same.
import { decideExitCode } from "../cli-args.js"
import { createValidator } from "../index.js"
import { formatDiagnosticLine } from "../report/pretty.js"
import type { SeverityOrOff, ValidatorOptions } from "../types.js"

export interface ToBeValidAGUIOptions {
  /** Declared features (enables feature-conditional rules, e.g. AGUI305). */
  features?: string[]
  /** Per-rule severity overrides; "off" disables a rule. */
  severityOverrides?: Record<string, SeverityOrOff>
  /** Fail when warning-severity findings exceed this budget. */
  maxWarnings?: number
}

export interface MatcherResult {
  pass: boolean
  message: () => string
}

export function toBeValidAGUI(
  received: unknown,
  options: ToBeValidAGUIOptions = {},
): MatcherResult {
  let events: unknown[]
  if (typeof received === "string") {
    // A JSONL/NDJSON capture: one event per non-empty line.
    events = received.split(/\r?\n/).filter((line) => line.trim() !== "")
  } else if (Array.isArray(received)) {
    events = received
  } else {
    throw new TypeError(
      `toBeValidAGUI expects an array of events (objects or JSON strings) or a JSONL string; ` +
        `received ${received === null ? "null" : typeof received}. Wrap a single event in an array.`,
    )
  }

  const validatorOptions: ValidatorOptions = {}
  if (options.features !== undefined) validatorOptions.features = options.features
  if (options.severityOverrides !== undefined) {
    validatorOptions.severityOverrides = options.severityOverrides
  }

  const v = createValidator(validatorOptions)
  for (const e of events) v.feed(e)
  v.finalize()
  const report = v.report()
  const { errors, warnings, info } = report.summary
  const pass = decideExitCode(report.summary, options.maxWarnings) === 0

  return {
    pass,
    message: (): string => {
      if (pass) {
        return (
          `expected the stream to violate AG-UI conformance, but it is valid: ` +
          `${report.eventCount} events, ${errors} errors, ${warnings} warnings, ${info} info`
        )
      }
      const lines: string[] = []
      if (errors > 0) {
        lines.push(`expected a valid AG-UI stream, but found ${errors} error-severity finding${errors === 1 ? "" : "s"}:`)
      } else {
        lines.push(
          `expected a valid AG-UI stream, but ${warnings} warning${warnings === 1 ? "" : "s"} exceed maxWarnings: ${options.maxWarnings}:`,
        )
      }
      for (const d of report.diagnostics) {
        if (d.severity === "info") continue
        lines.push(formatDiagnosticLine(d, { color: false }))
      }
      return lines.join("\n")
    },
  }
}
