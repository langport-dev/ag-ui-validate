# AGUI207 — TOOL_CALL_RESULT references unknown toolCallId

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `TOOL_CALL_RESULT references toolCallId '{toolCallId}', which was never started`

## Spec grounding

> toolCallId: Matches the ID from the corresponding ToolCallStart event

Source: <https://docs.ag-ui.com/concepts/events#toolcallresult>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI207-result-unknown-id`](../../spec/fixtures/invalid/AGUI207-result-unknown-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300015600}
{"type":"TOOL_CALL_RESULT","messageId":"msg_001","toolCallId":"call_ghost","content":"orphan","timestamp":1755300015700}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300015800}
```

Expected findings:

- `error` AGUI207 at event 1 — TOOL_CALL_RESULT references toolCallId 'call_ghost', which was never started
