# AGUI508 — Stream ended without a terminal event

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Transport · **Checked in:** transport · **Since:** 0.x

**Message:** `Connection ended mid-run '{runId}' without RUN_FINISHED or RUN_ERROR`

## Spec grounding

> Every run terminates with either RunFinished or RunError.

Source: <https://docs.ag-ui.com/concepts/events#runfinished>

## Example

This rule is checked at the transport layer, so its fixture is a timed
HTTP replay rather than a bare stream — see
[`spec/fixtures/invalid/AGUI508-connection-dropped`](../../spec/fixtures/invalid/AGUI508-connection-dropped) and the replay
protocol in [spec/fixtures/README.md](../../spec/fixtures/README.md):

```json
{
  "contentType": "text/event-stream",
  "chunks": [
    {
      "gapMs": 0,
      "text": "data: {\"type\":\"RUN_STARTED\",\"threadId\":\"thread_001\",\"runId\":\"run_001\",\"timestamp\":1755300024700}\n\n"
    }
  ],
  "abnormalEof": true
}
```

Expected findings:

- `error` AGUI508 at stream — Connection ended mid-run 'run_001' without RUN_FINISHED or RUN_ERROR
- `error` AGUI003 at stream — Run 'run_001' ended without RUN_FINISHED or RUN_ERROR
