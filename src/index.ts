// ag-ui-validate core: a pure function over an AG-UI event sequence.
// Zero I/O, zero runtime dependencies, isomorphic. Transports, the CLI, and
// the Vitest matcher are thin wrappers over this module.
//
// Two invariants hold everywhere here:
//   - the validator NEVER throws on input: broken input is its input;
//   - every diagnostic cites the spec section that governs it (specUrl).

import { DRAFT_EVENT_TYPES, EVENT_TABLE, EVENT_TYPES, SDK_VERSION } from "./protocol/event-table.js"
import type { EventSpec } from "./protocol/event-table.js"
import { RULES, formatMessage } from "./rules/catalog.js"
import type { CheckApi, EmitFn, RunState, StreamState } from "./rules/checks/context.js"
import { newRunState, str } from "./rules/checks/context.js"
import { checkRunIdStability, endOfRunSteps, handleStepEvent } from "./rules/checks/lifecycle.js"
import { closeReasoningChunk, endOfRunReasoning, handleReasoningEvent } from "./rules/checks/reasoning.js"
import { handleStateEvent } from "./rules/checks/state.js"
import { closeTextChunk, endOfRunText, handleTextEvent } from "./rules/checks/text.js"
import { closeToolChunk, endOfRunToolCalls, handleToolCallEvent } from "./rules/checks/toolcalls.js"
import { TRANSPORT_RULE_IDS, TRANSPORT_SKIP_REASON } from "./rules/checks/transport.js"
import type {
  CanonicalFeature,
  Diagnostic,
  FeatureMatrix,
  Report,
  Severity,
  Validator,
  ValidatorOptions,
} from "./types.js"
import { CANONICAL_FEATURES } from "./types.js"

export * from "./types.js"
export { CATALOG, RULES, formatMessage, validateCatalog } from "./rules/catalog.js"
export type { Catalog, RuleDefinition, Severity as RuleSeverity, SeverityOrOff } from "./rules/catalog.js"
export { EVENT_TABLE, EVENT_TYPES, SDK_VERSION } from "./protocol/event-table.js"
export type { EventCategory, EventSpec, FieldKind, FieldSpec } from "./protocol/event-table.js"
export { applyPatch, validatePatchShape } from "./protocol/jsonpatch.js"

const DRAFTS_META_URL = "https://docs.ag-ui.com/drafts/meta-events"

// Features whose exercise cannot be distinguished on a passive stream: both
// generative-UI features need knowledge of the frontend's tool/component
// registry, which is out-of-band (see SQ-13).
const NOT_INFERABLE: readonly CanonicalFeature[] = [
  "agentic-generative-ui",
  "tool-based-generative-ui",
]

/** "runStarted" → "RUN_STARTED": case-insensitive match against wire types. */
const CANONICAL_BY_SQUASHED: ReadonlyMap<string, string> = new Map(
  EVENT_TYPES.map((t) => [t.replace(/_/g, "").toLowerCase(), t]),
)

function describeValue(v: unknown): string {
  if (v === null) return "null"
  if (Array.isArray(v)) return "array"
  return typeof v
}

