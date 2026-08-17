# AGUI505 — Unexpected Content-Type

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Transport · **Checked in:** transport · **Since:** 0.x

**Message:** `Content-Type '{contentType}' is neither text/event-stream nor application/x-ndjson`

## Spec grounding

The spec has no single quotable sentence for this behavior; the rule
is grounded in the linked section as a whole.

Source: <https://html.spec.whatwg.org/multipage/server-sent-events.html#sse-processing-model>

## Example

This rule is checked at the transport layer, so its fixture is a timed
HTTP replay rather than a bare stream — see
[`fixtures/invalid/AGUI505-unexpected-content-type`](../../fixtures/invalid/AGUI505-unexpected-content-type) and the replay
protocol in [fixtures/README.md](../../fixtures/README.md):

```json
{
  "contentType": "application/json",
  "chunks": [
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_STARTED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"timestamp\":1755300020800}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_START\",\"messageId\":\"msg_001\",\"role\":\"assistant\",\"timestamp\":1755300020900}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_CONTENT\",\"messageId\":\"msg_001\",\"delta\":\"All good here.\",\"timestamp\":1755300021000}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"TEXT_MESSAGE_END\",\"messageId\":\"msg_001\",\"timestamp\":1755300021100}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_FINISHED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"outcome\":{\"type\":\"success\"},\"timestamp\":1755300021200}\n\n"
    }
  ]
}
```

Expected findings:

- `warning` AGUI505 at stream — Content-Type 'application/json' is neither text/event-stream nor application/x-ndjson
