# Testing guide

How to verify every component of `ag-ui-validate` individually, in both
implementations — the original TypeScript one and the native Python port
(see [docs/PYTHON-PORT-PLAN.md](PYTHON-PORT-PLAN.md) for the port's
milestone history). Each layer has its own tests, plus scripted checks for
the things unit tests can't cover (live networks, external URLs,
packaging).

## Everything at once

TypeScript:

```bash
npm ci             # clean install from the lockfile (what CI does)
npm run typecheck  # two passes: src-only with zero Node/DOM types, then all
npm run build      # tsdown dual ESM/CJS + declarations, plus the CLI bin
npm test           # the full vitest suite (~370 tests)
```

Build before test: the CLI integration suite spawns `dist/cli.js` (it skips
loudly when missing). Scripts under `js/scripts/` also import from `dist/`.

Python (from `py/`):

```bash
pip install -e ".[dev]"   # editable install; dev extra pulls in pytest,
                           # pytest-asyncio, httpx, and ag-ui-protocol
pytest                     # the full pytest suite (~275 tests)
```

No build step: everything runs directly against `src/ag_ui_validate/`. The
`ag-ui-validate` console script and the `ag_ui_validate.pytest_plugin`
pytest11 plugin both register automatically on install (verify with
`pytest --trace-config | grep ag_ui_validate`).

The JS implementation lives under [js/](../js/) (`js/src/`, `js/test/`,
`js/scripts/`); the Python implementation lives under [py/](../py/)
(`py/src/ag_ui_validate/`, `py/tests/`, `py/scripts/`) — `spec/`, `dist/`,
and `package.json` itself stay at the repo root, and `py/pyproject.toml`
force-includes `spec/` into the wheel (see §4 of the port plan for the
editable-install caveat this needed). `scripts/` at the repo root (not
`js/scripts/`) holds tooling that does repo-wide, language-neutral work
despite being written in Node —
[`generate-rule-docs.mjs`](../scripts/generate-rule-docs.mjs) (reads
`spec/`, writes `docs/`) and
[`check-spec-links.mjs`](../scripts/check-spec-links.mjs) (reads
`spec/catalog.json` + `spec/event-categories.json` directly; the
event-table specUrls it checks are a deterministic function of wire type +
category, so no SDK build is needed at all) — neither has a JS-build
dependency, so both stay put regardless of language, unlike `js/scripts/`'s
other tools, which all depend on `dist/` or `@ag-ui/core`'s zod schemas.
The `npm run <script>` commands below all work unchanged from the repo
root; to run a single test file directly, use
`npm test -- <path-under-js/test>` (shown per-suite below) rather than a
bare `npx vitest`, since vitest needs `js/vitest.config.ts` to find
`js/test/`. For Python, run a single file directly with
`pytest tests/<path>` from `py/`.

Node 22+ throughout: tsdown (the build tool) uses ES2024 APIs, and `engines`
declares `>=22` since Node 20 reached end-of-life in April 2026. Python:
3.11 in CI today; `py/pyproject.toml`'s `requires-python` is still a
placeholder (see the port plan's §8 open question 5).

---

## 1. Scaffold & packaging (M0 / PM0)

| What | How |
|---|---|
| Reproducible from lockfile | `rm -rf node_modules dist && npm ci && npm run typecheck && npm run build && npm test` |
| Exports map correctness | `npx publint` — checks main/module/exports consistency against the packed tarball |
| Type resolution everywhere | `npx @arethetypeswrong/cli --pack .` — must be green for node10 / node16-cjs / node16-esm / bundler, for `.`, `./transport`, and `./report`. Known exception: `./vitest` is ESM-only (vitest itself cannot be `require`d), so its node16-from-CJS cell shows "resolution failed" by design |
| Both module systems load | `node -e "require('./dist/index.cjs')"` and `node --input-type=module -e "import('./dist/index.js')"` |

**Python:**

| What | How |
|---|---|
| Reproducible from a clean venv | `python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && pytest` |
| Real wheel builds correctly | `pip wheel . -w dist --no-deps` — **not** `python -m build`; that goes through an sdist which can't see the `../spec` force-include (see the port plan's PM5 finding) |
| Packaged install works, force-include resolves | Install the built wheel into a scratch venv: `pip install dist/ag_ui_validate-*.whl` then `python -c "from ag_ui_validate.rules.catalog import RULES; print(len(RULES))"` — the editable install and the packaged install exercise two different code paths in `catalog.py`'s `_find_spec_dir()`, so both are worth checking after any packaging change |
| Bare install stays dependency-free | In a scratch venv, `pip install dist/ag_ui_validate-*.whl` (no `[transport]` extra) then confirm `import ag_ui_validate` and `ag_ui_validate.pytest_plugin.assert_valid_agui(...)` work with `httpx` absent; `ag_ui_validate.transport.validate_endpoint(...)` should raise a clean `TransportError`, not `ImportError` |

