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
loudly when missing). Scripts under `js/scripts/` also import from `dist/`.

The JS implementation lives under [js/](../js/) (`js/src/`, `js/test/`,
`js/scripts/`) — `spec/`, `dist/`, and `package.json` itself stay at the repo
root. `scripts/` at the repo root (not `js/scripts/`) holds tooling that does
repo-wide, language-neutral work despite being written in Node —
[`generate-rule-docs.mjs`](../scripts/generate-rule-docs.mjs) (reads `spec/`,
writes `docs/`) and [`check-spec-links.mjs`](../scripts/check-spec-links.mjs)
(reads `spec/catalog.json` + `spec/event-categories.json` directly; the
event-table specUrls it checks are a deterministic function of wire type +
category, so no SDK build is needed at all) — neither has a JS-build
dependency, so both stay put even when a Python implementation lands, unlike
`js/scripts/`'s other tools, which all depend on `dist/` or `@ag-ui/core`'s
zod schemas. The `npm run <script>` commands below all work unchanged from
the repo root; to run a single test file directly, use
`npm test -- <path-under-js/test>`
(shown per-suite below) rather than a bare `npx vitest`, since vitest needs
`js/vitest.config.ts` to find `js/test/`.

Node 22+ throughout: tsdown (the build tool) uses ES2024 APIs, and `engines`
declares `>=22` since Node 20 reached end-of-life in April 2026.

---

## 1. Scaffold & packaging (M0)

| What | How |
|---|---|
| Reproducible from lockfile | `rm -rf node_modules dist && npm ci && npm run typecheck && npm run build && npm test` |
| Exports map correctness | `npx publint` — checks main/module/exports consistency against the packed tarball |
| Type resolution everywhere | `npx @arethetypeswrong/cli --pack .` — must be green for node10 / node16-cjs / node16-esm / bundler, for `.`, `./transport`, and `./report`. Known exception: `./vitest` is ESM-only (vitest itself cannot be `require`d), so its node16-from-CJS cell shows "resolution failed" by design |
| Both module systems load | `node -e "require('./dist/index.cjs')"` and `node --input-type=module -e "import('./dist/index.js')"` |

## 2. Protocol grounding (M1)

The canonical event table ([js/src/protocol/event-table.ts](../js/src/protocol/event-table.ts))
is generated from `@ag-ui/core`'s zod schemas and checked in.

| What | How |
|---|---|
| Table matches the installed SDK | `npm test -- test/protocol-drift.test.ts` — re-derives from `@ag-ui/core` and deep-compares. Fails after an SDK bump until you regenerate. |
| Regeneration is deterministic | `npm run build && npm run protocol:derive && git diff --exit-code js/src/protocol/event-table.ts` |
| Our validity = the SDK's validity | `npm test -- test/sdk-alignment.test.ts` — every `spec/fixtures/valid/` event must parse with the SDK's own `EventSchemas`; schema-violation fixtures must be rejected by the SDK; sequencing-violation fixtures must be accepted by it (that gap is the reason this validator exists). |

After bumping `@ag-ui/core`: `npm run protocol:derive`, review the diff, check
whether new event types need catalog rules, run the drift test.

## 3. Rule catalog (M2)

| What | How |
|---|---|
| Catalog invariants | `npm test -- test/catalog.test.ts` — ids unique and well-formed, every rule cites an https `specUrl`, every `specQuestion` resolves to a section in [spec-questions.md](spec-questions.md), every rule has a fixture directory whose `expected.json` fires it |
| Spec links actually resolve | `npm run links:check` — fetches every unique `specUrl` (catalog + event table), verifies HTTP 200 and that each `#anchor` exists in the page HTML. Network-dependent, so it's a script, not a test. Run before releases and after docs.ag-ui.com restructures. |

## 4. Core state machine (M3)

