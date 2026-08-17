# AGUI901 — RAW event wraps a typed AG-UI event

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Protocol hygiene · **Checked in:** core · **Since:** 0.x

**Message:** `RAW event wraps an event of type '{wrappedType}', which has a typed AG-UI equivalent`

## Spec grounding

> The Raw event acts as a container for events originating from external systems or sources that don't natively follow the Agent UI Protocol.

Source: <https://docs.ag-ui.com/concepts/events#raw>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI901-raw-wraps-typed-event`](../../spec/fixtures/invalid/AGUI901-raw-wraps-typed-event)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019900}
{"type":"RAW","event":{"type":"TOOL_CALL_RESULT","toolCallId":"call_001","content":"wrapped"},"timestamp":1755300020000}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300020100}
```

Expected findings:

- `info` AGUI901 at event 1 — RAW event wraps an event of type 'TOOL_CALL_RESULT', which has a typed AG-UI equivalent
