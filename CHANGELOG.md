# ag-ui-validate

## 0.4.0

### Minor Changes

- 4b55fc7: New `--fail-on <error|warning|none>` flag (JS and Python, in parity): controls which severity triggers a nonzero exit. Defaults to `error`, matching today's behavior exactly. `--fail-on warning` also fails on any warning finding, independent of `--max-warnings`. `--fail-on none` never fails on findings — useful for report-only/annotate-only CI runs that shouldn't block the job.
- 4b55fc7: Every rule in the catalog now carries a `category` (`lifecycle`, `text`, `toolcall`, `state`, `reasoning`, `transport`, or `hygiene`), matching the grouping already used in the docs and rule index. `--json` diagnostics and SARIF rule metadata (as a `properties.tags` entry) now include it, so downstream tooling can group or filter findings without re-deriving the category from the rule ID.
- 6f7fbe7: Support for the AG-UI subagent lifecycle events (`SUBAGENT_STARTED`/`SUBAGENT_FINISHED`/`SUBAGENT_ERROR`, added in `@ag-ui/core` 0.0.59 / `ag-ui-protocol` 0.1.21), in parity across JS and Python. Six new rules (`AGUI601`–`AGUI606`) catch duplicate or unmatched `SUBAGENT_STARTED`/`FINISHED`/`ERROR` (with the suspended-subagent resumption exception), subagents left open at `RUN_FINISHED`, unknown `parentSubagentRunId` references, and continuation events (text messages, tool calls, steps) whose `subagentRunId` disagrees with the owner their entity was opened under.

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
