# AGUI304 — Mid-run STATE_SNAPSHOT discards accumulated deltas

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** State · **Checked in:** core · **Since:** 0.x

**Message:** `STATE_SNAPSHOT replaces state previously built from {deltaCount} delta(s)`

## Spec grounding

> This event is typically sent at the beginning of an interaction or when synchronization is needed.

Source: <https://docs.ag-ui.com/concepts/events#statesnapshot>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI304-midrun-snapshot-discards-deltas`](../../spec/fixtures/invalid/AGUI304-midrun-snapshot-discards-deltas)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300017400}
{"type":"STATE_SNAPSHOT","snapshot":{"a":1},"timestamp":1755300017500}
{"type":"STATE_DELTA","delta":[{"op":"replace","path":"/a","value":2}],"timestamp":1755300017600}
{"type":"STATE_SNAPSHOT","snapshot":{"a":99},"timestamp":1755300017700}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300017800}
```

Expected findings:

- `info` AGUI304 at event 3 — STATE_SNAPSHOT replaces state previously built from 1 delta(s)
