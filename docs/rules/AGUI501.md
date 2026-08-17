# AGUI501 — Malformed SSE framing

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Transport · **Checked in:** transport · **Since:** 0.x

**Message:** `Malformed SSE framing: {detail}`

## Spec grounding

The spec has no single quotable sentence for this behavior; the rule
is grounded in the linked section as a whole.

Source: <https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation>

## Example

This rule is checked at the transport layer, so its fixture is a timed
HTTP replay rather than a bare stream — see
[`spec/fixtures/invalid/AGUI501-missing-data-prefix`](../../spec/fixtures/invalid/AGUI501-missing-data-prefix) and the replay
protocol in [spec/fixtures/README.md](../../spec/fixtures/README.md):

```json
{
  "contentType": "text/event-stream",
  "chunks": [
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_STARTED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"timestamp\":1755300020500}\n\n"
    },
    {
      "gapMs": 0,
      "text": "{\"type\":\"CUSTOM\",\"name\":\"acme.ping\",\"value\":1,\"timestamp\":1755300020600}\n\n"
    },
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_FINISHED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"outcome\":{\"type\":\"success\"},\"timestamp\":1755300020700}\n\n"
    }
  ]
}
```

Expected findings:

- `error` AGUI501 at stream — Malformed SSE framing: line '{"type":"CUSTOM","name":"acme.ping","value":1,"timestamp":17…' looks like a JSON payload but lacks the 'data:' field prefix, so SSE clients silently drop it
