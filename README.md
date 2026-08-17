# ag-ui-validate

Conformance validator for the [AG-UI protocol](https://docs.ag-ui.com)
(Agent–User Interaction Protocol). Point it at an AG-UI endpoint — or feed it
a recorded event stream — and it reports every way the stream violates the
protocol, with a rule ID, a severity, a location, and a link to the governing
spec section.

```
✖ AGUI203  error  event 42  TOOL_CALL_START id 'call_7' never terminated
✖ AGUI302  error  event 51  STATE_DELTA failed to apply: /items/3: '3' is not a valid index for an array of length 0
✖ AGUI503  error  event 60  Unknown event type 'runStarted' — did you mean 'RUN_STARTED'?
ℹ AGUI902  info   —         None of the 61 events carry the optional timestamp property

2 errors, 0 warnings, 1 info — 3 of 7 AG-UI features exercised
```

> **Status: pre-release.** The core validator, the language-neutral fixture
> corpus, and the transport layer are implemented and tested. The CLI
> (`npx ag-ui-validate <url|->`), the Vitest matcher, and SARIF/JUnit
> reporters are in progress.

## Why

AG-UI has SDKs and integrations, but no conformance tooling: nothing tells an
implementer *your stream is subtly wrong, here's the rule and the spec
section*. This project is that tool — the AG-UI analogue of what
[a2a-inspector](https://github.com/a2aproject/a2a-inspector) is for A2A.

Three design commitments make it trustworthy:

- **Every diagnostic cites the spec.** Each of the 40 rules carries a
  `specUrl` (and where possible an exact `specQuote`) pointing at the
  governing section of [docs.ag-ui.com](https://docs.ag-ui.com) or the WHATWG
  SSE spec. Behaviour the spec doesn't clearly govern is reported at `info`
  severity at most, and logged in
  [docs/spec-questions.md](docs/spec-questions.md) for filing upstream.
- **The validator never throws.** Broken input is its input. Malformed JSON,
  unknown event types, hostile objects — all diagnostics, never exceptions
  (fuzz-tested against 50k hostile inputs).
- **False positives are treated as worse than false negatives.** The rules are
  grounded in `@ag-ui/core` v0.0.58 and the current docs; where the two
  disagree, the SDK wins and the discrepancy is recorded.

## Quickstart

```bash
npm install --save-dev ag-ui-validate
```

### CLI

```bash
npx ag-ui-validate http://localhost:8000/agui   # live endpoint (POSTs a RunAgentInput)
npx ag-ui-validate run.jsonl                    # recorded stream (NDJSON/JSONL or SSE capture)
cat run.jsonl | npx ag-ui-validate -            # stdin
```

Exit codes: `0` clean, `1` findings at error level (or warnings over
`--max-warnings`), `2` tool failure. Timing-based transport rules are
meaningless for recordings, so they are reported as *skipped with a reason*
rather than risking false positives.

Useful flags (see `--help` for all):

| Flag | Effect |
| --- | --- |
| `--json` / `--sarif` / `--junit` | machine-readable report on stdout (SARIF 2.1.0 for code scanning, JUnit XML for CI) |
| `--group` | one line per rule with a count — for large streams with repeated findings (totals stay exact) |
| `--rule AGUI105=error`, `--off AGUI902` | per-rule severity overrides |
| `--features shared-state,...` | declare exercised features (enables e.g. AGUI305) |
| `--max-warnings 0` | fail CI on any warning |
| `--header "Authorization: Bearer …"`, `--timeout 30` | endpoint options |

### Validate in CI (GitHub Action)

```yaml
- uses: langport-dev/ag-ui-validate/action@main
  with:
    target: http://localhost:8000/agui   # or a recorded .jsonl file
    sarif-file: agui.sarif               # optional: upload via codeql-action
```

The step fails on error-severity findings, writes a findings table to the job
summary, and exposes `errors`/`warnings`/`info` outputs — see
[action/README.md](action/README.md).

### Test your agent in Vitest

```ts
import "ag-ui-validate/vitest" // registers the matcher (put it in setupFiles)

it("streams a conformant run", async () => {
  const events = await captureRunEvents(myAgent) // however you record them
  expect(events).toBeValidAGUI()
})
```

The matcher takes an array of events (objects or JSON strings) or a whole
JSONL capture as one string. Failures print each finding with its rule ID and
spec link. Options mirror the validator:
`{ features, severityOverrides, maxWarnings }` — e.g.
`expect(events).toBeValidAGUI({ maxWarnings: 0 })` to fail on warnings too.
The raw matcher function is also exported, so Jest users can
`expect.extend({ toBeValidAGUI })` themselves.

### Validate recorded events (pure, runs anywhere)

```ts
import { createValidator } from "ag-ui-validate"

const v = createValidator({
  features: ["shared-state"],            // optional: enables feature-specific rules
  severityOverrides: { AGUI902: "off" }, // optional: tune or disable rules
})

for (const event of events) {
  // feed parsed objects or raw JSON strings — bad JSON is a diagnostic
  const diagnostics = v.feed(event)      // findings, as soon as detectable
}
v.finalize()                             // end-of-stream checks

const { diagnostics, summary, features, skipped } = v.report()
```

The core is a pure function over an event sequence: zero I/O, zero runtime
dependencies, isomorphic across Node 20+, browsers, Deno, and Workers.

### Validate a live endpoint

```ts
import { validateEndpoint } from "ag-ui-validate/transport"

const { report, status, eventCount } = await validateEndpoint(
  "http://localhost:8000/agui",
  {
    headers: { authorization: "Bearer …" },
    onDiagnostic: (d) => console.error(`${d.severity} ${d.rule} ${d.message}`),
  },
)
```

The transport layer POSTs a minimal `RunAgentInput`, consumes the SSE or
NDJSON response, streams every frame through the core, and additionally
evaluates the transport-level rules that recorded input can't exercise: SSE
framing (including the classic missing-`data:`-prefix bug), Content-Type,
keepalive gaps, buffered-not-flushed responses, and mid-run disconnects.

### Render a report

The CLI's output formats are plain functions over a `Report`, importable for
your own tooling:

```ts
import { formatReportSummary, toSarif, toJUnit } from "ag-ui-validate/report"
```

### Diagnostic shape

```jsonc
{
  "rule": "AGUI203",
  "severity": "error",            // "error" | "warning" | "info"
  "message": "TOOL_CALL_START id 'call_7' never terminated",
  "eventIndex": 42,               // 0-based; -1 for end-of-stream findings
  "eventType": "RUN_FINISHED",    // optional
  "pointer": "/toolCallId",       // optional RFC 6901 pointer into the event
  "relatedEventIndex": 17,        // optional, e.g. the unterminated start
  "specUrl": "https://docs.ag-ui.com/concepts/events#tool-call-events"
}
```

## The rule catalog

40 rules, maintained as **data** in
[src/rules/catalog.json](src/rules/catalog.json) so other implementations
(Python, Go, …) can share them. Every rule has its own page — spec grounding,
severity, and a violating example from the corpus — in the
**[rule index](docs/rules/README.md)** (generated from the catalog,
drift-checked in CI):

| Group | IDs | Examples |
|---|---|---|
| Lifecycle | AGUI001–008 | run must start with `RUN_STARTED`, terminate with `RUN_FINISHED`/`RUN_ERROR`, nothing after a terminal event |
| Text messages | AGUI101–106 | content without start, unterminated messages, duplicate `messageId` |
| Tool calls | AGUI201–208 | unterminated calls, args that don't concatenate to valid JSON, results referencing unknown calls |
| State | AGUI301–305 | RFC 6902 patch validity, deltas that fail to apply to reconstructed state |
| Reasoning | AGUI401–402 | reasoning content without an open reasoning message |
| Transport | AGUI501–508 | SSE framing, Content-Type, keepalive gaps, buffering, dropped connections |
| Hygiene | AGUI901–903 | `RAW`-wrapping typed events, missing timestamps, un-namespaced `CUSTOM` names |

The event taxonomy itself (33 wire types, field schemas) is derived from
[`@ag-ui/core`](https://www.npmjs.com/package/@ag-ui/core)'s own schemas and
drift-tested against the installed SDK on every run.

## The fixture corpus

[fixtures/](fixtures/README.md) is a language-neutral conformance corpus:
7 valid streams (one per canonical AG-UI feature — the false-positive guards)
and 40 invalid fixtures (one per rule) with exact expected diagnostics. Any
validator implementation that consumes the shared catalog can be tested
against it; the replay protocol is documented in the corpus README.

## Development

```bash
npm ci
npm run typecheck   # includes a src-only pass proving the core uses no Node APIs
npm run build       # dual ESM/CJS via tsdown
npm test            # full suite: unit + corpus + drift + purity + SDK alignment
npm run demo        # pretty-printed findings for a deliberately broken stream
npm run e2e         # live-transport checks against a real local HTTP server
npm run fuzz        # 50k hostile inputs against the never-throws invariant
npm run links:check # every specUrl resolves and every anchor exists
```

Component-by-component instructions live in
[docs/TESTING.md](docs/TESTING.md). Spec ambiguities found while grounding the
rules are tracked in [docs/spec-questions.md](docs/spec-questions.md).

Adding a rule: add the catalog entry (with its `specUrl`), add the fixture
stream + intended findings to `scripts/build-fixtures.mjs`, and run
`npm run fixtures:build` — the meta-tests fail until both exist. Rule
*proposals* belong upstream as issues on
[`ag-ui-protocol/ag-ui`](https://github.com/ag-ui-protocol/ag-ui) first; this
project does not invent rules the spec doesn't support.

Releasing: merge the pending changesets (`npx changeset version`) via a PR,
then publish a GitHub release tagged `vX.Y.Z` (matching `package.json`) — the
[Publish workflow](.github/workflows/publish.yml) typechecks, builds, tests,
and publishes to npm with provenance via trusted publishing. The workflow
fails fast if the tag and `package.json` disagree.

## License

MIT — maintained by [Faraz](https://langport.dev).
