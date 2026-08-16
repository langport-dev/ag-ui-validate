// Builds the language-neutral fixture corpus (fixtures/).
//
// Each fixture below declares its event stream AND the exact rule IDs it is
// intended to fire, written independently of the validator. The script runs
// the built validator over every stream and REFUSES to write anything if the
// fired rules differ from the declared intent — so regenerating expected.json
// can never silently bake an implementation bug into the corpus.
//
// Usage: npm run build && node scripts/build-fixtures.mjs

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { createValidator } from "../dist/index.js"
import { validateBody } from "../dist/transport.js"

const FIXTURES = fileURLToPath(new URL("../fixtures/", import.meta.url))

let ts = 1755300000000
const t = () => (ts += 100)

// ---------------------------------------------------------------------------
// Valid fixtures: one per canonical AG-UI feature (false-positive guards).
// ---------------------------------------------------------------------------

const start = (runId = "run_001", threadId = "thread_001", over = {}) =>
  ({ type: "RUN_STARTED", threadId, runId, timestamp: t(), ...over })
const finish = (runId = "run_001", threadId = "thread_001", over = {}) =>
  ({ type: "RUN_FINISHED", threadId, runId, outcome: { type: "success" }, timestamp: t(), ...over })
const text = (id, content, role = "assistant") => [
  { type: "TEXT_MESSAGE_START", messageId: id, role, timestamp: t() },
  { type: "TEXT_MESSAGE_CONTENT", messageId: id, delta: content, timestamp: t() },
  { type: "TEXT_MESSAGE_END", messageId: id, timestamp: t() },
]

const VALID = {
  "agentic-chat": {
    intent: [],
    events: [
      start("run_001", "thread_chat"),
      { type: "REASONING_START", messageId: "rsn_001", timestamp: t() },
      { type: "REASONING_MESSAGE_START", messageId: "rmsg_001", role: "reasoning", timestamp: t() },
      { type: "REASONING_MESSAGE_CONTENT", messageId: "rmsg_001", delta: "The user greeted me; respond warmly.", timestamp: t() },
      { type: "REASONING_MESSAGE_END", messageId: "rmsg_001", timestamp: t() },
      { type: "REASONING_END", messageId: "rsn_001", timestamp: t() },
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_001", delta: "Hello! ", timestamp: t() },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_001", delta: "How can I help ", timestamp: t() },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_001", delta: "you today?", timestamp: t() },
      { type: "TEXT_MESSAGE_END", messageId: "msg_001", timestamp: t() },
      { type: "TEXT_MESSAGE_CHUNK", messageId: "msg_002", delta: "Chunked messages ", timestamp: t() },
      { type: "TEXT_MESSAGE_CHUNK", delta: "work too.", timestamp: t() },
      finish("run_001", "thread_chat"),
    ],
  },

  "backend-tool-rendering": {
    intent: [],
    events: [
      start("run_001", "thread_tools"),
      ...text("msg_001", "Checking the weather…"),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", parentMessageId: "msg_001", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: '{"city":"Ber', timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: 'lin"}', timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      { type: "TOOL_CALL_RESULT", messageId: "msg_002", toolCallId: "call_001", content: '{"tempC":21}', role: "tool", timestamp: t() },
      { type: "RAW", event: { kind: "langgraph_checkpoint", checkpoint_id: "ckpt_42" }, source: "langgraph", timestamp: t() },
      ...text("msg_003", "It is 21°C in Berlin."),
      finish("run_001", "thread_tools"),
    ],
  },

  "human-in-the-loop": {
    intent: [],
    events: [
      start("run_001", "thread_hitl"),
      ...text("msg_001", "I need your approval to delete 3 files."),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "confirm_action", parentMessageId: "msg_001", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: '{"action":"delete","count":3}', timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish("run_001", "thread_hitl", {
        outcome: { type: "interrupt", interrupts: [{ id: "int_001", reason: "approval_required", toolCallId: "call_001" }] },
      }),
      start("run_002", "thread_hitl", { parentRunId: "run_001" }),
      ...text("msg_002", "Done — 3 files deleted."),
      finish("run_002", "thread_hitl"),
    ],
  },

  "agentic-generative-ui": {
    intent: [],
    events: [
      start("run_001", "thread_genui"),
      { type: "STATE_SNAPSHOT", snapshot: { steps: [{ name: "plan", status: "pending" }, { name: "execute", status: "pending" }] }, timestamp: t() },
      { type: "STEP_STARTED", stepName: "plan", timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/steps/0/status", value: "in_progress" }], timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/steps/0/status", value: "done" }], timestamp: t() },
      { type: "STEP_FINISHED", stepName: "plan", timestamp: t() },
      { type: "STEP_STARTED", stepName: "execute", timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/steps/1/status", value: "done" }], timestamp: t() },
      { type: "STEP_FINISHED", stepName: "execute", timestamp: t() },
      ...text("msg_001", "All steps complete."),
      finish("run_001", "thread_genui"),
    ],
  },

  "tool-based-generative-ui": {
    intent: [],
    events: [
      start("run_001", "thread_fe_tools"),
      // A frontend-executed tool: no TOOL_CALL_RESULT ever appears on the
      // stream — the client runs the tool and renders the component.
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "generate_haiku", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: '{"topic":"conformance"}', timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish("run_001", "thread_fe_tools"),
    ],
  },

  "shared-state": {
    intent: [],
    events: [
      start("run_001", "thread_state"),
      { type: "STATE_SNAPSHOT", snapshot: { recipe: { title: "Pasta", ingredients: ["tomato"] } }, timestamp: t() },
      ...text("msg_001", "Adding garlic to the recipe."),
      { type: "STATE_DELTA", delta: [{ op: "add", path: "/recipe/ingredients/-", value: "garlic" }], timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "test", path: "/recipe/title", value: "Pasta" }, { op: "replace", path: "/recipe/title", value: "Garlic Pasta" }], timestamp: t() },
      finish("run_001", "thread_state"),
    ],
  },

  "predictive-state-updates": {
    // The Dojo's real event name "PredictState" is un-namespaced, so the
    // hygiene note AGUI903 (info) legitimately fires on this valid stream.
    intent: ["AGUI903"],
    events: [
      start("run_001", "thread_predict"),
      { type: "STATE_SNAPSHOT", snapshot: { document: "" }, timestamp: t() },
      { type: "CUSTOM", name: "PredictState", value: [{ state_key: "document", tool: "write_document", tool_argument: "document" }], timestamp: t() },
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "write_document", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: '{"document":"Hello world."}', timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/document", value: "Hello world." }], timestamp: t() },
      ...text("msg_001", "Written."),
      finish("run_001", "thread_predict"),
    ],
  },
}

