# AGUI305 — Shared state declared but never established

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** State · **Checked in:** core · **Since:** 0.x

**Message:** `features include 'shared-state' but no STATE_SNAPSHOT was emitted`

## Spec grounding

> These events are used to manage and synchronize the agent's state with the frontend.

Source: <https://docs.ag-ui.com/concepts/events#state-management-events>

Only evaluated when the `true` feature is declared
(`--features true` on the CLI, `features: ["true"]` in code);
otherwise it is reported as skipped.

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI305-shared-state-never-established`](../../spec/fixtures/invalid/AGUI305-shared-state-never-established)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300017900}
{"type":"TEXT_MESSAGE_START","messageId":"msg_001","role":"assistant","timestamp":1755300018000}
{"type":"TEXT_MESSAGE_CONTENT","messageId":"msg_001","delta":"No state events at all.","timestamp":1755300018100}
{"type":"TEXT_MESSAGE_END","messageId":"msg_001","timestamp":1755300018200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300018300}
```

Expected findings:

- `warning` AGUI305 at stream — features include 'shared-state' but no STATE_SNAPSHOT was emitted
