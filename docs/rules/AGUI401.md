# AGUI401 — REASONING_MESSAGE_CONTENT without start

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Reasoning · **Checked in:** core · **Since:** 0.x

**Message:** `REASONING_MESSAGE_CONTENT for messageId '{messageId}' with no open REASONING_MESSAGE_START`

## Spec grounding

> Multiple content events with the same messageId should be concatenated to form the complete visible reasoning.

Source: <https://docs.ag-ui.com/concepts/events#reasoningmessagecontent>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-4](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI401-reasoning-content-without-start`](../../spec/fixtures/invalid/AGUI401-reasoning-content-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300018400}
{"type":"REASONING_MESSAGE_CONTENT","messageId":"rmsg_ghost","delta":"orphan","timestamp":1755300018500}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300018600}
```

Expected findings:

- `error` AGUI401 at event 1 — REASONING_MESSAGE_CONTENT for messageId 'rmsg_ghost' with no open REASONING_MESSAGE_START