## 2. Protocol grounding (M1 / PM1)

The canonical event table ([js/src/protocol/event-table.ts](../js/src/protocol/event-table.ts)
/ [py/src/ag_ui_validate/protocol/event_table.py](../py/src/ag_ui_validate/protocol/event_table.py))
is generated from the installed SDK's schemas (`@ag-ui/core`'s zod schemas /
`ag-ui-protocol`'s pydantic models) and checked in.

| What | How |
|---|---|
| Table matches the installed SDK | `npm test -- test/protocol-drift.test.ts` — re-derives from `@ag-ui/core` and deep-compares. Fails after an SDK bump until you regenerate. |
| Regeneration is deterministic | `npm run build && npm run protocol:derive && git diff --exit-code js/src/protocol/event-table.ts` |
| Our validity = the SDK's validity | `npm test -- test/sdk-alignment.test.ts` — every `spec/fixtures/valid/` event must parse with the SDK's own `EventSchemas`; schema-violation fixtures must be rejected by the SDK; sequencing-violation fixtures must be accepted by it (that gap is the reason this validator exists). |

After bumping `@ag-ui/core`: `npm run protocol:derive`, review the diff, check
whether new event types need catalog rules, run the drift test.

**Python:**

| What | How |
|---|---|
| Table matches the installed SDK | `pytest tests/test_protocol_drift.py` — re-derives from `ag-ui-protocol` and deep-compares |
| Regeneration is deterministic | `python scripts/generate_event_table.py && git diff --exit-code src/ag_ui_validate/protocol/event_table.py` |

There is no Python equivalent of `sdk-alignment.test.ts` yet — see the
"What must never regress" section below for the known gap.

## 3. Rule catalog (M2 / PM2)

| What | How |
|---|---|
| Catalog invariants | `npm test -- test/catalog.test.ts` — ids unique and well-formed, every rule cites an https `specUrl`, every `specQuestion` resolves to a section in [spec-questions.md](spec-questions.md), every rule has a fixture directory whose `expected.json` fires it |
| Spec links actually resolve | `npm run links:check` — fetches every unique `specUrl` (catalog + event table), verifies HTTP 200 and that each `#anchor` exists in the page HTML. Network-dependent, so it's a script, not a test. Run before releases and after docs.ag-ui.com restructures. |

**Python:**

| What | How |
|---|---|
| Catalog invariants | `pytest tests/test_catalog.py` — mirrors `test/catalog.test.ts` exactly, same 46 assertions |

`links:check` is language-neutral (reads `spec/catalog.json` +
`spec/event-categories.json` directly) — there is no separate Python
version to run.

## 4. Core state machine (M3 / PM3)

