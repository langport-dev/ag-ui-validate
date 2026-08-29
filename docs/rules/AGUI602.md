# AGUI602 — SUBAGENT_FINISHED without matching SUBAGENT_STARTED

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `SUBAGENT_FINISHED references subagentRunId '{subagentRunId}', which was never started`

## Spec grounding

> SubagentFinished and SubagentError name a subagent that is currently active

Source: <https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI602-finished-without-start`](../../spec/fixtures/invalid/AGUI602-finished-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019500}
{"type":"SUBAGENT_FINISHED","subagentRunId":"sub_ghost","timestamp":1755300019600}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300019700}
```

Expected findings:

- `error` AGUI602 at event 1 — SUBAGENT_FINISHED references subagentRunId 'sub_ghost', which was never started
