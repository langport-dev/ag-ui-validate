# AGUI606 — Continuation event's subagentRunId disagrees with its entity's owner

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** warning · **Group:** Subagents · **Checked in:** core · **Since:** 0.x

**Message:** `{type} declares subagentRunId '{actual}', but {entityType} '{entityId}' was opened under {expected}`

## Spec grounding

> Continuation and close events agree with the owner their entity was created under.

Source: <https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-15](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI606-continuation-owner-mismatch`](../../spec/fixtures/invalid/AGUI606-continuation-owner-mismatch)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300020800}
{"type":"SUBAGENT_STARTED","subagentRunId":"sub_1","name":"researcher","timestamp":1755300020900}
{"type":"TEXT_MESSAGE_START","messageId":"msg_1","role":"assistant","subagentRunId":"sub_1","timestamp":1755300021000}
{"type":"TEXT_MESSAGE_END","messageId":"msg_1","subagentRunId":"sub_2","timestamp":1755300021100}
{"type":"SUBAGENT_FINISHED","subagentRunId":"sub_1","timestamp":1755300021200}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300021300}
```

Expected findings:

- `warning` AGUI606 at event 3 — TEXT_MESSAGE_END declares subagentRunId 'sub_2', but messageId 'msg_1' was opened under 'sub_1'
