# AGUI303 — STATE_DELTA is not a valid RFC 6902 patch document

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** State · **Checked in:** core · **Since:** 0.x

**Message:** `STATE_DELTA is not a valid RFC 6902 patch document: {error}`

## Spec grounding

> The StateDelta event contains incremental updates to the agent's state in the form of JSON Patch operations (as defined in RFC 6902).

Source: <https://docs.ag-ui.com/concepts/events#statedelta>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI303-invalid-patch-document`](../../spec/fixtures/invalid/AGUI303-invalid-patch-document)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300017000}
{"type":"STATE_SNAPSHOT","snapshot":{},"timestamp":1755300017100}
{"type":"STATE_DELTA","delta":[{"op":"merge","path":"/a","value":1}],"timestamp":1755300017200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300017300}
```

Expected findings:

- `error` AGUI303 at event 2 — STATE_DELTA is not a valid RFC 6902 patch document: operation 0 has invalid op 'merge'
