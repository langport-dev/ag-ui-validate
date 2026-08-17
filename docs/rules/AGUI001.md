# AGUI001 — Run does not start with RUN_STARTED

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `First event of the run is {type}; expected RUN_STARTED`

## Spec grounding

> The RunStarted event is the first event emitted when an agent begins processing a request.

Source: <https://docs.ag-ui.com/concepts/events#runstarted>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI001-first-event-not-run-started`](../../spec/fixtures/invalid/AGUI001-first-event-not-run-started)):

```jsonl
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300007900}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"Hello without a run.","timestamp":1755300008000}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300008100}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","timestamp":1755300008200}
```

Expected findings:

- `error` AGUI001 at event 0 — First event of the run is TEXT_MESSAGE_START; expected RUN_STARTED
