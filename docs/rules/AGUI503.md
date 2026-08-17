# AGUI503 — Unknown event type

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Transport · **Checked in:** core · **Since:** 0.x

**Message:** `Unknown event type '{type}' (not in @ag-ui/core v{sdkVersion}, and not RAW or CUSTOM)`

## Spec grounding

> Events in the protocol are categorized by their purpose.

Source: <https://docs.ag-ui.com/concepts/events#event-types-overview>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI503-unknown-event-type`](../../spec/fixtures/invalid/AGUI503-unknown-event-type)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019200}
{"type":"AGUI_PING","timestamp":1755300019300}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300019400}
```

Expected findings:

- `error` AGUI503 at event 1 — Unknown event type 'AGUI_PING' (not in @ag-ui/core v0.0.58, and not RAW or CUSTOM)
