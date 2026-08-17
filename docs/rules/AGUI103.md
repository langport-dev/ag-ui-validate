# AGUI103 — Text message unterminated at run end

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `TEXT_MESSAGE_START messageId '{messageId}' never ended`

## Spec grounding

> A message begins with a TextMessageStart event, followed by one or more TextMessageContent events that deliver chunks of text as they become available, and concludes with a TextMessageEnd event.

Source: <https://docs.ag-ui.com/concepts/events#text-message-events>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI103-message-unterminated`](../../spec/fixtures/invalid/AGUI103-message-unterminated)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300011000}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300011100}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"never ends","timestamp":1755300011200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300011300}
```

Expected findings:

- `error` AGUI103 at event 3 — TEXT_MESSAGE_START messageId 'msg_001' never ended
