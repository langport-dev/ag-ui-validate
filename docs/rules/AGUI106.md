# AGUI106 — Interleaved message streams sharing a messageId

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `TEXT_MESSAGE_START for messageId '{messageId}', which is already open`

## Spec grounding

> Events with the same ID (e.g., messageId, toolCallId) belong to the same logical stream

Source: <https://docs.ag-ui.com/concepts/events#implementation-considerations>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI106-interleaved-same-message-id`](../../spec/fixtures/invalid/AGUI106-interleaved-same-message-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300012500}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300012600}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300012700}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300012800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300012900}
```

Expected findings:

- `error` AGUI106 at event 2 — TEXT_MESSAGE_START for messageId 'msg_001', which is already open