// ---------------------------------------------------------------------------
// Invalid fixtures: one directory per core-checkable rule.
// Transport rules (AGUI501/505/506/507/508) need a live connection and get
// their fixtures with the transport layer in M5.
// ---------------------------------------------------------------------------

const INVALID = {
  "AGUI001-first-event-not-run-started": {
    intent: ["AGUI001"],
    events: [
      ...text("msg_001", "Hello without a run."),
      { type: "RUN_FINISHED", threadId: "thread_001", runId: "run_001", timestamp: t() },
    ],
  },
  "AGUI002-duplicate-run-started": {
    intent: ["AGUI002"],
    events: [start(), start("run_002"), finish()],
  },
  "AGUI003-run-never-terminated": {
    intent: ["AGUI003"],
    events: [start(), ...text("msg_001", "This run just stops.")],
  },
  "AGUI004-event-after-terminal": {
    intent: ["AGUI004"],
    events: [start(), finish(), { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() }],
  },
  "AGUI005-finished-and-error": {
    intent: ["AGUI005"],
    events: [start(), finish(), { type: "RUN_ERROR", message: "boom", timestamp: t() }],
  },
  "AGUI006-step-finished-unmatched": {
    intent: ["AGUI006"],
    events: [start(), { type: "STEP_FINISHED", stepName: "plan", timestamp: t() }, finish()],
  },
  "AGUI007-step-unterminated": {
    intent: ["AGUI007"],
    events: [start(), { type: "STEP_STARTED", stepName: "plan", timestamp: t() }, finish()],
  },
  "AGUI008-unstable-run-ids": {
    intent: ["AGUI008"],
    events: [start("run_001"), finish("run_999")],
  },
  "AGUI101-content-without-start": {
    intent: ["AGUI101"],
    events: [start(), { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_ghost", delta: "orphan", timestamp: t() }, finish()],
  },
  "AGUI102-end-without-start": {
    intent: ["AGUI102"],
    events: [start(), { type: "TEXT_MESSAGE_END", messageId: "msg_ghost", timestamp: t() }, finish()],
  },
  "AGUI103-message-unterminated": {
    intent: ["AGUI103"],
    events: [
      start(),
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_001", delta: "never ends", timestamp: t() },
      finish(),
    ],
  },
  "AGUI104-duplicate-message-id": {
    intent: ["AGUI104"],
    events: [
      start(),
      ...text("msg_001", "first use"),
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      finish(),
    ],
  },
  "AGUI105-empty-content-delta": {
    intent: ["AGUI105"],
    events: [
      start(),
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_001", delta: "", timestamp: t() },
      { type: "TEXT_MESSAGE_END", messageId: "msg_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI106-interleaved-same-message-id": {
    intent: ["AGUI106"],
    events: [
      start(),
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      { type: "TEXT_MESSAGE_START", messageId: "msg_001", role: "assistant", timestamp: t() },
      { type: "TEXT_MESSAGE_END", messageId: "msg_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI201-args-without-start": {
    intent: ["AGUI201"],
    events: [start(), { type: "TOOL_CALL_ARGS", toolCallId: "call_ghost", delta: "{}", timestamp: t() }, finish()],
  },
  "AGUI202-end-without-start": {
    intent: ["AGUI202"],
    events: [start(), { type: "TOOL_CALL_END", toolCallId: "call_ghost", timestamp: t() }, finish()],
  },
  "AGUI203-unterminated-tool-call": {
    intent: ["AGUI203"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_7", toolCallName: "get_weather", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_7", delta: '{"city":"Berlin"}', timestamp: t() },
      finish(),
    ],
  },
  "AGUI204-args-not-json": {
    intent: ["AGUI204"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: '{"city":', timestamp: t() },
      { type: "TOOL_CALL_ARGS", toolCallId: "call_001", delta: "oops}", timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI205-duplicate-tool-call-id": {
    intent: ["AGUI205"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", timestamp: t() },
      finish(),
    ],
  },
  "AGUI206-result-before-end": {
    intent: ["AGUI206"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", timestamp: t() },
      { type: "TOOL_CALL_RESULT", messageId: "msg_001", toolCallId: "call_001", content: "early", timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI207-result-unknown-id": {
    intent: ["AGUI207"],
    events: [
      start(),
      { type: "TOOL_CALL_RESULT", messageId: "msg_001", toolCallId: "call_ghost", content: "orphan", timestamp: t() },
      finish(),
    ],
  },
  "AGUI208-unknown-parent-message-id": {
    intent: ["AGUI208"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_001", toolCallName: "get_weather", parentMessageId: "msg_ghost", timestamp: t() },
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI301-delta-before-snapshot": {
    intent: ["AGUI301"],
    events: [
      start(),
      { type: "STATE_DELTA", delta: [{ op: "add", path: "/a", value: 1 }], timestamp: t() },
      finish(),
    ],
  },
  "AGUI302-delta-failed-to-apply": {
    intent: ["AGUI302"],
    events: [
      start(),
      { type: "STATE_SNAPSHOT", snapshot: { items: [] }, timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/items/3", value: "x" }], timestamp: t() },
      finish(),
    ],
  },
  "AGUI303-invalid-patch-document": {
    intent: ["AGUI303"],
    events: [
      start(),
      { type: "STATE_SNAPSHOT", snapshot: {}, timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "merge", path: "/a", value: 1 }], timestamp: t() },
      finish(),
    ],
  },
  "AGUI304-midrun-snapshot-discards-deltas": {
    intent: ["AGUI304"],
    events: [
      start(),
      { type: "STATE_SNAPSHOT", snapshot: { a: 1 }, timestamp: t() },
      { type: "STATE_DELTA", delta: [{ op: "replace", path: "/a", value: 2 }], timestamp: t() },
      { type: "STATE_SNAPSHOT", snapshot: { a: 99 }, timestamp: t() },
      finish(),
    ],
  },
  "AGUI305-shared-state-never-established": {
    intent: ["AGUI305"],
    options: { features: ["shared-state"] },
    events: [start(), ...text("msg_001", "No state events at all."), finish()],
  },
  "AGUI401-reasoning-content-without-start": {
    intent: ["AGUI401"],
    events: [
      start(),
      { type: "REASONING_MESSAGE_CONTENT", messageId: "rmsg_ghost", delta: "orphan", timestamp: t() },
      finish(),
    ],
  },
  "AGUI402-reasoning-unterminated": {
    intent: ["AGUI402"],
    events: [start(), { type: "REASONING_START", messageId: "rsn_001", timestamp: t() }, finish()],
  },
  "AGUI502-payload-not-json": {
    intent: ["AGUI502"],
    events: [start(), '{"type": broken json', finish()],
  },
  "AGUI503-unknown-event-type": {
    intent: ["AGUI503"],
    events: [start(), { type: "AGUI_PING", timestamp: t() }, finish()],
  },
  "AGUI504-schema-violation": {
    intent: ["AGUI504"],
    events: [
      start(),
      { type: "TOOL_CALL_START", toolCallId: "call_001", timestamp: t() }, // missing toolCallName
      { type: "TOOL_CALL_END", toolCallId: "call_001", timestamp: t() },
      finish(),
    ],
  },
  "AGUI901-raw-wraps-typed-event": {
    intent: ["AGUI901"],
    events: [
      start(),
      { type: "RAW", event: { type: "TOOL_CALL_RESULT", toolCallId: "call_001", content: "wrapped" }, timestamp: t() },
      finish(),
    ],
  },
  "AGUI902-no-timestamps": {
    intent: ["AGUI902"],
    events: [
      { type: "RUN_STARTED", threadId: "thread_001", runId: "run_001" },
      { type: "RUN_FINISHED", threadId: "thread_001", runId: "run_001" },
    ],
  },
  "AGUI903-custom-name-not-namespaced": {
    intent: ["AGUI903"],
    events: [start(), { type: "CUSTOM", name: "update", value: { x: 1 }, timestamp: t() }, finish()],
  },
}

// ---------------------------------------------------------------------------
// Transport fixtures: scenario.json instead of stream.jsonl — an HTTP
// response body described as timed byte chunks. Runners simulate the clock
// with each chunk's gapMs and feed the bytes through their transport layer.
// ---------------------------------------------------------------------------

const sseFrame = (e) => `data: ${JSON.stringify(e)}\n\n`

const runFrames = (extra = []) => {
  const events = [
    start("run_001", "thread_001"),
    ...text("msg_001", "All good here."),
    ...extra,
    finish("run_001", "thread_001"),
  ]
  return events.map(sseFrame)
}

const TRANSPORT = {
  "AGUI501-missing-data-prefix": {
    intent: ["AGUI501"],
    scenario: {
      contentType: "text/event-stream",
      chunks: [
        { gapMs: 0, text: sseFrame(start("run_001", "thread_001")) },
        // The classic broken server: a JSON payload with no "data:" prefix.
        // SSE clients silently drop it as an unknown field.
        { gapMs: 0, text: `${JSON.stringify({ type: "CUSTOM", name: "acme.ping", value: 1, timestamp: t() })}\n\n` },
        { gapMs: 0, text: sseFrame(finish("run_001", "thread_001")) },
      ],
    },
  },
  "AGUI505-unexpected-content-type": {
    intent: ["AGUI505"],
    scenario: {
      contentType: "application/json",
      chunks: runFrames().map((text) => ({ gapMs: 0, text })),
    },
  },
  "AGUI506-keepalive-gap": {
    intent: ["AGUI506"],
    scenario: {
      contentType: "text/event-stream",
      chunks: [
        { gapMs: 0, text: sseFrame(start("run_001", "thread_001")) },
        ...text("msg_001", "Thinking very hard…").map((e) => ({ gapMs: 0, text: sseFrame(e) })),
        // 47 seconds of silence with no keepalive comment frame.
        { gapMs: 47000, text: sseFrame(finish("run_001", "thread_001")) },
      ],
    },
  },
  "AGUI507-buffered-response": {
    intent: ["AGUI507"],
    scenario: {
      contentType: "text/event-stream",
      // The entire multi-event body arrives as one chunk: a buffering proxy
      // or an unflushed handler, not incremental streaming.
      chunks: [{ gapMs: 0, text: runFrames().join("") }],
    },
  },
  "AGUI508-connection-dropped": {
    intent: ["AGUI508", "AGUI003"],
    scenario: {
      contentType: "text/event-stream",
      chunks: [{ gapMs: 0, text: sseFrame(start("run_001", "thread_001")) }],
      abnormalEof: true,
    },
  },
}

// ---------------------------------------------------------------------------
// Run every stream, verify intent, write files.
// ---------------------------------------------------------------------------

const toLine = (e) => (typeof e === "string" ? e : JSON.stringify(e))

function run(events, options) {
  const v = createValidator(options)
  for (const e of events) v.feed(toLine(e))
  v.finalize()
  return v.report().diagnostics
}

const problems = []
const outputs = []

for (const [name, { intent, events }] of Object.entries(VALID)) {
  const diags = run(events)
  const fired = diags.map((d) => d.rule)
  if (JSON.stringify(fired) !== JSON.stringify(intent)) {
    problems.push(`valid/${name}: intended [${intent}] but fired [${fired}]`)
    continue
  }
  outputs.push({ path: `valid/${name}.jsonl`, content: events.map(toLine).join("\n") + "\n" })
  if (diags.length > 0) {
    outputs.push({ path: `valid/${name}.expected.json`, content: JSON.stringify(diags, null, 2) + "\n" })
  }
}

for (const [dir, { intent, events, options }] of Object.entries(INVALID)) {
  const ruleFromDir = dir.slice(0, 7)
  if (!intent.includes(ruleFromDir)) {
    problems.push(`invalid/${dir}: directory rule ${ruleFromDir} missing from intent [${intent}]`)
    continue
  }
  const diags = run(events, options)
  const fired = diags.map((d) => d.rule)
  if (JSON.stringify(fired) !== JSON.stringify(intent)) {
    problems.push(`invalid/${dir}: intended [${intent}] but fired [${fired}]`)
    continue
  }
  outputs.push({ path: `invalid/${dir}/stream.jsonl`, content: events.map(toLine).join("\n") + "\n" })
  outputs.push({ path: `invalid/${dir}/expected.json`, content: JSON.stringify(diags, null, 2) + "\n" })
  if (options !== undefined) {
    outputs.push({ path: `invalid/${dir}/options.json`, content: JSON.stringify(options, null, 2) + "\n" })
  }
}

async function runScenario(scenario) {
  const encoder = new TextEncoder()
  const clock = { t: 0 }
  async function* chunks() {
    for (const chunk of scenario.chunks) {
      clock.t += chunk.gapMs ?? 0
      yield encoder.encode(chunk.text)
    }
    if (scenario.abnormalEof) throw new Error("connection dropped (simulated)")
  }
  const result = await validateBody(chunks(), scenario.contentType ?? null, {
    now: () => clock.t,
    ...(scenario.options !== undefined ? { validator: scenario.options } : {}),
  })
  return result.report.diagnostics
}

for (const [dir, { intent, scenario }] of Object.entries(TRANSPORT)) {
  const ruleFromDir = dir.slice(0, 7)
  if (!intent.includes(ruleFromDir)) {
    problems.push(`invalid/${dir}: directory rule ${ruleFromDir} missing from intent [${intent}]`)
    continue
  }
  const diags = await runScenario(scenario)
  const fired = diags.map((d) => d.rule)
  if (JSON.stringify(fired) !== JSON.stringify(intent)) {
    problems.push(`invalid/${dir}: intended [${intent}] but fired [${fired}]`)
    continue
  }
  outputs.push({ path: `invalid/${dir}/scenario.json`, content: JSON.stringify(scenario, null, 2) + "\n" })
  outputs.push({ path: `invalid/${dir}/expected.json`, content: JSON.stringify(diags, null, 2) + "\n" })
}

if (problems.length > 0) {
  console.error("REFUSING to write fixtures — intent mismatches:\n" + problems.map((p) => `  - ${p}`).join("\n"))
  process.exit(1)
}

rmSync(`${FIXTURES}valid`, { recursive: true, force: true })
rmSync(`${FIXTURES}invalid`, { recursive: true, force: true })
for (const { path, content } of outputs) {
  const full = FIXTURES + path
  mkdirSync(full.slice(0, full.lastIndexOf("/")), { recursive: true })
  writeFileSync(full, content)
}
console.log(
  `Wrote ${Object.keys(VALID).length} valid + ${Object.keys(INVALID).length + Object.keys(TRANSPORT).length} invalid fixtures (${outputs.length} files, incl. ${Object.keys(TRANSPORT).length} transport scenarios)`,
)
