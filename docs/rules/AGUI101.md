# AGUI101 — TEXT_MESSAGE_CONTENT without start

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Text messages · **Checked in:** core · **Since:** 0.x

**Message:** `TEXT_MESSAGE_CONTENT for messageId '{messageId}' with no open TEXT_MESSAGE_START`

## Spec grounding

> A message begins with a TextMessageStart event, followed by one or more TextMessageContent events that deliver chunks of text as they become available, and concludes with a TextMessageEnd event.

Source: <https://docs.ag-ui.com/concepts/events#text-message-events>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI101-content-without-start`](../../spec/fixtures/invalid/AGUI101-content-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300010400}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_ghost","delta":"orphan","timestamp":1755300010500}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300010600}
```

Expected findings:

- `error` AGUI101 at event 1 — TEXT_MESSAGE_CONTENT for messageId 'msg_ghost' with no open TEXT_MESSAGE_START
