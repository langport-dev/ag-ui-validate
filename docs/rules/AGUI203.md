# AGUI203 — Unterminated tool call

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `TOOL_CALL_START id '{toolCallId}' never terminated`

## Spec grounding

> When an agent needs to use a tool, it emits a ToolCallStart event, followed by one or more ToolCallArgs events that stream the arguments being passed to the tool, and concludes with a ToolCallEnd event.

Source: <https://docs.ag-ui.com/concepts/events#tool-call-events>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI203-unterminated-tool-call`](../../fixtures/invalid/AGUI203-unterminated-tool-call)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300013600}
{"type":"TOOL_CALL_START","toolCallId":"call_7","toolCallName":"get_weather","timestamp":1755300013700}
{"type":"TOOL_CALL_ARGS","toolCallId":"call_7","delta":"{\"city\":\"Berlin\"}","timestamp":1755300013800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300013900}
```

Expected findings:

- `error` AGUI203 at event 3 — TOOL_CALL_START id 'call_7' never terminated
