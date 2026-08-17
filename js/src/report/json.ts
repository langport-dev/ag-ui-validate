// Machine-readable report: the core Report plus tool identification, so a
// stored document is self-describing.
import type { Report } from "../types.js"

export interface JsonReportOptions {
  tool: { name: string; version: string }
  /** What was validated: URL, file path, or "stdin". */
  target?: string
}

export interface JsonReportDocument extends Report {
  tool: { name: string; version: string }
  target?: string
}

export function toJsonReport(report: Report, opts: JsonReportOptions): JsonReportDocument {
  const doc: JsonReportDocument = { tool: opts.tool, ...report }
  if (opts.target !== undefined) doc.target = opts.target
  return doc
}
