# AGUI105 — Empty content delta

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `TEXT_MESSAGE_CONTENT for messageId '{messageId}' has an empty delta`

## Spec grounding

> delta: Text content chunk (non-empty)

Source: <https://docs.ag-ui.com/concepts/events#textmessagecontent>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-2](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI105-empty-content-delta`](../../fixtures/invalid/AGUI105-empty-content-delta)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300012000}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300012100}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"","timestamp":1755300012200}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300012300}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300012400}
```

Expected findings:

- `warning` AGUI105 at event 2 — TEXT_MESSAGE_CONTENT for messageId 'msg_001' has an empty delta
