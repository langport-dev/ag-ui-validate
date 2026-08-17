// Fuzz harness for the never-throws invariant: 50k seeded hostile inputs
// (cyclic objects, functions, symbols, truncated JSON, nested garbage) across
// fresh validator instances. Exits 1 on any throw or recorded internal error.
// Run `npm run build` first, then `npm run fuzz`.

let createValidator
try {
  ;({ createValidator } = await import("../../dist/index.js"))
} catch {
  console.error("dist/ not found — run `npm run build` first")
  process.exit(2)
}

let seed = Number(process.argv[2] ?? 42)
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
const pick = (a) => a[Math.floor(rnd() * a.length)]

const types = [
  "RUN_STARTED", "RUN_FINISHED", "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT",
  "TOOL_CALL_START", "STATE_DELTA", "STATE_SNAPSHOT", "CUSTOM", "RAW",
  "BOGUS", "runStarted", "META", "",
]
const vals = () =>
  pick([null, undefined, 0, -1, 3.14, NaN, "", "x", true, [], {}, [[]], { a: { b: { c: { d: {} } } } }, "null", () => {}, Symbol("s")])

function randomEvent(depth = 0) {
  const r = rnd()
  if (r < 0.15) return vals()
  if (r < 0.3) {
    const s = JSON.stringify({ type: pick(types), messageId: "m", delta: "d" })
    return s.slice(0, Math.floor(rnd() * s.length)) // truncated JSON
  }
  const e = { type: pick(types) }
  const keys = ["messageId", "toolCallId", "delta", "runId", "threadId", "stepName",
    "snapshot", "timestamp", "name", "value", "event", "outcome", "parentMessageId", "messages"]
  for (const k of keys) {
    if (rnd() < 0.4) e[k] = depth < 2 && rnd() < 0.2 ? randomEvent(depth + 1) : vals()
  }
  if (rnd() < 0.1) e.self = e // cyclic
  if (rnd() < 0.5) return e
  try { return JSON.stringify(e) } catch { return e }
}

const N = 50_000
let throws = 0
let internal = 0
let v = createValidator()
for (let i = 0; i < N; i++) {
  if (i % 500 === 0) {
    v.finalize()
    internal += v.report().internalErrors.length
    v = createValidator({ features: ["shared-state"], severityOverrides: { AGUI902: "off" } })
  }
  try {
    v.feed(randomEvent())
  } catch (e) {
    throws++
    if (throws <= 3) console.error("THREW:", e)
  }
}
v.finalize()
internal += v.report().internalErrors.length

console.log(`fuzz(seed=${process.argv[2] ?? 42}): ${N} hostile inputs — ${throws} throws, ${internal} internal errors`)
if (throws > 0 || internal > 0) process.exit(1)
console.log("NEVER-THROWS INVARIANT HOLDS")
