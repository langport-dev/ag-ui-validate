# AGUI507 — Response appears buffered rather than incrementally flushed

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Transport · **Checked in:** transport · **Since:** 0.x

**Message:** `Response appears buffered: {detail}`

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
[`fixtures/invalid/AGUI507-buffered-response`](../../fixtures/invalid/AGUI507-buffered-response) and the replay
protocol in [fixtures/README.md](../../fixtures/README.md):

```json
{
  "contentType": "text/event-stream",
  "chunks": [
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_STARTED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"timestamp\":1755300021800}\n\ndata: {\"type\":\"TEXT_MESSAGE_START\",\"messageId\":\"msg_001\",\"role\":\"assistant\",\"timestamp\":1755300021900}\n\ndata: {\"type\":\"TEXT_MESSAGE_CONTENT\",\"messageId\":\"msg_001\",\"delta\":\"All good here.\",\"timestamp\":1755300022000}\n\ndata: {\"type\":\"TEXT_MESSAGE_END\",\"messageId\":\"msg_001\",\"timestamp\":1755300022100}\n\ndata: {\"type\":\"RUN_FINISHED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"outcome\":{\"type\":\"success\"},\"timestamp\":1755300022200}\n\n"
    }
  ]
}
```

Expected findings:

- `info` AGUI507 at stream — Response appears buffered: entire body (5 events) arrived in a single chunk
