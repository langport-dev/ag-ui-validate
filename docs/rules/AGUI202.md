# AGUI202 — TOOL_CALL_END without start

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `TOOL_CALL_END for toolCallId '{toolCallId}' with no open TOOL_CALL_START`

## Spec grounding

> toolCallId: Matches the ID from ToolCallStart

Source: <https://docs.ag-ui.com/concepts/events#toolcallend>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI202-end-without-start`](../../fixtures/invalid/AGUI202-end-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300013300}
{"type":"TOOL_CALL_END","toolCallId":"call_ghost","timestamp":1755300013400}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300013500}
```

Expected findings:

- `error` AGUI202 at event 1 — TOOL_CALL_END for toolCallId 'call_ghost' with no open TOOL_CALL_START
