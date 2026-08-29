// Internal validator state and the API each check module sees.
// Everything here is engine-internal; the public surface lives in src/types.ts.

import type { CanonicalFeature } from "../../types.js"

/** Emit a diagnostic for rule `id`; params fill the catalog messageTemplate. */
export type EmitFn = (
  ruleId: string,
  params: Record<string, unknown>,
  extra?: {
    eventIndex?: number
    pointer?: string
    relatedEventIndex?: number
    /** Instance-level severity floor (e.g. draft META downgrades AGUI503). */
    severity?: "error" | "warning" | "info"
    /** Instance-level spec link override (e.g. draft docs page). */
    specUrl?: string
    /** Appended to the formatted message (e.g. casing hints). */
    messageSuffix?: string
  },
) => void

export interface OpenToolCall {
  startIndex: number
  args: string
  sawArgs: boolean
  /** subagentRunId this call belongs to (explicit, or inherited from the
   * parentMessageId's owner - AGUI606's "an untagged tool call inherits the
   * parent message's owner"). undefined means it belongs to the run itself. */
  owner: string | undefined
}

export interface RunState {
  /** null while the run is implicit (stream opened without RUN_STARTED). */
  runId: string | null
  threadId: string | null
  startIndex: number
  implicit: boolean
  terminal: { type: string; index: number } | null

  openMessages: Map<string, { startIndex: number; owner: string | undefined }>
  /** messageId -> index of the event that closed it. */
  closedMessages: Map<string, number>
  /** Every message id observed (starts, chunks, snapshots, tool results). */
  knownMessageIds: Set<string>
  /** messageId -> owning subagentRunId (undefined for the run), for AGUI606's
   * tool-call-inherits-its-parent-message's-owner resolution. Persists past
   * the message closing, unlike openMessages/closedMessages. */
  messageOwner: Map<string, string | undefined>

  openToolCalls: Map<string, OpenToolCall>
  closedToolCalls: Map<string, number>
  /** Ids also known from MESSAGES_SNAPSHOT history. */
  knownToolCallIds: Set<string>

  /** stepName -> re-entrant open count (SQ-10), first-open index, and the
   * subagentRunId recorded from the first STEP_STARTED (AGUI606) - a
   * re-entrant reopen does not change it. */
  openSteps: Map<string, { count: number; firstIndex: number; owner: string | undefined }>

  openSubagents: Map<string, { startIndex: number }>
  /** Closed via SUBAGENT_FINISHED (resumable only when outcome.type ===
   * "suspended" - the one case where a later SUBAGENT_STARTED reusing this
   * id is a legitimate continuation, not a duplicate, AGUI601) or SUBAGENT_ERROR. */
  closedSubagents: Map<string, { index: number; resumable: boolean }>
  /** Every subagentRunId ever started (open or closed), for parentSubagentRunId checks. */
  knownSubagentRunIds: Set<string>

  openReasoningBlocks: Map<string, number>
  openReasoningMessages: Map<string, number>

  state: {
    /** True once a STATE_SNAPSHOT established an observable base (SQ-1). */
    known: boolean
    value: unknown
    deltasSinceSnapshot: number
    snapshotSeen: boolean
    agui301Fired: boolean
  }

  /** Implicit streams opened by *_CHUNK events; closed by any other event. */
  textChunk: { messageId: string; startIndex: number } | null
  toolChunk: { toolCallId: string; startIndex: number; args: string; sawArgs: boolean } | null
  reasoningChunk: { messageId: string; startIndex: number } | null
}

export function newRunState(init: {
  runId: string | null
  threadId: string | null
  startIndex: number
  implicit: boolean
}): RunState {
  return {
    ...init,
    terminal: null,
    openMessages: new Map(),
    closedMessages: new Map(),
    knownMessageIds: new Set(),
    messageOwner: new Map(),
    openToolCalls: new Map(),
    closedToolCalls: new Map(),
    knownToolCallIds: new Set(),
    openSteps: new Map(),
    openSubagents: new Map(),
    closedSubagents: new Map(),
    knownSubagentRunIds: new Set(),
    openReasoningBlocks: new Map(),
    openReasoningMessages: new Map(),
    state: { known: false, value: undefined, deltasSinceSnapshot: 0, snapshotSeen: false, agui301Fired: false },
    textChunk: null,
    toolChunk: null,
    reasoningChunk: null,
  }
}

export interface StreamState {
  eventCount: number
  sawTimestamp: boolean
  anySnapshot: boolean
  agui001Fired: boolean
  features: Set<CanonicalFeature>
}

/** What a per-event check handler receives. */
export interface CheckApi {
  index: number
  type: string
  event: Record<string, unknown>
  run: RunState
  stream: StreamState
  emit: EmitFn
  feature: (f: CanonicalFeature) => void
}

/** Reads a field only if it is a string (schema problems already reported). */
export function str(event: Record<string, unknown>, field: string): string | undefined {
  const v = event[field]
  return typeof v === "string" ? v : undefined
}

/** AGUI606 — a continuation/close event's explicit subagentRunId must agree
 * with the owner recorded when its entity opened. Only compared when the
 * event explicitly tags itself; omitting the field is never flagged (SQ-15).
 * Shared by text/toolcalls/lifecycle — not the *_CHUNK forms or
 * TOOL_CALL_RESULT, which are independently attributed by spec. */
export function checkOwnerConsistency(
  emit: EmitFn,
  type: string,
  entityType: string,
  entityId: string,
  event: Record<string, unknown>,
  owner: string | undefined,
): void {
  const actual = str(event, "subagentRunId")
  if (actual !== undefined && actual !== owner) {
    emit(
      "AGUI606",
      { type, actual, entityType, entityId, expected: owner !== undefined ? `'${owner}'` : "the run" },
      { pointer: "/subagentRunId" },
    )
  }
}
