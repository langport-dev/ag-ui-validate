# Testing guide

How to verify every component of `ag-ui-validate` individually. Each layer has
its own tests, plus scripted checks for the things unit tests can't cover
(live networks, external URLs, packaging).

## Everything at once

```bash
npm ci             # clean install from the lockfile (what CI does)
npm run typecheck  # two passes: src-only with zero Node/DOM types, then all
npm run build      # tsdown dual ESM/CJS + declarations, plus the CLI bin
npm test           # the full vitest suite (~370 tests)
```

Build before test: the CLI integration suite spawns `dist/cli.js` (it skips
loudly when missing). Scripts under `scripts/` also import from `dist/`.

---

## 1. Scaffold & packaging (M0)

| What | How |
|---|---|
| Reproducible from lockfile | `rm -rf node_modules dist && npm ci && npm run typecheck && npm run build && npm test` |
| Exports map correctness | `npx publint` — checks main/module/exports consistency against the packed tarball |
| Type resolution everywhere | `npx @arethetypeswrong/cli --pack .` — must be green for node10 / node16-cjs / node16-esm / bundler, for `.`, `./transport`, and `./report` |
| Both module systems load | `node -e "require('./dist/index.cjs')"` and `node --input-type=module -e "import('./dist/index.js')"` |

## 2. Protocol grounding (M1)

The canonical event table ([src/protocol/event-table.ts](../src/protocol/event-table.ts))
is generated from `@ag-ui/core`'s zod schemas and checked in.

| What | How |
|---|---|
| Table matches the installed SDK | `npx vitest run test/protocol-drift.test.ts` — re-derives from `@ag-ui/core` and deep-compares. Fails after an SDK bump until you regenerate. |
| Regeneration is deterministic | `npm run build && npm run protocol:derive && git diff --exit-code src/protocol/event-table.ts` |
| Our validity = the SDK's validity | `npx vitest run test/sdk-alignment.test.ts` — every `fixtures/valid/` event must parse with the SDK's own `EventSchemas`; schema-violation fixtures must be rejected by the SDK; sequencing-violation fixtures must be accepted by it (that gap is the reason this validator exists). |

After bumping `@ag-ui/core`: `npm run protocol:derive`, review the diff, check
whether new event types need catalog rules, run the drift test.

## 3. Rule catalog (M2)

| What | How |
|---|---|
| Catalog invariants | `npx vitest run test/catalog.test.ts` — ids unique and well-formed, every rule cites an https `specUrl`, every `specQuestion` resolves to a section in [spec-questions.md](spec-questions.md), every rule has a fixture directory whose `expected.json` fires it |
| Spec links actually resolve | `npm run links:check` — fetches every unique `specUrl` (catalog + event table), verifies HTTP 200 and that each `#anchor` exists in the page HTML. Network-dependent, so it's a script, not a test. Run before releases and after docs.ag-ui.com restructures. |

## 4. Core state machine (M3)

