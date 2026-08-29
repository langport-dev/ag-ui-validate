# AGUI603 — SUBAGENT_ERROR without matching SUBAGENT_STARTED

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `SUBAGENT_ERROR for subagentRunId '{subagentRunId}' with no open SUBAGENT_STARTED`

## Spec grounding

> SubagentFinished and SubagentError name a subagent that is currently active

Source: <https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI603-error-without-start`](../../spec/fixtures/invalid/AGUI603-error-without-start)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300019800}
{"type":"SUBAGENT_ERROR","subagentRunId":"sub_ghost","message":"boom","timestamp":1755300019900}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300020000}
```

Expected findings:

- `error` AGUI603 at event 1 — SUBAGENT_ERROR for subagentRunId 'sub_ghost' with no open SUBAGENT_STARTED
