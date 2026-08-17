// Regenerates src/protocol/event-table.ts from the installed @ag-ui/core.
// Usage: node scripts/generate-event-table.mjs
//
// The generated file is checked in so the core stays dependency-free at
// runtime; test/protocol-drift.test.ts fails when it drifts from the SDK.

import { writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { deriveEventTable } from "./derive-lib.mjs"

const require = createRequire(import.meta.url)
const core = require("@ag-ui/core")
const sdkVersion = require("@ag-ui/core/package.json").version

const CATEGORY = {
  RUN_STARTED: "lifecycle", RUN_FINISHED: "lifecycle", RUN_ERROR: "lifecycle",
  STEP_STARTED: "lifecycle", STEP_FINISHED: "lifecycle",
  TEXT_MESSAGE_START: "text", TEXT_MESSAGE_CONTENT: "text",
  TEXT_MESSAGE_END: "text", TEXT_MESSAGE_CHUNK: "text",
  TOOL_CALL_START: "toolcall", TOOL_CALL_ARGS: "toolcall", TOOL_CALL_END: "toolcall",
  TOOL_CALL_CHUNK: "toolcall", TOOL_CALL_RESULT: "toolcall",
  STATE_SNAPSHOT: "state", STATE_DELTA: "state", MESSAGES_SNAPSHOT: "state",
  ACTIVITY_SNAPSHOT: "activity", ACTIVITY_DELTA: "activity",
  REASONING_START: "reasoning", REASONING_MESSAGE_START: "reasoning",
  REASONING_MESSAGE_CONTENT: "reasoning", REASONING_MESSAGE_END: "reasoning",
  REASONING_MESSAGE_CHUNK: "reasoning", REASONING_END: "reasoning",
  REASONING_ENCRYPTED_VALUE: "reasoning",
  THINKING_START: "thinking", THINKING_END: "thinking",
  THINKING_TEXT_MESSAGE_START: "thinking", THINKING_TEXT_MESSAGE_CONTENT: "thinking",
  THINKING_TEXT_MESSAGE_END: "thinking",
  RAW: "special", CUSTOM: "special",
}

// @deprecated markers in @ag-ui/core dist/index.d.ts, "Will be removed in 1.0.0".
const DEPRECATED = {
  THINKING_START: "REASONING_START",
  THINKING_END: "REASONING_END",
  THINKING_TEXT_MESSAGE_START: "REASONING_MESSAGE_START",
  THINKING_TEXT_MESSAGE_CONTENT: "REASONING_MESSAGE_CONTENT",
  THINKING_TEXT_MESSAGE_END: "REASONING_MESSAGE_END",
}

const EVENTS_DOC = "https://docs.ag-ui.com/concepts/events"

function docsUrl(wireType, schemaExport) {
  if (CATEGORY[wireType] === "thinking") return `${EVENTS_DOC}#thinking-events-deprecated`
  // Anchor is the lowercased PascalCase event name, e.g. ToolCallStartEventSchema
  // -> #toolcallstart. Verified against the rendered page's heading ids.
  return `${EVENTS_DOC}#${schemaExport.replace(/EventSchema$/, "").toLowerCase()}`
}

const { eventTypes, table } = deriveEventTable(core)

const missing = eventTypes.filter((t) => !table[t])
if (missing.length > 0) {
  console.error("EventType values with no derivable schema:", missing)
  process.exit(1)
}
const uncategorized = Object.keys(table).filter((t) => !CATEGORY[t])
if (uncategorized.length > 0) {
  console.error("New event types need a category assignment:", uncategorized)
  process.exit(1)
}

const entries = eventTypes.map((wireType) => {
  const { schemaExport, fields } = table[wireType]
  const fieldLines = Object.entries(fields).map(([name, f]) => {
    const parts = [`kind: ${JSON.stringify(f.kind)}`, `required: ${f.required}`]
    if (f.enum) parts.push(`enum: ${JSON.stringify(f.enum)}`)
    return `      ${JSON.stringify(name)}: { ${parts.join(", ")} },`
  })
  const lines = [
    `  ${JSON.stringify(wireType)}: {`,
    `    category: ${JSON.stringify(CATEGORY[wireType])},`,
  ]
  if (DEPRECATED[wireType]) lines.push(`    deprecated: ${JSON.stringify(DEPRECATED[wireType])},`)
  lines.push(
    `    specUrl: ${JSON.stringify(docsUrl(wireType, schemaExport))},`,
    `    fields: {`,
    ...fieldLines,
    `    },`,
    `  },`,
  )
  return lines.join("\n")
})

const out = `// AUTO-GENERATED from @ag-ui/core v${sdkVersion} — do not edit by hand.
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
export const SDK_VERSION = ${JSON.stringify(sdkVersion)}

/** Canonical wire event types and their schemas, derived from @ag-ui/core. */
export const EVENT_TABLE: Readonly<Record<string, EventSpec>> = {
${entries.join("\n")}
}

/** All canonical wire \`type\` values, in @ag-ui/core enum order. */
export const EVENT_TYPES: readonly string[] = Object.keys(EVENT_TABLE)

/**
 * Wire types documented as drafts (https://docs.ag-ui.com/drafts/overview) but
 * not yet in @ag-ui/core. Not errors: reported at info severity.
 */
export const DRAFT_EVENT_TYPES: readonly string[] = ["META"]
`

writeFileSync(new URL("../src/protocol/event-table.ts", import.meta.url), out)
console.log(`Wrote src/protocol/event-table.ts (@ag-ui/core v${sdkVersion}, ${eventTypes.length} event types)`)
