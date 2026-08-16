// AUTO-GENERATED from @ag-ui/core v0.0.58 — do not edit by hand.
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
export const SDK_VERSION = "0.0.58"

/** Canonical wire event types and their schemas, derived from @ag-ui/core. */
export const EVENT_TABLE: Readonly<Record<string, EventSpec>> = {
  "TEXT_MESSAGE_START": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagestart",
    fields: {
      "messageId": { kind: "string", required: true },
      "role": { kind: "string", required: false, enum: ["developer","system","assistant","user"] },
      "name": { kind: "string", required: false },
    },
  },
  "TEXT_MESSAGE_CONTENT": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagecontent",
    fields: {
      "messageId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
    },
  },
  "TEXT_MESSAGE_END": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessageend",
    fields: {
      "messageId": { kind: "string", required: true },
    },
  },
  "TEXT_MESSAGE_CHUNK": {
    category: "text",
    specUrl: "https://docs.ag-ui.com/concepts/events#textmessagechunk",
    fields: {
      "messageId": { kind: "string", required: false },
      "role": { kind: "string", required: false, enum: ["developer","system","assistant","user"] },
      "delta": { kind: "string", required: false },
      "name": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_START": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallstart",
    fields: {
      "toolCallId": { kind: "string", required: true },
      "toolCallName": { kind: "string", required: true },
      "parentMessageId": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_ARGS": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallargs",
    fields: {
      "toolCallId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
    },
  },
  "TOOL_CALL_END": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallend",
    fields: {
      "toolCallId": { kind: "string", required: true },
    },
  },
  "TOOL_CALL_CHUNK": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallchunk",
    fields: {
      "toolCallId": { kind: "string", required: false },
      "toolCallName": { kind: "string", required: false },
      "parentMessageId": { kind: "string", required: false },
      "delta": { kind: "string", required: false },
    },
  },
  "TOOL_CALL_RESULT": {
    category: "toolcall",
    specUrl: "https://docs.ag-ui.com/concepts/events#toolcallresult",
    fields: {
      "messageId": { kind: "string", required: true },
      "toolCallId": { kind: "string", required: true },
      "content": { kind: "string", required: true },
      "role": { kind: "string", required: false, enum: ["tool"] },
    },
  },
  "THINKING_START": {
    category: "thinking",
    deprecated: "REASONING_START",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "title": { kind: "string", required: false },
    },
  },
  "THINKING_END": {
    category: "thinking",
    deprecated: "REASONING_END",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
    },
  },
  "THINKING_TEXT_MESSAGE_START": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_START",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
    },
  },
  "THINKING_TEXT_MESSAGE_CONTENT": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_CONTENT",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
      "delta": { kind: "string", required: true },
    },
  },
  "THINKING_TEXT_MESSAGE_END": {
    category: "thinking",
    deprecated: "REASONING_MESSAGE_END",
    specUrl: "https://docs.ag-ui.com/concepts/events#thinking-events-deprecated",
    fields: {
    },
  },
  "STATE_SNAPSHOT": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#statesnapshot",
    fields: {
      "snapshot": { kind: "any", required: true },
    },
  },
  "STATE_DELTA": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#statedelta",
    fields: {
      "delta": { kind: "array", required: true },
    },
  },
  "MESSAGES_SNAPSHOT": {
    category: "state",
    specUrl: "https://docs.ag-ui.com/concepts/events#messagessnapshot",
    fields: {
      "messages": { kind: "array", required: true },
    },
  },
  "ACTIVITY_SNAPSHOT": {
    category: "activity",
    specUrl: "https://docs.ag-ui.com/concepts/events#activitysnapshot",
    fields: {
      "messageId": { kind: "string", required: true },
      "activityType": { kind: "string", required: true },
      "content": { kind: "object", required: true },
      "replace": { kind: "boolean", required: false },
    },
  },
  "ACTIVITY_DELTA": {
    category: "activity",
    specUrl: "https://docs.ag-ui.com/concepts/events#activitydelta",
    fields: {
      "messageId": { kind: "string", required: true },
      "activityType": { kind: "string", required: true },
      "patch": { kind: "array", required: true },
    },
  },
  "RAW": {
    category: "special",
    specUrl: "https://docs.ag-ui.com/concepts/events#raw",
    fields: {
      "event": { kind: "any", required: true },
      "source": { kind: "string", required: false },
    },
  },
  "CUSTOM": {
    category: "special",
    specUrl: "https://docs.ag-ui.com/concepts/events#custom",
    fields: {
      "name": { kind: "string", required: true },
      "value": { kind: "any", required: true },
    },
  },
  "RUN_STARTED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#runstarted",
    fields: {
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
      "message": { kind: "string", required: true },
      "code": { kind: "string", required: false },
      "usage": { kind: "array", required: false },
    },
  },
  "STEP_STARTED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#stepstarted",
    fields: {
      "stepName": { kind: "string", required: true },
    },
  },
  "STEP_FINISHED": {
    category: "lifecycle",
    specUrl: "https://docs.ag-ui.com/concepts/events#stepfinished",
    fields: {
      "stepName": { kind: "string", required: true },
    },
  },
  "REASONING_START": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningstart",
    fields: {
      "messageId": { kind: "string", required: true },
    },
  },
  "REASONING_MESSAGE_START": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagestart",
    fields: {
      "messageId": { kind: "string", required: true },
      "role": { kind: "string", required: true, enum: ["reasoning"] },
    },
  },
  "REASONING_MESSAGE_CONTENT": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagecontent",
    fields: {
      "messageId": { kind: "string", required: true },
      "delta": { kind: "string", required: true },
    },
  },
  "REASONING_MESSAGE_END": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessageend",
    fields: {
      "messageId": { kind: "string", required: true },
    },
  },
  "REASONING_MESSAGE_CHUNK": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningmessagechunk",
    fields: {
      "messageId": { kind: "string", required: false },
      "delta": { kind: "string", required: false },
    },
  },
  "REASONING_END": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningend",
    fields: {
      "messageId": { kind: "string", required: true },
    },
  },
  "REASONING_ENCRYPTED_VALUE": {
    category: "reasoning",
    specUrl: "https://docs.ag-ui.com/concepts/events#reasoningencryptedvalue",
    fields: {
      "subtype": { kind: "string", required: true, enum: ["tool-call","message"] },
      "entityId": { kind: "string", required: true },
      "encryptedValue": { kind: "string", required: true },
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
