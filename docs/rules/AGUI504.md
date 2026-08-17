# AGUI504 — Event fails schema validation for its declared type

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Transport · **Checked in:** core · **Since:** 0.x

**Message:** `{type}: {detail}`

## Spec grounding

> All events share a common set of base properties.

Source: <https://docs.ag-ui.com/concepts/events#base-event-properties>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI504-schema-violation`](../../spec/fixtures/invalid/AGUI504-schema-violation)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019500}
{"type":"TOOL_CALL_START","toolCallId":"call_001","timestamp":1755300019600}
{"type":"TOOL_CALL_END","toolCallId":"call_001","timestamp":1755300019700}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300019800}
```

Expected findings:

- `error` AGUI504 at event 1 — TOOL_CALL_START: missing required field 'toolCallName' (string)
