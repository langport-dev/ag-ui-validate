// Human-eyeball demo: feeds a deliberately broken stream through the core and
// pretty-prints the findings. Run `npm run build` first, then `npm run demo`.

let createValidator
try {
  ;({ createValidator } = await import("../../dist/index.js"))
} catch {
  console.error("dist/ not found — run `npm run build` first")
  process.exit(2)
}

const stream = [
  { type: "RUN_STARTED", threadId: "t1", runId: "run_42", timestamp: 1 },
  { type: "TEXT_MESSAGE_CONTENT", messageId: "msg_9", delta: "orphan content", timestamp: 2 },
  { type: "TOOL_CALL_START", toolCallId: "call_7", toolCallName: "get_weather", timestamp: 3 },
  { type: "TOOL_CALL_ARGS", toolCallId: "call_7", delta: '{"city": "Berl', timestamp: 4 },
  { type: "STATE_SNAPSHOT", snapshot: { items: [] }, timestamp: 5 },
  { type: "STATE_DELTA", delta: [{ op: "replace", path: "/items/3", value: "x" }], timestamp: 6 },
  "this line is not JSON at all",
  { type: "runFinished", threadId: "t1", runId: "run_42" },
  { type: "RUN_FINISHED", threadId: "t1", runId: "run_42", timestamp: 8 },
]

const v = createValidator()
for (const e of stream) v.feed(typeof e === "string" ? e : JSON.stringify(e))
v.finalize()

const { diagnostics, summary, features } = v.report()
const icon = { error: "✖", warning: "⚠", info: "ℹ" }
for (const d of diagnostics) {
  const loc = d.eventIndex === -1 ? "  —  " : `event ${d.eventIndex}`
  console.log(icon[d.severity], d.rule, " ", d.severity.padEnd(7), loc, " ", d.message)
}
const exercised = Object.entries(features)
  .filter(([, s]) => s === "exercised")
  .map(([f]) => f)
console.log(
  `\n${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info — features exercised: ${exercised.join(", ")}`,
)
