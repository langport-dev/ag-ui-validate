# AGUI201 — TOOL_CALL_ARGS without start

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `TOOL_CALL_ARGS for toolCallId '{toolCallId}' with no open TOOL_CALL_START`

## Spec grounding

> When an agent needs to use a tool, it emits a ToolCallStart event, followed by one or more ToolCallArgs events that stream the arguments being passed to the tool, and concludes with a ToolCallEnd event.

Source: <https://docs.ag-ui.com/concepts/events#tool-call-events>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI201-args-without-start`](../../fixtures/invalid/AGUI201-args-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300013000}
{"type":"TOOL_CALL_ARGS","toolCallId":"call_ghost","delta":"{}","timestamp":1755300013100}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300013200}
```

Expected findings:

- `error` AGUI201 at event 1 — TOOL_CALL_ARGS for toolCallId 'call_ghost' with no open TOOL_CALL_START
