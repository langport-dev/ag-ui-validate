# AGUI006 — STEP_FINISHED without matching STEP_STARTED

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `STEP_FINISHED '{stepName}' has no open STEP_STARTED`

## Spec grounding

> The stepName must match the corresponding StepStarted event.

Source: <https://docs.ag-ui.com/concepts/events#stepfinished>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI006-step-finished-unmatched`](../../spec/fixtures/invalid/AGUI006-step-finished-unmatched)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300009600}
{"type":"STEP_FINISHED","stepName":"plan","timestamp":1755300009700}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300009800}
```

Expected findings:

- `error` AGUI006 at event 1 — STEP_FINISHED 'plan' has no open STEP_STARTED
