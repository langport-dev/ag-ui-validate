// SARIF 2.1.0 output for code-scanning integrations (e.g. GitHub).
// Level mapping: error→error, warning→warning, info→note. When the input was a
// line-oriented file (JSONL/captured SSE fed line-per-event is not guaranteed,
// so only the caller knows), event N is reported at line N+1 via artifactUri.
import { RULES } from "../rules/catalog.js"
import type { Diagnostic, Report } from "../types.js"

export interface SarifOptions {
  toolVersion: string
  /** URI of the validated artifact; enables line-based locations. */
  artifactUri?: string
}

export type SarifLevel = "error" | "warning" | "note"

export interface SarifResult {
  ruleId: string
  level: SarifLevel
  message: { text: string }
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string }
      region: { startLine: number }
    }
  }>
}

export interface SarifLog {
  $schema: string
  version: "2.1.0"
  runs: Array<{
    tool: {
      driver: {
        name: string
        version: string
        informationUri: string
        rules: Array<{
          id: string
          helpUri: string
          shortDescription?: { text: string }
          defaultConfiguration?: { level: SarifLevel }
        }>
      }
    }
    results: SarifResult[]
  }>
}

const LEVEL: Record<Diagnostic["severity"], SarifLevel> = {
  error: "error",
  warning: "warning",
  info: "note",
}

type SarifRule = {
  id: string
  helpUri: string
  shortDescription?: { text: string }
  defaultConfiguration?: { level: SarifLevel }
}

export function toSarif(report: Report, opts: SarifOptions): SarifLog {
  const rules = new Map<string, SarifRule>()
  for (const d of report.diagnostics) {
    if (rules.has(d.rule)) continue
    const entry: SarifRule = { id: d.rule, helpUri: d.specUrl }
    const catalog = RULES.get(d.rule)
    if (catalog !== undefined) {
      entry.shortDescription = { text: catalog.title }
      entry.defaultConfiguration = { level: LEVEL[catalog.severity] }
    }
    rules.set(d.rule, entry)
  }

  const results: SarifResult[] = report.diagnostics.map((d) => ({
    ruleId: d.rule,
    level: LEVEL[d.severity],
    message: { text: d.message },
    locations:
      opts.artifactUri !== undefined && d.eventIndex >= 0
        ? [
            {
              physicalLocation: {
                artifactLocation: { uri: opts.artifactUri },
                region: { startLine: d.eventIndex + 1 },
              },
            },
          ]
        : [],
  }))

  return {
    $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ag-ui-validate",
            version: opts.toolVersion,
            informationUri: "https://github.com/langport-dev/ag-ui-validate",
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  }
}
