# AGUI902 — Events carry no timestamps

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Protocol hygiene · **Checked in:** core · **Since:** 0.x

**Message:** `None of the {eventCount} events carry the optional timestamp property`

## Spec grounding

> timestamp: Optional timestamp indicating when the event was created

Source: <https://docs.ag-ui.com/concepts/events#base-event-properties>

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI902-no-timestamps`](../../spec/fixtures/invalid/AGUI902-no-timestamps)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001"}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001"}
```

Expected findings:

- `info` AGUI902 at stream — None of the 2 events carry the optional timestamp property
