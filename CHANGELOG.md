# ag-ui-validate

## 0.3.0

### Minor Changes

- 489d18c: Require Node 22+ (`engines` bumped from `>=20`). Node 20 reached end-of-life in April 2026 and its CI leg has been removed; existing releases remain installable on Node 20.

### Patch Changes

- 72f3c10: AGUI503's message no longer hardcodes `@ag-ui/core` — it now reads "not in the installed AG-UI SDK v{version}" instead of "not in @ag-ui/core v{version}". Surfaced by the Python port sharing the same catalog: the old wording was misleading coming from a validator built on a different SDK.

## 0.2.0

### Minor Changes

- 37a6b10: New `--group` CLI flag: collapses repeated findings into one line per rule with a count and sample event indexes, for large streams where the same violation repeats. Summary totals and exit codes are unchanged. Also exported as `formatGroupedDiagnostics` from `ag-ui-validate/report`.

## 0.1.0

### Minor Changes

- Initial release: conformance validator for the AG-UI protocol.
  
  - Pure, zero-dependency core: `createValidator` with 40 spec-grounded rules (lifecycle, text messages, tool calls, state, reasoning, transport, hygiene), every diagnostic carrying a rule ID, severity, and spec link
  - `ag-ui-validate/transport`: SSE + NDJSON clients (`validateEndpoint`, `validateBody`) with transport-level checks and recorded-input mode
  - `ag-ui-validate/vitest`: `expect(events).toBeValidAGUI()` matcher
  - `ag-ui-validate/report`: pretty, JSON, SARIF 2.1.0, and JUnit reporters
  - `npx ag-ui-validate <url|file|->` CLI with severity overrides, feature declarations, and CI-friendly exit codes
  - GitHub Action (`langport-dev/ag-ui-validate/action`)
  - Language-neutral fixture corpus and per-rule documentation
