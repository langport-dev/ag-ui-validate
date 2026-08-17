# AGUI007 — Step unterminated at run end

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `STEP_STARTED '{stepName}' never finished`

## Spec grounding

> The stepName must match the corresponding StepStarted event.

Source: <https://docs.ag-ui.com/concepts/events#stepstarted>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI007-step-unterminated`](../../spec/fixtures/invalid/AGUI007-step-unterminated)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300009900}
{"type":"STEP_STARTED","stepName":"plan","timestamp":1755300010000}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300010100}
```

Expected findings:

- `error` AGUI007 at event 2 — STEP_STARTED 'plan' never finished
