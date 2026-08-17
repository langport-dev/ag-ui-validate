# AGUI005 — RUN_FINISHED and RUN_ERROR are mutually exclusive

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `{type} emitted after the run already terminated with {terminalType}`

## Spec grounding

> Every run terminates with either RunFinished or RunError.

Source: <https://docs.ag-ui.com/concepts/events#runfinished>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI005-finished-and-error`](../../spec/fixtures/invalid/AGUI005-finished-and-error)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300009300}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300009400}
{"type":"RUN_ERROR","message":"boom","timestamp":1755300009500}
```

Expected findings:

- `error` AGUI005 at event 2 — RUN_ERROR emitted after the run already terminated with RUN_FINISHED
