# AGUI301 — STATE_DELTA before any STATE_SNAPSHOT

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** State · **Checked in:** core · **Since:** 0.x

**Message:** `STATE_DELTA precedes any STATE_SNAPSHOT; the base it applies to is not observable on this stream`

## Spec grounding

> This event is typically sent at the beginning of an interaction or when synchronization is needed.

Source: <https://docs.ag-ui.com/concepts/events#statesnapshot>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-1](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI301-delta-before-snapshot`](../../fixtures/invalid/AGUI301-delta-before-snapshot)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300016300}
{"type":"STATE_DELTA","delta":[{"op":"add","path":"/a","value":1}],"timestamp":1755300016400}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300016500}
```

Expected findings:

- `info` AGUI301 at event 1 — STATE_DELTA precedes any STATE_SNAPSHOT; the base it applies to is not observable on this stream
