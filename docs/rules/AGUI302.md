# AGUI302 — STATE_DELTA failed to apply

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** State · **Checked in:** core · **Since:** 0.x

**Message:** `STATE_DELTA failed to apply: {error}`

## Spec grounding

> Each delta represents specific changes to apply to the current state model.

Source: <https://docs.ag-ui.com/concepts/events#statedelta>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI302-delta-failed-to-apply`](../../spec/fixtures/invalid/AGUI302-delta-failed-to-apply)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300016600}
{"type":"STATE_SNAPSHOT","snapshot":{"items":[]},"timestamp":1755300016700}
{"type":"STATE_DELTA","delta":[{"op":"replace","path":"/items/3","value":"x"}],"timestamp":1755300016800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300016900}
```

Expected findings:

- `error` AGUI302 at event 2 — STATE_DELTA failed to apply: /items/3: '3' is not a valid index for an array of length 0
