# AGUI903 — CUSTOM event name is not namespaced

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Protocol hygiene · **Checked in:** core · **Since:** 0.x

**Message:** `CUSTOM event name '{name}' has no namespace prefix (e.g. 'vendor.event')`

## Spec grounding

> Teams should document their custom events to ensure consistent implementation across frontends and agents.

Source: <https://docs.ag-ui.com/concepts/events#custom>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-14](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI903-custom-name-not-namespaced`](../../spec/fixtures/invalid/AGUI903-custom-name-not-namespaced)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300020200}
{"type":"CUSTOM","name":"update","value":{"x":1},"timestamp":1755300020300}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300020400}
```

Expected findings:

- `info` AGUI903 at event 1 — CUSTOM event name 'update' has no namespace prefix (e.g. 'vendor.event')
