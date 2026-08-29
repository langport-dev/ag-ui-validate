# AGUI601 — Duplicate SUBAGENT_STARTED for a subagentRunId

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `SUBAGENT_STARTED reuses subagentRunId '{subagentRunId}', which is already in use this run`

## Spec grounding

> a subagent is not started twice within a run

Source: <https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI601-duplicate-subagent-started`](../../spec/fixtures/invalid/AGUI601-duplicate-subagent-started)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019000}
{"type":"SUBAGENT_STARTED","subagentRunId":"sub_001","name":"researcher","timestamp":1755300019100}
{"type":"SUBAGENT_STARTED","subagentRunId":"sub_001","name":"researcher","timestamp":1755300019200}
{"type":"SUBAGENT_FINISHED","subagentRunId":"sub_001","timestamp":1755300019300}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300019400}
```

Expected findings:

- `error` AGUI601 at event 2 — SUBAGENT_STARTED reuses subagentRunId 'sub_001', which is already in use this run
