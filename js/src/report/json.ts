// Machine-readable report: the core Report plus tool identification, so a
// stored document is self-describing.
import { RULES } from "../rules/catalog.js"
import type { Diagnostic, Report } from "../types.js"

export interface JsonReportOptions {
  tool: { name: string; version: string }
  /** What was validated: URL, file path, or "stdin". */
  target?: string
}

export interface JsonDiagnostic extends Diagnostic {
  /** The rule's catalog category, e.g. "toolcall". Joined in from the catalog by rule id. */
  category?: string
}

export interface JsonReportDocument extends Omit<Report, "diagnostics"> {
  tool: { name: string; version: string }
  target?: string
  diagnostics: JsonDiagnostic[]
}

export function toJsonReport(report: Report, opts: JsonReportOptions): JsonReportDocument {
  const diagnostics: JsonDiagnostic[] = report.diagnostics.map((d) => {
    const category = RULES.get(d.rule)?.category
    return category === undefined ? { ...d } : { ...d, category }
  })
  const doc: JsonReportDocument = { tool: opts.tool, ...report, diagnostics }
  if (opts.target !== undefined) doc.target = opts.target
  return doc
}
