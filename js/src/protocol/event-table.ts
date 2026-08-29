// AUTO-GENERATED from @ag-ui/core v0.0.59 — do not edit by hand.
// Regenerate with: node scripts/generate-event-table.mjs
// test/protocol-drift.test.ts fails if this file drifts from the installed SDK.

export type FieldKind = "string" | "number" | "boolean" | "object" | "array" | "any"

export type EventCategory =
  | "lifecycle"
  | "text"
  | "toolcall"
  | "state"
  | "activity"
  | "reasoning"
  | "thinking"
  | "special"
  | "subagent"

export interface FieldSpec {
  kind: FieldKind
  required: boolean
  enum?: readonly string[]
}

export interface EventSpec {
  category: EventCategory
  /** Present when the SDK marks the event @deprecated; names the replacement. */
  deprecated?: string
  /** Docs section governing this event. */
  specUrl: string
  /** Wire fields beyond the base-event fields (type, timestamp, rawEvent). */
  fields: Readonly<Record<string, FieldSpec>>
}

/** Version of @ag-ui/core this table was derived from. */
export const SDK_VERSION = "0.0.59"

/** Canonical wire event types and their schemas, derived from @ag-ui/core. */
export const EVENT_TABLE: Readonly<Record<string, EventSpec>> = {
  "TEXT_MESSAGE_START": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagestart",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "role": { kind: "string", required: false, enum: ["developer","system","assistant","user"] },
      "name": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TEXT_MESSAGE_CONTENT": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagecontent",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TEXT_MESSAGE_END": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessageend",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TEXT_MESSAGE_CHUNK": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagechunk",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: false },
      "role": { kind: "string", required: false, enum: ["developer","system","assistant","user"] },
      "delta": { kind: "string", required: false },
      "name": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_START": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallstart",
    fields: {
      "metadata": { kind: "object", required: false },
      "toolCallId": { kind: "string", required: true },
      "toolCallName": { kind: "string", required: true },
      "parentMessageId": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_ARGS": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallargs",
    fields: {
      "metadata": { kind: "object", required: false },
      "toolCallId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_END": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallend",
    fields: {
      "metadata": { kind: "object", required: false },
      "toolCallId": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_CHUNK": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallchunk",
    fields: {
      "metadata": { kind: "object", required: false },
      "toolCallId": { kind: "string", required: false },
      "toolCallName": { kind: "string", required: false },
      "parentMessageId": { kind: "string", required: false },
      "delta": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_RESULT": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallresult",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "toolCallId": { kind: "string", required: true },
      "content": { kind: "string", required: true },
      "role": { kind: "string", required: false, enum: ["tool"] },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "THINKING_START": {
    category: "thinking",
    deprecated: "REASONING_START",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "metadata": { kind: "object", required: false },
      "title": { kind: "string", required: false },
    },
  },
  "THINKING_END": {
    category: "thinking",
    deprecated: "REASONING_END",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "metadata": { kind: "object", required: false },
    },
  },
  "THINKING_TEXT_MESSAGE_START": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_START",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "metadata": { kind: "object", required: false },
    },
  },
  "THINKING_TEXT_MESSAGE_CONTENT": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_CONTENT",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "metadata": { kind: "object", required: false },
      "delta": { kind: "string", required: true },
    },
  },
  "THINKING_TEXT_MESSAGE_END": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_END",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "metadata": { kind: "object", required: false },
    },
  },
  "STATE_SNAPSHOT": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#statesnapshot",
    fields: {
      "metadata": { kind: "object", required: false },
      "snapshot": { kind: "any", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "STATE_DELTA": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#statedelta",
    fields: {
      "metadata": { kind: "object", required: false },
      "delta": { kind: "array", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "MESSAGES_SNAPSHOT": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#messagessnapshot",
    fields: {
      "metadata": { kind: "object", required: false },
      "messages": { kind: "array", required: true },
    },
  },
  "ACTIVITY_SNAPSHOT": {
    category: "activity",
    specUrl: "https://docs.ag-ui.com/concepts/events#activitysnapshot",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "activityType": { kind: "string", required: true },
      "content": { kind: "object", required: true },
      "replace": { kind: "boolean", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "ACTIVITY_DELTA": {
    category: "activity",
    specUrl: "https://docs.ag-ui.com/concepts/events#activitydelta",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "activityType": { kind: "string", required: true },
      "patch": { kind: "array", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "RAW": {
    category: "special",
    specUrl: "https://docs.ag-ui.com/concepts/events#raw",
    fields: {
      "metadata": { kind: "object", required: false },
      "event": { kind: "any", required: true },
      "source": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "CUSTOM": {
    category: "special",
    specUrl: "https://docs.ag-ui.com/concepts/events#custom",
    fields: {
      "metadata": { kind: "object", required: false },
      "name": { kind: "string", required: true },
      "value": { kind: "any", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "RUN_STARTED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#runstarted",
    fields: {
      "metadata": { kind: "object", required: false },
      "threadId": { kind: "string", required: true },
      "runId": { kind: "string", required: true },
      "parentRunId": { kind: "string", required: false },
      "input": { kind: "object", required: false },
    },
  },
  "RUN_FINISHED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#runfinished",
    fields: {
      "metadata": { kind: "object", required: false },
      "threadId": { kind: "string", required: true },
      "runId": { kind: "string", required: true },
      "result": { kind: "any", required: false },
      "outcome": { kind: "object", required: false },
      "usage": { kind: "array", required: false },
    },
  },
  "RUN_ERROR": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#runerror",
    fields: {
      "metadata": { kind: "object", required: false },
      "message": { kind: "string", required: true },
      "code": { kind: "string", required: false },
      "usage": { kind: "array", required: false },
    },
  },
  "STEP_STARTED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#stepstarted",
    fields: {
      "metadata": { kind: "object", required: false },
      "stepName": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "STEP_FINISHED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#stepfinished",
    fields: {
      "metadata": { kind: "object", required: false },
      "stepName": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_START": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningstart",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_MESSAGE_START": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagestart",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "role": { kind: "string", required: true, enum: ["reasoning"] },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_MESSAGE_CONTENT": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagecontent",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_MESSAGE_END": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessageend",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_MESSAGE_CHUNK": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagechunk",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: false },
      "delta": { kind: "string", required: false },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_END": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningend",
    fields: {
      "metadata": { kind: "object", required: false },
      "messageId": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "REASONING_ENCRYPTED_VALUE": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningencryptedvalue",
    fields: {
      "metadata": { kind: "object", required: false },
      "subtype": { kind: "string", required: true, enum: ["tool-call","message"] },
      "entityId": { kind: "string", required: true },
      "encryptedValue": { kind: "string", required: true },
      "subagentRunId": { kind: "string", required: false },
    },
  },
  "SUBAGENT_STARTED": {
    category: "subagent",
    specUrl: "https://docs.ag-ui.com/concepts/events#subagent-events",
    fields: {
      "metadata": { kind: "object", required: false },
      "subagentRunId": { kind: "string", required: true },
      "name": { kind: "string", required: true },
      "description": { kind: "string", required: false },
      "parentSubagentRunId": { kind: "string", required: false },
      "parentToolCallId": { kind: "string", required: false },
      "parentMessageId": { kind: "string", required: false },
    },
  },
  "SUBAGENT_FINISHED": {
    category: "subagent",
    specUrl: "https://docs.ag-ui.com/concepts/events#subagent-events",
    fields: {
      "metadata": { kind: "object", required: false },
      "subagentRunId": { kind: "string", required: true },
      "result": { kind: "any", required: false },
      "outcome": { kind: "object", required: false },
    },
  },
  "SUBAGENT_ERROR": {
    category: "subagent",
    specUrl: "https://docs.ag-ui.com/concepts/events#subagent-events",
    fields: {
      "metadata": { kind: "object", required: false },
      "subagentRunId": { kind: "string", required: true },
      "message": { kind: "string", required: true },
      "code": { kind: "string", required: false },
    },
  },
}

/** All canonical wire `type` values, in @ag-ui/core enum order. */
export const EVENT_TYPES: readonly string[] = Object.keys(EVENT_TABLE)

/**
 * Wire types documented as drafts (https://docs.ag-ui.com/drafts/overview) but
 * not yet in @ag-ui/core. Not errors: reported at info severity.
 */
export const DRAFT_EVENT_TYPES: readonly string[] = ["META"]
