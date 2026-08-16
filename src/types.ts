import type { Severity, SeverityOrOff } from "./rules/catalog.js"

export type { Severity, SeverityOrOff }

/** A single conformance finding. */
export interface Diagnostic {
  /** Rule ID, e.g. "AGUI203". */
  rule: string
  severity: Severity
  /** Human-readable, includes the offending id/value. */
  message: string
  /**
   * 0-based position in the stream of the event this diagnostic is about.
   * Stream-level diagnostics (e.g. AGUI902) use -1.
   */
  eventIndex: number
  /** The event's declared type, if parseable. */
  eventType?: string
  /** RFC 6901 JSON pointer into the event, e.g. "/toolCallId". */
  pointer?: string
  /** e.g. the unterminated TOOL_CALL_START this refers back to. */
  relatedEventIndex?: number
  /** Link to the governing spec section. Always populated. */
  specUrl: string
}

/** The seven canonical AG-UI features (from the AG-UI Dojo). */
export type CanonicalFeature =
  | "agentic-chat"
  | "backend-tool-rendering"
  | "human-in-the-loop"
  | "agentic-generative-ui"
  | "tool-based-generative-ui"
  | "shared-state"
  | "predictive-state-updates"

export const CANONICAL_FEATURES: readonly CanonicalFeature[] = [
  "agentic-chat",
  "backend-tool-rendering",
  "human-in-the-loop",
  "agentic-generative-ui",
  "tool-based-generative-ui",
  "shared-state",
  "predictive-state-updates",
]

/**
 * Feature-matrix status. Capability discovery (getCapabilities()) is
 * out-of-band and invisible to a passive stream observer, so this matrix is
 * inferred from observed events; features whose exercise cannot be
 * distinguished passively are "not-inferable". See docs/spec-questions.md SQ-13.
 */
export type FeatureStatus = "exercised" | "not-exercised" | "not-inferable"

export type FeatureMatrix = Record<CanonicalFeature, FeatureStatus>

export interface Summary {
  errors: number
  warnings: number
  info: number
}

export interface SkippedRule {
  rule: string
  reason: string
}

export interface Report {
  diagnostics: Diagnostic[]
  summary: Summary
  features: FeatureMatrix
  /**
   * Rules that were not evaluated in this mode and why — e.g. transport rules
   * when validating recorded input. Skips are reported, never silent.
   */
  skipped: SkippedRule[]
  eventCount: number
  /**
   * Unexpected internal validator errors. The validator never throws on any
   * input; if a check itself crashes, the message lands here instead.
   */
  internalErrors: string[]
}

export type ValidationLayer = "core" | "transport"

export interface ValidatorOptions {
  /** Pins the rule set to a spec version. Only "0.x" exists today. */
  spec?: "0.x"
  /**
   * Declared features. Enables feature-conditional rules (e.g. AGUI305 fires
   * only when "shared-state" is declared).
   */
  features?: string[]
  /** Per-rule severity overrides; "off" disables a rule. */
  severityOverrides?: Record<string, SeverityOrOff>
  /**
   * Which rule layers are being evaluated. "core" is always on. Wrapping
   * layers that check transport rules (via emitExternal) declare "transport"
   * so those rules stop being reported as skipped. Default: ["core"].
   */
  layers?: ValidationLayer[]
}

export interface Validator {
  /**
   * Feed one event — a parsed object, or a raw JSON string (malformed JSON is
   * a diagnostic, not an exception). Returns diagnostics detectable at this
   * event, in stream order. Never throws.
   */
  feed(event: unknown): Diagnostic[]
  /**
   * End-of-stream checks (unterminated tool calls, missing RUN_FINISHED, …).
   * Idempotent: second and later calls return []. Never throws.
   */
  finalize(): Diagnostic[]
  /** Cumulative report over everything fed so far. Never throws. */
  report(): Report
  /**
   * For wrapping layers (transport, CLI): report a layer-checked rule through
   * the same catalog formatting, severity overrides, and summary as core
   * diagnostics. Returns the diagnostic, or null when the rule is unknown
   * (recorded in internalErrors) or overridden off. Never throws.
   */
  emitExternal(
    rule: string,
    params?: Record<string, unknown>,
    extra?: { eventIndex?: number; pointer?: string; relatedEventIndex?: number },
  ): Diagnostic | null
}
