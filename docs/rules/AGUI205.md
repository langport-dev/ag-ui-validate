# AGUI205 — Duplicate toolCallId within a run

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `toolCallId '{toolCallId}' was already used by a completed tool call`

## Spec grounding

> toolCallId: Unique identifier for the tool call

Source: <https://docs.ag-ui.com/concepts/events#toolcallstart>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI205-duplicate-tool-call-id`](../../spec/fixtures/invalid/AGUI205-duplicate-tool-call-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300014600}
{"type":"TOOL_CALL_START","toolCallId":"call_001","toolCallName":"get_weather","timestamp":1755300014700}
{"type":"TOOL_CALL_END","toolCallId":"call_001","timestamp":1755300014800}
{"type":"TOOL_CALL_START","toolCallId":"call_001","toolCallName":"get_weather","timestamp":1755300014900}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300015000}
```

Expected findings:

- `error` AGUI205 at event 3 — toolCallId 'call_001' was already used by a completed tool call
