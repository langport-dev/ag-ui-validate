# AGUI604 — Subagent unterminated at run end

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `SUBAGENT_STARTED subagentRunId '{subagentRunId}' never closed with SUBAGENT_FINISHED or SUBAGENT_ERROR`

## Spec grounding

> Every started subagent is closed before RunFinished.

Source: <https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI604-subagent-unterminated`](../../spec/fixtures/invalid/AGUI604-subagent-unterminated)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300020100}
{"type":"SUBAGENT_STARTED","subagentRunId":"sub_001","name":"researcher","timestamp":1755300020200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300020300}
```

Expected findings:

- `error` AGUI604 at event 2 — SUBAGENT_STARTED subagentRunId 'sub_001' never closed with SUBAGENT_FINISHED or SUBAGENT_ERROR
