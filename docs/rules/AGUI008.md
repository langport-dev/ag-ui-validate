# AGUI008 — Unstable threadId/runId across the run

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `RUN_FINISHED {field} '{actual}' does not match RUN_STARTED {field} '{expected}'`

## Spec grounding

> It also provides crucial identifiers that can be used to associate subsequent events with this specific run.

Source: <https://docs.ag-ui.com/concepts/events#runstarted>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI008-unstable-run-ids`](../../spec/fixtures/invalid/AGUI008-unstable-run-ids)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300010200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_999","outcome":{"type":"success"},"timestamp":1755300010300}
```

Expected findings:

- `warning` AGUI008 at event 1 — RUN_FINISHED runId 'run_999' does not match RUN_STARTED runId 'run_001'
