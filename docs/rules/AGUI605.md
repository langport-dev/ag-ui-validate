# AGUI605 — parentSubagentRunId references a subagent never started

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `SUBAGENT_STARTED parentSubagentRunId '{parentSubagentRunId}' matches no subagent observed in this stream`

## Spec grounding

> parentSubagentRunId need only name a subagent that has been started, not one still active

Source: <https://docs.ag-ui.com/concepts/subagents#nesting-and-concurrency>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI605-unknown-parent-subagent-run-id`](../../spec/fixtures/invalid/AGUI605-unknown-parent-subagent-run-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300020400}
{"type":"SUBAGENT_STARTED","subagentRunId":"sub_001","name":"researcher","parentSubagentRunId":"sub_ghost","timestamp":1755300020500}
{"type":"SUBAGENT_FINISHED","subagentRunId":"sub_001","timestamp":1755300020600}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300020700}
```

Expected findings:

- `warning` AGUI605 at event 1 — SUBAGENT_STARTED parentSubagentRunId 'sub_ghost' matches no subagent observed in this stream
