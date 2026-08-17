# AGUI204 — Tool call arguments are not valid JSON

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `Concatenated TOOL_CALL_ARGS for toolCallId '{toolCallId}' do not parse as JSON: {error}`

## Spec grounding

> Frontends should concatenate these deltas in the order received to construct the complete arguments object.

Source: <https://docs.ag-ui.com/concepts/events#toolcallargs>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI204-args-not-json`](../../spec/fixtures/invalid/AGUI204-args-not-json)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300014000}
{"type":"TOOL_CALL_START","toolCallId":"call_001","toolCallName":"get_weather","timestamp":1755300014100}
{"type":"TOOL_CALL_ARGS","toolCallId":"call_001","delta":"{\"city\":","timestamp":1755300014200}
{"type":"TOOL_CALL_ARGS","toolCallId":"call_001","delta":"oops}","timestamp":1755300014300}
{"type":"TOOL_CALL_END","toolCallId":"call_001","timestamp":1755300014400}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300014500}
```

Expected findings:

- `error` AGUI204 at event 4 — Concatenated TOOL_CALL_ARGS for toolCallId 'call_001' do not parse as JSON: Unexpected token 'o', "{"city":oops}" is not valid JSON
