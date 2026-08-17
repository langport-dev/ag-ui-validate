# AGUI402 — Reasoning unterminated at run end

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Reasoning · **Checked in:** core · **Since:** 0.x

**Message:** `{startType} messageId '{messageId}' never ended`

## Spec grounding

> Reasoning events support LLM reasoning visibility and continuity, enabling chain-of-thought reasoning while maintaining privacy.

Source: <https://docs.ag-ui.com/concepts/events#reasoning-events>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-4](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI402-reasoning-unterminated`](../../spec/fixtures/invalid/AGUI402-reasoning-unterminated)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300018700}
{"type":"REASONING_START","messageId":"rsn_001","timestamp":1755300018800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300018900}
```

Expected findings:

- `warning` AGUI402 at event 2 — REASONING_START messageId 'rsn_001' never ended
