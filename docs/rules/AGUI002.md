# AGUI002 — Multiple RUN_STARTED in one run

<!-- Generated from src/rules/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** error · **Group:** Lifecycle · **Checked in:** core · **Since:** 0.x

**Message:** `Duplicate RUN_STARTED (runId '{runId}') before the active run terminated`

## Spec grounding

> The RunStarted and either RunFinished or RunError events are mandatory, forming the boundaries of an agent run.

Source: <https://docs.ag-ui.com/concepts/events#lifecycle-events>

## Example

A violating stream from the corpus ([`fixtures/invalid/AGUI002-duplicate-run-started`](../../fixtures/invalid/AGUI002-duplicate-run-started)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300008300}
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_002","timestamp":1755300008400}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300008500}
```

Expected findings:

- `error` AGUI002 at event 1 — Duplicate RUN_STARTED (runId 'run_002') before the active run terminated