| What | How |
|---|---|
| Per-rule-group behavior | `npm test -- test/validator/` — one file per group: `lifecycle` (AGUI0xx), `text` (1xx), `toolcalls` (2xx), `state` (3xx), `reasoning` (4xx), `engine` (502/503/504, hygiene 9xx, overrides, report, multi-run), `layers` (layers option + emitExternal), `jsonpatch` (RFC 6902, incl. the RFC's appendix A examples) |
| One group only | e.g. `npm test -- test/validator/toolcalls.test.ts` |
| Never-throws invariant | `npm run fuzz` — 50k seeded hostile inputs (cyclic objects, functions, symbols, truncated JSON); exits 1 on any throw or internal error. Vary the seed: `node js/scripts/fuzz.mjs 1234` |
| Isomorphism / purity | `npm test -- test/purity.test.ts` — statically bans I/O, clocks, randomness, and platform globals from the core, and Node built-ins from all of `js/src/`. Also enforced at compile time: `tsc -p js/tsconfig.src.json` compiles `js/src/` with **no** Node type definitions. |
| Eyeball it | `npm run demo` — a deliberately broken stream, pretty-printed findings |

**Python:**

| What | How |
|---|---|
| Per-rule-group behavior | `pytest tests/test_engine.py tests/test_jsonpatch.py` — `test_engine.py` covers the same groups as the TS `test/validator/` directory in one file (`TestInputHandlingNeverThrows`, `TestAgui503UnknownEventType`, `TestAgui504SchemaValidation`, `TestHygieneRules`, `TestSeverityOverrides`, `TestReport`, `TestFinalize`, `TestMultiRunStreams`) |
| One group only | e.g. `pytest tests/test_engine.py -k HygieneRules` |

There is no Python equivalent of `fuzz.mjs`, `purity.test.ts`, or
`demo.mjs` yet — see "What must never regress" below.

## 5. Fixture corpus (M4 / PM4)

| What | How |
|---|---|
| Corpus runs clean | `npm test -- test/fixtures.test.ts` — every `invalid/` dir must produce exactly its `expected.json` (and fire its namesake rule); every `valid/` stream must produce exactly its expected findings (usually none); valid fixtures must collectively cover every rule category |
| Regeneration is deterministic and honest | `npm run fixtures:build && git diff --exit-code spec/fixtures/` — the generator declares each stream's *intended* rules independently of the validator and refuses to write on mismatch, so `expected.json` can never silently absorb an implementation bug |
| One fixture by hand | `npm test -- test/fixtures.test.ts -t AGUI203` |

Adding a rule = add the catalog entry, add its stream + intent to
[js/scripts/build-fixtures.mjs](../js/scripts/build-fixtures.mjs), regenerate. The
catalog meta-test fails until the fixture exists.

**Python:**

| What | How |
|---|---|
| Corpus runs clean | `pytest tests/test_fixtures.py` — mirrors `test/fixtures.test.ts`, including the 5 transport-scenario fixtures (`_run_scenario()` replays timed byte chunks through `validate_body` with a simulated clock) |
| One fixture by hand | `pytest tests/test_fixtures.py -k AGUI203` |

Fixture regeneration (`fixtures:build`) is TS-only — the corpus itself is
shared and language-neutral; only the JS generator writes it. Three rules
(`AGUI204`, `AGUI502`, `AGUI503`) have a documented, permanent `message`
exception between languages — see `test_fixtures.py`'s module docstring and
the port plan's §5.

## 6. Transport layer (M5 / PM5)

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

**Python:**

| What | How |
|---|---|
| SSE parser | `pytest tests/transport/test_sse.py` |
| NDJSON splitter | `pytest tests/transport/test_ndjson.py` |
| Orchestration with mocks | `pytest tests/transport/test_endpoint.py tests/transport/test_recorded.py` |
| Against your own agent | `python -c "import asyncio; from ag_ui_validate.transport import validate_endpoint; print(asyncio.run(validate_endpoint('http://localhost:8000/agui')).report.summary)"` |

There is no committed Python equivalent of `npm run e2e` (a real-socket,
no-mocks server) — the port was manually verified once against a hand-rolled
`asyncio` HTTP server with the same eight endpoint personalities during
PM5's review, but that script was not committed. Worth promoting to a real
`py/scripts/e2e_live_server.py` if the port continues to evolve.

## 7. CLI (M6 / PM6)

| What | How |
|---|---|
| Argument parser (pure) | `npm test -- test/cli/args.test.ts` — every flag in both `--flag value` and `--flag=value` forms, error messages, exit-code policy |
| Reporters (pure) | `npm test -- test/report/reporters.test.ts` — pretty lines/summary, JSON document, SARIF 2.1.0 (level mapping, `helpUri`, line regions), JUnit XML escaping |
| Recorded-input mode | `npm test -- test/transport/recorded.test.ts` — timing rules skipped-with-reason on captures, SSE framing still checked, read failures are tool failures |
| **The real binary** | `npm run build && npm test -- test/cli/integration.test.ts` — spawns `dist/cli.js` against fixtures: exit codes 0/1/2, stdin, `--json`/`--sarif` parse, `--off` silences. Skipped (loudly) if `dist/cli.js` is missing |
| By hand | `node dist/cli.js spec/fixtures/invalid/AGUI203-unterminated-tool-call/stream.jsonl` (exit 1), `cat spec/fixtures/valid/agentic-chat.jsonl \| node dist/cli.js -` (exit 0), `node dist/cli.js <your-endpoint-url>` |

**Python:**

| What | How |
|---|---|
| Argument parser (pure) | `pytest tests/test_cli_args.py` — mirrors `test/cli/args.test.ts`, same 21 cases |
| Reporters (pure) | `pytest tests/test_report.py` — mirrors `test/report/reporters.test.ts`, same 14 cases |
| **The real binary** | `pip install -e ".[dev]" && pytest tests/test_cli_integration.py` — spawns the real installed `ag-ui-validate` console script via `subprocess` against fixtures. No build step to skip on (Python has none), unlike the TS side's `dist/cli.js` skip-if-missing pattern |
| By hand | `ag-ui-validate spec/fixtures/invalid/AGUI203-unterminated-tool-call/stream.jsonl` (exit 1), `cat spec/fixtures/valid/agentic-chat.jsonl \| ag-ui-validate -` (exit 0), `ag-ui-validate <your-endpoint-url>` |

---

## 8. Vitest matcher / pytest plugin (M7 / PM7)

| What | How |
|---|---|
| Matcher behavior | `npm test -- test/vitest/matcher.test.ts` — pass/fail semantics, `.not`, options forwarding, `maxWarnings`, JSONL string input, failure-message content, invalid-usage TypeError |
| **As a real consumer** | `npm pack` the tarball into a scratch project, `npm install <tarball> vitest`, write a test with `import "ag-ui-validate/vitest"`, run `vitest` (runtime) and `tsc --noEmit` (the `Matchers` augmentation) — both must pass with zero project-side setup |

**Python:**

| What | How |
|---|---|
| Plugin behavior | `pytest tests/test_pytest_plugin.py` — mirrors `test/vitest/matcher.test.ts`, adapted from vitest's boolean `.not` matcher to pytest's assert-raises idiom (`pytest.raises(AssertionError, ...)`) |
| Plugin actually registers | `pytest --trace-config \| grep ag_ui_validate` — confirms pytest loads it as an active `pytest11` plugin, not just an importable module |
| Endpoint helpers | No ported test exists (vitest's matcher has no endpoint variant to port from) — verified manually against a mocked `fetch_impl` during PM7's review; worth a committed test if this surface grows |

---

## 9. GitHub Action (M8 / PM8)

| What | How |
|---|---|
| Driver, GitHub-style | `npm test -- test/action/run.test.ts` — spawns `action/run.mjs` with `INPUT_*` env vars and temp `GITHUB_OUTPUT`/`GITHUB_STEP_SUMMARY` files, exactly as the composite step does; asserts exit codes, outputs, summary markdown, SARIF file |
| In a real workflow | the `action-self-test` job in `.github/workflows/ci.yml` runs `uses: ./action` (with `version: local`) against a valid and an invalid fixture on every push and asserts outcome + outputs + SARIF |

The action is a thin wrapper: one CLI invocation using the `--*-file` flags,
so the reporters themselves are covered by the reporter and CLI suites.

**Python:** nothing to run here. `action/run.mjs` only ever shells out to
the npm package (`npx ag-ui-validate@version`, or the local `dist/cli.js`
build) — there is no code path that reaches `py/`, so this milestone was
verification-only. See the port plan's PM8 row for how that was confirmed.

---

## 10. Rule docs + llms.txt (M9 / PM9)

| What | How |
|---|---|
| Pages complete & grounded | `npm test -- test/docs.test.ts` — every catalog rule has a `docs/rules/AGUI###.md` with title, severity, spec URL, verbatim spec quote (when one exists), an example from the fixture corpus, and its SQ link when the spec is ambiguous; the index and `llms.txt` list all 40 |
| No drift | `npm run docs:check` — regenerates everything in memory and fails on any byte difference or stray hand-written page (also part of the test above) |
| Regenerate | `npm run docs:generate` after editing the catalog or fixtures |

**Python:** nothing to run here either. `docs/rules/*.md`, its `README.md`
index, and `llms.txt` are generated once from `spec/catalog.json` +
`spec/fixtures/` — fully data-driven, no per-language content — and shared
by both implementations rather than forked. Only `generate-rule-docs.mjs`
(at the repo root, not `js/scripts/`) writes them; there is no separate
Python generator, and none is needed unless the docs ever need
language-specific content.

---

## What must never regress

- **The core never throws** on any input. TS: `npm run fuzz`, hostile-object
  tests in `engine.test.ts`. Python: every event is fed through a
  try/except in `Validator.feed()`/`finalize()` (`engine.py`), covered by
  `TestInputHandlingNeverThrows` in `test_engine.py` and the malformed-JSON
  fixtures in `test_fixtures.py` — but there is no seeded-fuzz corpus script
  (`fuzz.mjs`'s equivalent) ported yet. A known, honest gap, not a silent
  one.
- **The core stays pure** — zero runtime deps, zero I/O, no clocks
  (`js/test/purity.test.ts` + `js/tsconfig.src.json`). `js/src/cli.ts` is the
  one deliberate Node-only file; the purity test asserts nothing else imports
  it. Python has no equivalent static purity check yet — the `transport/`
  and `cli.py` modules are the only ones with I/O by construction (the same
  boundary as the TS side), but nothing currently *enforces* that a future
  change to `engine.py` or `rules/checks/*.py` can't accidentally import
  something like `asyncio` or `httpx`.
- **Every diagnostic cites the spec** (`js/test/catalog.test.ts` /
  `py/tests/test_catalog.py`, `npm run links:check`).
- **Every rule has corpus coverage** (`js/test/catalog.test.ts` /
  `py/tests/test_catalog.py` meta-test).
- **Valid means valid to the SDK too** — TS only
  (`js/test/sdk-alignment.test.ts`); no Python equivalent exists against
  `ag-ui-protocol`'s own schemas yet.
