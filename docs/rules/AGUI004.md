# AGUI004 — Event after terminal event

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `{type} follows the run's terminal {terminalType}`

## Spec grounding

> The RunStarted and either RunFinished or RunError events are mandatory, forming the boundaries of an agent run.

Source: <https://docs.ag-ui.com/concepts/events#lifecycle-events>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI004-event-after-terminal`](../../spec/fixtures/invalid/AGUI004-event-after-terminal)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300009000}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300009100}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300009200}
```

Expected findings:

- `error` AGUI004 at event 2 — TEXT_MESSAGE_START follows the run's terminal RUN_FINISHED
