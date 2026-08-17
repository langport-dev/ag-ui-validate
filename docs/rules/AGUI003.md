# AGUI003 — Run not terminated

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `Run '{runId}' ended without RUN_FINISHED or RUN_ERROR`

## Spec grounding

> Every run terminates with either RunFinished or RunError.

Source: <https://docs.ag-ui.com/concepts/events#runfinished>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI003-run-never-terminated`](../../spec/fixtures/invalid/AGUI003-run-never-terminated)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300008600}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300008700}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"This run just stops.","timestamp":1755300008800}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300008900}
```

Expected findings:

- `error` AGUI003 at stream — Run 'run_001' ended without RUN_FINISHED or RUN_ERROR