| What | How |
|---|---|
| Per-rule-group behavior | `npm test -- test/validator/` — one file per group: `lifecycle` (AGUI0xx), `text` (1xx), `toolcalls` (2xx), `state` (3xx), `reasoning` (4xx), `engine` (502/503/504, hygiene 9xx, overrides, report, multi-run), `layers` (layers option + emitExternal), `jsonpatch` (RFC 6902, incl. the RFC's appendix A examples) |
| One group only | e.g. `npm test -- test/validator/toolcalls.test.ts` |
| Never-throws invariant | `npm run fuzz` — 50k seeded hostile inputs (cyclic objects, functions, symbols, truncated JSON); exits 1 on any throw or internal error. Vary the seed: `node js/scripts/fuzz.mjs 1234` |
| Isomorphism / purity | `npm test -- test/purity.test.ts` — statically bans I/O, clocks, randomness, and platform globals from the core, and Node built-ins from all of `js/src/`. Also enforced at compile time: `tsc -p js/tsconfig.src.json` compiles `js/src/` with **no** Node type definitions. |
| Eyeball it | `npm run demo` — a deliberately broken stream, pretty-printed findings |

## 5. Fixture corpus (M4)

| What | How |
|---|---|
| Corpus runs clean | `npm test -- test/fixtures.test.ts` — every `invalid/` dir must produce exactly its `expected.json` (and fire its namesake rule); every `valid/` stream must produce exactly its expected findings (usually none); valid fixtures must collectively cover every rule category |
| Regeneration is deterministic and honest | `npm run fixtures:build && git diff --exit-code spec/fixtures/` — the generator declares each stream's *intended* rules independently of the validator and refuses to write on mismatch, so `expected.json` can never silently absorb an implementation bug |
| One fixture by hand | `npm test -- test/fixtures.test.ts -t AGUI203` |

Adding a rule = add the catalog entry, add its stream + intent to
[js/scripts/build-fixtures.mjs](../js/scripts/build-fixtures.mjs), regenerate. The
catalog meta-test fails until the fixture exists.

## 6. Transport layer (M5)

| What | How |
|---|---|
| SSE parser (WHATWG framing) | `npm test -- test/transport/sse.test.ts` — chunk-boundary reassembly, CR/CRLF/LF, split CRLF hold-back, BOM, split multi-byte UTF-8, comments, missing `data:` prefix, truncated frames |
| NDJSON splitter | `npm test -- test/transport/ndjson.test.ts` |
| Orchestration with mocks | `npm test -- test/transport/endpoint.test.ts` — AGUI505/506/507/508 via injectable fetch + clock, format sniffing, default `RunAgentInput`, `TransportError` on non-2xx |
| **Real HTTP, no mocks** | `npm run e2e` — starts a loopback `node:http` server with eight endpoint personalities (clean SSE, clean NDJSON, missing prefix, wrong content-type, buffered single-write, mid-run socket destroy, live protocol bug, HTTP 503) and asserts `validateEndpoint` produces exactly the expected findings for each. Also validates the `RunAgentInput` we POST against `@ag-ui/core`'s schema. Exits 1 on any mismatch. |
| Against your own agent | `node -e "import('./dist/transport.js').then(async ({validateEndpoint}) => console.log(JSON.stringify((await validateEndpoint('http://localhost:8000/agui')).report.summary)))"` |

The five transport fixtures (`spec/fixtures/invalid/AGUI50*/scenario.json`) replay
HTTP bodies as timed byte chunks with a simulated clock — see
[spec/fixtures/README.md](../spec/fixtures/README.md) for the replay protocol.

---

## 7. CLI (M6)

| What | How |
|---|---|
| Argument parser (pure) | `npm test -- test/cli/args.test.ts` — every flag in both `--flag value` and `--flag=value` forms, error messages, exit-code policy |
| Reporters (pure) | `npm test -- test/report/reporters.test.ts` — pretty lines/summary, JSON document, SARIF 2.1.0 (level mapping, `helpUri`, line regions), JUnit XML escaping |
| Recorded-input mode | `npm test -- test/transport/recorded.test.ts` — timing rules skipped-with-reason on captures, SSE framing still checked, read failures are tool failures |
| **The real binary** | `npm run build && npm test -- test/cli/integration.test.ts` — spawns `dist/cli.js` against fixtures: exit codes 0/1/2, stdin, `--json`/`--sarif` parse, `--off` silences. Skipped (loudly) if `dist/cli.js` is missing |
| By hand | `node dist/cli.js spec/fixtures/invalid/AGUI203-unterminated-tool-call/stream.jsonl` (exit 1), `cat spec/fixtures/valid/agentic-chat.jsonl \| node dist/cli.js -` (exit 0), `node dist/cli.js <your-endpoint-url>` |

---

## 8. Vitest matcher (M7)

| What | How |
|---|---|
| Matcher behavior | `npm test -- test/vitest/matcher.test.ts` — pass/fail semantics, `.not`, options forwarding, `maxWarnings`, JSONL string input, failure-message content, invalid-usage TypeError |
| **As a real consumer** | `npm pack` the tarball into a scratch project, `npm install <tarball> vitest`, write a test with `import "ag-ui-validate/vitest"`, run `vitest` (runtime) and `tsc --noEmit` (the `Matchers` augmentation) — both must pass with zero project-side setup |

---

## 9. GitHub Action (M8)

| What | How |
|---|---|
| Driver, GitHub-style | `npm test -- test/action/run.test.ts` — spawns `action/run.mjs` with `INPUT_*` env vars and temp `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` files, exactly as the composite step does; asserts exit codes, outputs, summary markdown, SARIF file |
| In a real workflow | the `action-self-test` job in `.github/workflows/ci.yml` runs `uses: ./action` (with `version: local`) against a valid and an invalid fixture on every push and asserts outcome + outputs + SARIF |

The action is a thin wrapper: one CLI invocation using the `--*-file` flags,
so the reporters themselves are covered by the reporter and CLI suites.

---

## 10. Rule docs + llms.txt (M9)

| What | How |
|---|---|
| Pages complete & grounded | `npm test -- test/docs.test.ts` — every catalog rule has a `docs/rules/AGUI###.md` with title, severity, spec URL, verbatim spec quote (when one exists), an example from the fixture corpus, and its SQ link when the spec is ambiguous; the index and `llms.txt` list all 40 |
| No drift | `npm run docs:check` — regenerates everything in memory and fails on any byte difference or stray hand-written page (also part of the test above) |
| Regenerate | `npm run docs:generate` after editing the catalog or fixtures |

---

## What must never regress

- **The core never throws** on any input (`npm run fuzz`, hostile-object tests
  in `engine.test.ts`).
- **The core stays pure** — zero runtime deps, zero I/O, no clocks
  (`js/test/purity.test.ts` + `js/tsconfig.src.json`). `js/src/cli.ts` is the
  one deliberate Node-only file; the purity test asserts nothing else imports
  it.
- **Every diagnostic cites the spec** (`js/test/catalog.test.ts`,
  `npm run links:check`).
- **Every rule has corpus coverage** (`js/test/catalog.test.ts` meta-test).
- **Valid means valid to the SDK too** (`js/test/sdk-alignment.test.ts`).
