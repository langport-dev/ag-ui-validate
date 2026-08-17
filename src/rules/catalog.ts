// Typed loader for the rule catalog. The catalog itself is data
// (catalog.json) so other implementations can share it; this module gives it
// types and validates its invariants once at load time.
//
// Note the asymmetry: the validator never throws on stream input, but a
// malformed catalog is a programming error in this package, so the loader
// throws loudly at import time.

import catalogJson from "../../spec/catalog.json"

export type Severity = "error" | "warning" | "info"
export type SeverityOrOff = Severity | "off"

const SEVERITIES: readonly string[] = ["error", "warning", "info"]
const LAYERS: readonly string[] = ["core", "transport"]

export interface RuleDefinition {
  /** e.g. "AGUI203" */
  id: string
  severity: Severity
  title: string
  /** Human template with {placeholder} slots filled per diagnostic. */
  messageTemplate: string
  /** Governing spec section. Mandatory: rules that cannot cite one don't ship. */
  specUrl: string
  /** Exact sentence from the spec section, where one exists. */
  specQuote?: string
  since: string
  /** Canonical AG-UI feature this rule relates to, if any. */
  feature?: string
  /** True when the rule only fires if opts.features declares `feature`. */
  requiresFeature?: boolean
  /** Cross-reference into docs/spec-questions.md for downgraded/ambiguous rules. */
  specQuestion?: string
  /** Where the rule is evaluated. Transport rules are skipped (and the skip
   * reported) when validating recorded input with no transport in play. */
  checkedIn: "core" | "transport"
}

export interface Catalog {
  catalogVersion: string
  spec: string
  rules: readonly RuleDefinition[]
}

/** Validates catalog data and returns it typed. Throws on structural problems. */
export function validateCatalog(data: unknown): Catalog {
  const problems: string[] = []
  const cat = data as Catalog
  if (typeof cat !== "object" || cat === null || !Array.isArray(cat.rules)) {
    throw new Error("rule catalog: expected an object with a rules array")
  }
  const seen = new Set<string>()
  for (const rule of cat.rules) {
    const where = rule?.id ?? "<missing id>"
    if (!/^AGUI\d{3}$/.test(rule.id ?? "")) problems.push(`${where}: id must match AGUI###`)
    if (seen.has(rule.id)) problems.push(`${where}: duplicate id`)
    seen.add(rule.id)
    if (!SEVERITIES.includes(rule.severity)) problems.push(`${where}: bad severity '${rule.severity}'`)
    if (!rule.title) problems.push(`${where}: missing title`)
    if (!rule.messageTemplate) problems.push(`${where}: missing messageTemplate`)
    if (!rule.specUrl?.startsWith("https://")) problems.push(`${where}: specUrl must be an https URL`)
    if (!rule.since) problems.push(`${where}: missing since`)
    if (!LAYERS.includes(rule.checkedIn)) problems.push(`${where}: bad checkedIn '${rule.checkedIn}'`)
    if (rule.requiresFeature && !rule.feature) problems.push(`${where}: requiresFeature without feature`)
  }
  if (problems.length > 0) {
    throw new Error(`rule catalog is invalid:\n  ${problems.join("\n  ")}`)
  }
  return cat
}

export const CATALOG: Catalog = validateCatalog(catalogJson)

export const RULES: ReadonlyMap<string, RuleDefinition> = new Map(
  CATALOG.rules.map((r) => [r.id, r]),
)

/** Fills a rule's messageTemplate. Unknown placeholders are left intact. */
export function formatMessage(rule: RuleDefinition, params: Record<string, unknown>): string {
  return rule.messageTemplate.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  )
}
