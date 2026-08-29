# AGUI506 — No keepalive frame within the configured window

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Transport · **Checked in:** transport · **Since:** 0.x

**Message:** `No event or keepalive frame for {seconds}s`

## Spec grounding

The spec has no single quotable sentence for this behavior; the rule
is grounded in the linked section as a whole.

Source: <https://docs.ag-ui.com/concepts/architecture#standard-http-client>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-5](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

This rule is checked at the transport layer, so its fixture is a timed
HTTP replay rather than a bare stream — see
[`spec/fixtures/invalid/AGUI506-keepalive-gap`](../../spec/fixtures/invalid/AGUI506-keepalive-gap) and the replay
protocol in [spec/fixtures/README.md](../../spec/fixtures/README.md):

```json
{
  "contentType": "text/event-stream",
  "chunks": [
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_STARTED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"timestamp\":1755300023100}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_START\",\"messageId\":\"msg_001\",\"role\":\"assistant\",\"timestamp\":1755300023200}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_CONTENT\",\"messageId\":\"msg_001\",\"delta\":\"Thinking very hard…\",\"timestamp\":1755300023300}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_END\",\"messageId\":\"msg_001\",\"timestamp\":1755300023400}\n\n"
    },
    {
      "gapMs": 47000,
      "text": "data: {\"type\":\"RUN_FINISHED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"outcome\":{\"type\":\"success\"},\"timestamp\":1755300023500}\n\n"
    }
  ]
}
```

Expected findings:

- `info` AGUI506 at stream — No event or keepalive frame for 47s
