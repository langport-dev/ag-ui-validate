# AGUI104 — Duplicate messageId within a run

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `messageId '{messageId}' was already used by a completed message`

## Spec grounding

> It establishes a unique messageId that will be referenced by subsequent content chunks and the end event.

Source: <https://docs.ag-ui.com/concepts/events#textmessagestart>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI104-duplicate-message-id`](../../fixtures/invalid/AGUI104-duplicate-message-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300011400}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300011500}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"first use","timestamp":1755300011600}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300011700}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300011800}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300011900}
```

Expected findings:

- `error` AGUI104 at event 4 — messageId 'msg_001' was already used by a completed message
