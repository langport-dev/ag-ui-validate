// End-to-end check of the transport layer against a REAL HTTP server on
// loopback — no mocks: real sockets, real chunked delivery, a real mid-run
// socket destroy. Also validates the RunAgentInput we POST against
// @ag-ui/core's schema. Exits 1 if any endpoint produces unexpected findings.
// Run `npm run build` first, then `npm run e2e`.

import { createServer } from "node:http"
import { createRequire } from "node:module"

let validateEndpoint, TransportError
try {
  ;({ validateEndpoint, TransportError } = await import("../dist/transport.js"))
} catch {
  console.error("dist/ not found — run `npm run build` first")
  process.exit(2)
}
const require = createRequire(import.meta.url)
const core = require("@ag-ui/core")

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const frame = (o) => `data: ${JSON.stringify(o)}\n\n`
const RUN = [
  { type: "RUN_STARTED", threadId: "t1", runId: "r1", timestamp: 1 },
  { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant", timestamp: 2 },
  { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "hello from a real server", timestamp: 3 },
  { type: "TEXT_MESSAGE_END", messageId: "m1", timestamp: 4 },
  { type: "RUN_FINISHED", threadId: "t1", runId: "r1", timestamp: 5 },
]

let lastInputValidation = null

const server = createServer(async (req, res) => {
  let body = ""
  for await (const c of req) body += c
  if (req.method === "POST") {
    const check = core.RunAgentInputSchema.safeParse(JSON.parse(body))
    lastInputValidation = check.success
      ? "SDK-VALID"
      : "SDK-INVALID: " + check.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")
  }

  switch (req.url) {
    case "/good-sse": {
      res.writeHead(200, { "content-type": "text/event-stream" })
      for (const e of RUN) { res.write(frame(e)); await sleep(5) }
      res.end()
      break
    }
    case "/good-ndjson": {
      res.writeHead(200, { "content-type": "application/x-ndjson" })
      for (const e of RUN) { res.write(`${JSON.stringify(e)}\n`); await sleep(5) }
      res.end()
      break
    }
    case "/missing-prefix": {
      res.writeHead(200, { "content-type": "text/event-stream" })
      res.write(frame(RUN[0])); await sleep(5)
      // The classic broken server: a payload with no "data:" prefix.
      res.write(`${JSON.stringify({ type: "CUSTOM", name: "acme.ping", value: 1, timestamp: 2 })}\n\n`); await sleep(5)
      for (const e of RUN.slice(1)) { res.write(frame(e)); await sleep(5) }
      res.end()
      break
    }
    case "/wrong-content-type": {
      res.writeHead(200, { "content-type": "application/json" })
      for (const e of RUN) { res.write(frame(e)); await sleep(5) }
      res.end()
      break
    }
    case "/buffered": {
      res.writeHead(200, { "content-type": "text/event-stream" })
      res.end(RUN.map(frame).join("")) // one write, never incrementally flushed
      break
    }
    case "/drop": {
      res.writeHead(200, { "content-type": "text/event-stream" })
      res.write(frame(RUN[0])); await sleep(5)
      res.write(frame(RUN[1])); await sleep(5)
      res.destroy() // mid-run connection failure
      break
    }
    case "/protocol-bugs": {
      res.writeHead(200, { "content-type": "text/event-stream" })
      res.write(frame({ type: "RUN_STARTED", threadId: "t1", runId: "r9", timestamp: 1 })); await sleep(5)
      res.write(frame({ type: "TOOL_CALL_START", toolCallId: "call_7", toolCallName: "x", timestamp: 2 })); await sleep(5)
      res.write(frame({ type: "RUN_FINISHED", threadId: "t1", runId: "r9", timestamp: 3 }))
      res.end()
      break
    }
    default: {
      res.writeHead(503, { "content-type": "text/plain" })
      res.end("nope")
    }
  }
})

await new Promise((r) => server.listen(0, "127.0.0.1", r))
const base = `http://127.0.0.1:${server.address().port}`

// endpoint -> exactly the rules it must fire
const EXPECT = {
  "good-sse": [],
  "good-ndjson": [],
  "missing-prefix": ["AGUI501"],
  "wrong-content-type": ["AGUI505"],
  "buffered": ["AGUI507"],
  "drop": ["AGUI508", "AGUI003", "AGUI103"],
  "protocol-bugs": ["AGUI203"],
}

let failures = 0
for (const [route, expected] of Object.entries(EXPECT)) {
  const result = await validateEndpoint(`${base}/${route}`)
  const fired = result.report.diagnostics.map((d) => d.rule)
  const ok = JSON.stringify(fired) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(
    (ok ? "PASS" : "FAIL"),
    route.padEnd(20),
    `events=${String(result.eventCount).padEnd(3)}`,
    `findings=[${fired.join(",") || "none"}]`,
    ok ? "" : `expected=[${expected.join(",")}]`,
  )
}

if (lastInputValidation !== "SDK-VALID") {
  failures++
  console.log("FAIL RunAgentInput:", lastInputValidation)
} else {
  console.log("PASS POSTed RunAgentInput validates against @ag-ui/core")
}

try {
  await validateEndpoint(`${base}/http-error`)
  failures++
  console.log("FAIL http-error: expected TransportError, none thrown")
} catch (e) {
  const ok = e instanceof TransportError && /503/.test(e.message)
  if (!ok) failures++
  console.log(ok ? "PASS" : "FAIL", "http-error".padEnd(20), String(e.message ?? e))
}

server.close()
if (failures > 0) {
  console.error(`\n${failures} e2e check(s) failed`)
  process.exit(1)
}
console.log("\nall live-transport checks passed")