export function createValidator(opts: ValidatorOptions = {}): Validator {
  const overrides = opts.severityOverrides ?? {}
  const declaredFeatures = new Set(opts.features ?? [])
  const layers = new Set(["core", ...(opts.layers ?? [])])

  const diagnostics: Diagnostic[] = []
  const internalErrors: string[] = []
  const stream: StreamState = {
    eventCount: 0,
    sawTimestamp: false,
    anySnapshot: false,
    agui001Fired: false,
    features: new Set(),
  }
  let run: RunState | null = null
  let finalized = false

  function mkEmit(batch: Diagnostic[], current: { index: number; type: string } | null): EmitFn {
    return (ruleId, params, extra = {}) => {
      const rule = RULES.get(ruleId)
      if (rule === undefined) {
        internalErrors.push(`emit() for unknown rule ${ruleId}`)
        return
      }
      const override = overrides[ruleId]
      if (override === "off") return
      const severity: Severity = override ?? extra.severity ?? rule.severity
      const aboutCurrentEvent = extra.eventIndex === undefined && current !== null
      const diag: Diagnostic = {
        rule: ruleId,
        severity,
        message: formatMessage(rule, params) + (extra.messageSuffix ?? ""),
        eventIndex: extra.eventIndex ?? current?.index ?? -1,
        specUrl: extra.specUrl ?? rule.specUrl,
      }
      if (aboutCurrentEvent) diag.eventType = current.type
      if (extra.pointer !== undefined) diag.pointer = extra.pointer
      if (extra.relatedEventIndex !== undefined) diag.relatedEventIndex = extra.relatedEventIndex
      diagnostics.push(diag)
      batch.push(diag)
    }
  }

  function validateSchema(type: string, spec: EventSpec, ev: Record<string, unknown>, emit: EmitFn): void {
    for (const [field, fs] of Object.entries(spec.fields)) {
      const v = ev[field]
      if (v === undefined) {
        if (fs.required) {
          emit("AGUI504", { type, detail: `missing required field '${field}' (${fs.kind})` }, {
            pointer: `/${field}`,
          })
        }
        continue
      }
      let kindOk = true
      switch (fs.kind) {
        case "string":
        case "number":
        case "boolean":
          kindOk = typeof v === fs.kind
          break
        case "array":
          kindOk = Array.isArray(v)
          break
        case "object":
          kindOk = typeof v === "object" && v !== null && !Array.isArray(v)
          break
        case "any":
          break
      }
      if (!kindOk) {
        emit("AGUI504", { type, detail: `field '${field}' must be ${fs.kind === "array" ? "an" : "a"} ${fs.kind}, got ${describeValue(v)}` }, {
          pointer: `/${field}`,
        })
        continue
      }
      if (fs.enum !== undefined && typeof v === "string" && !fs.enum.includes(v)) {
        emit("AGUI504", { type, detail: `field '${field}' must be one of ${fs.enum.join("|")}, got '${v}'` }, {
          pointer: `/${field}`,
        })
      }
    }
  }

  /** Chunk streams close implicitly on any event of a different type. */
  function closeChunks(r: RunState, emit: EmitFn, atIndex: number, except?: string): void {
    if (except !== "TEXT_MESSAGE_CHUNK") closeTextChunk(r, atIndex)
    if (except !== "TOOL_CALL_CHUNK") closeToolChunk(r, emit, atIndex)
    if (except !== "REASONING_MESSAGE_CHUNK") closeReasoningChunk(r)
  }

  /** Unterminated-at-run-end rules. Only on a *clean* end (RUN_FINISHED or a
   * stream that just stops): after RUN_ERROR, open streams are expected
   * debris of the failure, and flagging them would manufacture noise. */
  function endOfRunChecks(r: RunState, emit: EmitFn, atIndex: number): void {
    endOfRunText(r, emit, atIndex)
    endOfRunToolCalls(r, emit, atIndex)
    endOfRunSteps(r, emit, atIndex)
    endOfRunReasoning(r, emit, atIndex)
  }

  /** Opens the implicit run scope for streams that never announced one. */
  function ensureRun(index: number, type: string, emit: EmitFn): RunState {
    if (run === null) {
      if (!stream.agui001Fired) {
        emit("AGUI001", { type }, {})
        stream.agui001Fired = true
      }
      run = newRunState({ runId: null, threadId: null, startIndex: index, implicit: true })
    }
    return run
  }

  function processEvent(input: unknown, batch: Diagnostic[]): void {
    const index = stream.eventCount
    stream.eventCount += 1

    // 1. Parse. Malformed input is a diagnostic, never an exception.
    let parsed: unknown = input
    if (typeof input === "string") {
      try {
        parsed = JSON.parse(input)
      } catch (e) {
        mkEmit(batch, { index, type: "" })("AGUI502", {
          error: e instanceof Error ? e.message : String(e),
        })
        return
      }
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      mkEmit(batch, { index, type: "" })("AGUI502", {
        error: `payload is ${describeValue(parsed)}, expected a JSON object`,
      })
      return
    }
    const ev = parsed as Record<string, unknown>

    // 2. The declared type is the key to everything else.
    if (typeof ev.type !== "string") {
      mkEmit(batch, { index, type: "" })("AGUI504", {
        type: "(untyped)",
        detail: "event has no string 'type' property",
      }, { pointer: "/type" })
      return
    }
    const type = ev.type
    const emit = mkEmit(batch, { index, type })

    // 3. Base-event fields.
    if ("timestamp" in ev && ev.timestamp !== undefined) {
      if (typeof ev.timestamp === "number") stream.sawTimestamp = true
      else emit("AGUI504", { type, detail: `field 'timestamp' must be a number, got ${describeValue(ev.timestamp)}` }, { pointer: "/timestamp" })
    }

    // 4. Unknown types: AGUI503 (documented drafts at info; casing hints for
    //    near-misses — SQ-7).
    const spec = EVENT_TABLE[type]
    if (spec === undefined) {
      if (DRAFT_EVENT_TYPES.includes(type)) {
        emit("AGUI503", { type, sdkVersion: SDK_VERSION }, {
          severity: "info",
          specUrl: DRAFTS_META_URL,
          messageSuffix: " — documented draft event type, not yet in @ag-ui/core",
        })
      } else {
        const canonical = CANONICAL_BY_SQUASHED.get(type.replace(/[_\-\s]/g, "").toLowerCase())
        emit("AGUI503", { type, sdkVersion: SDK_VERSION }, {
          ...(canonical !== undefined
            ? { messageSuffix: ` — did you mean '${canonical}'? AG-UI wire types use SCREAMING_SNAKE_CASE` }
            : {}),
        })
      }
      return
    }

    // 5. Schema validation for the declared type (AGUI504).
    validateSchema(type, spec, ev, emit)

    // 6. Lifecycle position.
    if (type === "RUN_STARTED") {
      if (run === null) {
        run = newRunState({
          runId: str(ev, "runId") ?? null,
          threadId: str(ev, "threadId") ?? null,
          startIndex: index,
          implicit: false,
        })
      } else if (run.terminal !== null) {
        // A new run after a clean terminal: multi-run streams are legal
        // (serialized logs branch via parentRunId — SQ-6). Fresh scope.
        run = newRunState({
          runId: str(ev, "runId") ?? null,
          threadId: str(ev, "threadId") ?? null,
          startIndex: index,
          implicit: false,
        })
      } else if (run.implicit) {
        // The stream opened without RUN_STARTED (AGUI001 already fired); the
        // late start legitimizes the implicit scope rather than double-firing.
        closeChunks(run, emit, index)
        run.implicit = false
        run.runId = str(ev, "runId") ?? null
        run.threadId = str(ev, "threadId") ?? null
      } else {
        closeChunks(run, emit, index)
        emit("AGUI002", { runId: str(ev, "runId") ?? "(missing)" }, {
          relatedEventIndex: run.startIndex,
        })
      }
      return
    }

    const r = ensureRun(index, type, emit)

    // 7. Nothing may follow a terminal event (AGUI004/AGUI005).
    if (r.terminal !== null) {
      const terminalType = r.terminal.type
      if ((type === "RUN_FINISHED" || type === "RUN_ERROR") && type !== terminalType) {
        emit("AGUI005", { type, terminalType }, { relatedEventIndex: r.terminal.index })
      } else {
        emit("AGUI004", { type, terminalType }, { relatedEventIndex: r.terminal.index })
      }
      return
    }

    closeChunks(r, emit, index, type)

    // 8. Terminal events.
    if (type === "RUN_FINISHED" || type === "RUN_ERROR") {
      if (type === "RUN_FINISHED") {
        checkRunIdStability(api(index, type, ev, r, emit))
        endOfRunChecks(r, emit, index)
        const outcome = ev.outcome
        if (typeof outcome === "object" && outcome !== null &&
            (outcome as Record<string, unknown>).type === "interrupt") {
          stream.features.add("human-in-the-loop")
        }
      }
      r.terminal = { type, index }
      return
    }

    // 9. Per-category checks.
    const a = api(index, type, ev, r, emit)
    switch (spec.category) {
      case "lifecycle":
        handleStepEvent(a) // STEP_STARTED / STEP_FINISHED
        break
      case "text":
        handleTextEvent(a)
        break
      case "toolcall":
        handleToolCallEvent(a)
        break
      case "state":
        handleStateEvent(a)
        break
      case "reasoning":
        handleReasoningEvent(a)
        break
      case "thinking":
        // Deprecated but valid (SQ-8): schema-checked above, no ordering rules
        // in the catalog yet — a "deprecated event used" rule is proposed
        // upstream rather than invented here.
        break
      case "activity":
        // No activity rules in the catalog yet.
        break
      case "special":
        if (type === "RAW") {
          const wrapped = ev.event
          if (typeof wrapped === "object" && wrapped !== null) {
            const wrappedType = (wrapped as Record<string, unknown>).type
            if (typeof wrappedType === "string" && EVENT_TABLE[wrappedType] !== undefined) {
              emit("AGUI901", { wrappedType }, { pointer: "/event/type" })
            }
          }
        } else if (type === "CUSTOM") {
          const name = str(ev, "name")
          if (name !== undefined) {
            if (name === "PredictState") stream.features.add("predictive-state-updates")
            if (!/[.:/]/.test(name)) emit("AGUI903", { name }, { pointer: "/name" })
          }
        }
        break
    }
  }

  function api(
    index: number,
    type: string,
    event: Record<string, unknown>,
    r: RunState,
    emit: EmitFn,
  ): CheckApi {
    return {
      index,
      type,
      event,
      run: r,
      stream,
      emit,
      feature: (f) => stream.features.add(f),
    }
  }

  return {
    feed(event: unknown): Diagnostic[] {
      const batch: Diagnostic[] = []
      try {
        processEvent(event, batch)
      } catch (e) {
        internalErrors.push(`feed(event ${stream.eventCount - 1}): ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
      }
      return batch
    },

    finalize(): Diagnostic[] {
      if (finalized) return []
      finalized = true
      const batch: Diagnostic[] = []
      const emit = mkEmit(batch, null)
      try {
        if (run !== null && run.terminal === null) {
          closeChunks(run, emit, -1)
          emit("AGUI003", { runId: run.runId ?? "(unknown)" }, {
            eventIndex: -1,
            relatedEventIndex: run.startIndex,
          })
          endOfRunChecks(run, emit, -1)
        }
        if (stream.eventCount > 0 && !stream.sawTimestamp) {
          emit("AGUI902", { eventCount: stream.eventCount }, { eventIndex: -1 })
        }
        if (declaredFeatures.has("shared-state") && !stream.anySnapshot) {
          emit("AGUI305", {}, { eventIndex: -1 })
        }
      } catch (e) {
        internalErrors.push(`finalize(): ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`)
      }
      return batch
    },

    emitExternal(rule, params = {}, extra = {}): Diagnostic | null {
      const batch: Diagnostic[] = []
      try {
        mkEmit(batch, null)(rule, params, extra)
      } catch (e) {
        internalErrors.push(`emitExternal(${rule}): ${e instanceof Error ? e.message : String(e)}`)
      }
      return batch[0] ?? null
    },

    report(): Report {
      const summary = { errors: 0, warnings: 0, info: 0 }
      for (const d of diagnostics) {
        if (d.severity === "error") summary.errors += 1
        else if (d.severity === "warning") summary.warnings += 1
        else summary.info += 1
      }

      const features = {} as FeatureMatrix
      for (const f of CANONICAL_FEATURES) {
        features[f] = NOT_INFERABLE.includes(f)
          ? "not-inferable"
          : stream.features.has(f)
            ? "exercised"
            : "not-exercised"
      }

      const skipped = layers.has("transport")
        ? []
        : TRANSPORT_RULE_IDS
            .filter((id) => overrides[id] !== "off")
            .map((rule) => ({ rule, reason: TRANSPORT_SKIP_REASON }))
      if (!declaredFeatures.has("shared-state") && overrides.AGUI305 !== "off") {
        skipped.push({
          rule: "AGUI305",
          reason: "only evaluated when the 'shared-state' feature is declared via options.features",
        })
      }
      for (const [rule, severity] of Object.entries(overrides)) {
        if (severity === "off" && RULES.has(rule)) {
          skipped.push({ rule, reason: "disabled by severityOverrides" })
        }
      }

      return {
        diagnostics: [...diagnostics],
        summary,
        features,
        skipped,
        eventCount: stream.eventCount,
        internalErrors: [...internalErrors],
      }
    },
  }
}