| What | How |
|---|---|
| Per-rule-group behavior | `npx vitest run test/validator/` — one file per group: `lifecycle` (AGUI0xx), `text` (1xx), `toolcalls` (2xx), `state` (3xx), `reasoning` (4xx), `engine` (502/503/504, hygiene 9xx, overrides, report, multi-run), `layers` (layers option + emitExternal), `jsonpatch` (RFC 6902, incl. the RFC's appendix A examples) |
| One group only | e.g. `npx vitest run test/validator/toolcalls.test.ts` |
| Never-throws invariant | `npm run fuzz` — 50k seeded hostile inputs (cyclic objects, functions, symbols, truncated JSON); exits 1 on any throw or internal error. Vary the seed: `node scripts/fuzz.mjs 1234` |
| Isomorphism / purity | `npx vitest run test/purity.test.ts` — statically bans I/O, clocks, randomness, and platform globals from the core, and Node built-ins from all of `src/`. Also enforced at compile time: `tsc -p tsconfig.src.json` compiles `src/` with **no** Node type definitions. |
| Eyeball it | `npm run demo` — a deliberately broken stream, pretty-printed findings |

## 5. Fixture corpus (M4)

| What | How |
|---|---|
| Corpus runs clean | `npx vitest run test/fixtures.test.ts` — every `invalid/` dir must produce exactly its `expected.json` (and fire its namesake rule); every `valid/` stream must produce exactly its expected findings (usually none); valid fixtures must collectively cover every rule category |
| Regeneration is deterministic and honest | `npm run fixtures:build && git diff --exit-code fixtures/` — the generator declares each stream's *intended* rules independently of the validator and refuses to write on mismatch, so `expected.json` can never silently absorb an implementation bug |
| One fixture by hand | `npx vitest run test/fixtures.test.ts -t AGUI203` |

Adding a rule = add the catalog entry, add its stream + intent to
[scripts/build-fixtures.mjs](../scripts/build-fixtures.mjs), regenerate. The
catalog meta-test fails until the fixture exists.

## 6. Transport layer (M5)

| What | How |
|---|---|
| SSE parser (WHATWG framing) | `npx vitest run test/transport/sse.test.ts` — chunk-boundary reassembly, CR/CRLF/LF, split CRLF hold-back, BOM, split multi-byte UTF-8, comments, missing `data:` prefix, truncated frames |
| NDJSON splitter | `npx vitest run test/transport/ndjson.test.ts` |
| Orchestration with mocks | `npx vitest run test/transport/endpoint.test.ts` — AGUI505/506/507/508 via injectable fetch + clock, format sniffing, default `RunAgentInput`, `TransportError` on non-2xx |
| **Real HTTP, no mocks** | `npm run e2e` — starts a loopback `node:http` server with eight endpoint personalities (clean SSE, clean NDJSON, missing prefix, wrong content-type, buffered single-write, mid-run socket destroy, live protocol bug, HTTP 503) and asserts `validateEndpoint` produces exactly the expected findings for each. Also validates the `RunAgentInput` we POST against `@ag-ui/core`'s schema. Exits 1 on any mismatch. |
| Against your own agent | `node -e "import('./dist/transport.js').then(async ({validateEndpoint}) => console.log(JSON.stringify((await validateEndpoint('http://localhost:8000/agui')).report.summary)))"` |

The five transport fixtures (`fixtures/invalid/AGUI50*/scenario.json`) replay
HTTP bodies as timed byte chunks with a simulated clock — see
[fixtures/README.md](../fixtures/README.md) for the replay protocol.

---

## 7. CLI (M6)

| What | How |
|---|---|
| Argument parser (pure) | `npx vitest run test/cli/args.test.ts` — every flag in both `--flag value` and `--flag=value` forms, error messages, exit-code policy |
| Reporters (pure) | `npx vitest run test/report/reporters.test.ts` — pretty lines/summary, JSON document, SARIF 2.1.0 (level mapping, `helpUri`, line regions), JUnit XML escaping |
| Recorded-input mode | `npx vitest run test/transport/recorded.test.ts` — timing rules skipped-with-reason on captures, SSE framing still checked, read failures are tool failures |
| **The real binary** | `npm run build && npx vitest run test/cli/integration.test.ts` — spawns `dist/cli.js` against fixtures: exit codes 0/1/2, stdin, `--json`/`--sarif` parse, `--off` silences. Skipped (loudly) if `dist/cli.js` is missing |
| By hand | `node dist/cli.js fixtures/invalid/AGUI203-unterminated-tool-call/stream.jsonl` (exit 1), `cat fixtures/valid/agentic-chat.jsonl \| node dist/cli.js -` (exit 0), `node dist/cli.js <your-endpoint-url>` |

---

## What must never regress

- **The core never throws** on any input (`npm run fuzz`, hostile-object tests
  in `engine.test.ts`).
- **The core stays pure** — zero runtime deps, zero I/O, no clocks
  (`test/purity.test.ts` + `tsconfig.src.json`). `src/cli.ts` is the one
  deliberate Node-only file; the purity test asserts nothing else imports it.
- **Every diagnostic cites the spec** (`test/catalog.test.ts`,
  `npm run links:check`).
- **Every rule has corpus coverage** (`test/catalog.test.ts` meta-test).
- **Valid means valid to the SDK too** (`test/sdk-alignment.test.ts`).
