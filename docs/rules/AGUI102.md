# AGUI102 — TEXT_MESSAGE_END without start

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `TEXT_MESSAGE_END for messageId '{messageId}' with no open TEXT_MESSAGE_START`

## Spec grounding

> messageId: Matches the ID from TextMessageStart

Source: <https://docs.ag-ui.com/concepts/events#textmessageend>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI102-end-without-start`](../../fixtures/invalid/AGUI102-end-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300010700}
{"type":"TEXT_MESSAGE_END","messageId":"msg_ghost","timestamp":1755300010800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300010900}
```

Expected findings:

- `error` AGUI102 at event 1 — TEXT_MESSAGE_END for messageId 'msg_ghost' with no open TEXT_MESSAGE_START
