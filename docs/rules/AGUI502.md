# AGUI502 — Event payload is not valid JSON

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Transport · **Checked in:** core · **Since:** 0.x

**Message:** `Event payload is not valid JSON: {error}`

## Spec grounding

> All events share a common set of base properties.

Source: <https://docs.ag-ui.com/concepts/events#base-event-properties>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI502-payload-not-json`](../../fixtures/invalid/AGUI502-payload-not-json)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019000}
{"type": broken json
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300019100}
```

Expected findings:

- `error` AGUI502 at event 1 — Event payload is not valid JSON: Unexpected token 'b', "{"type": broken json" is not valid JSON
