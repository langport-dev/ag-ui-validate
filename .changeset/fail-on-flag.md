---
"ag-ui-validate": minor
---

New `--fail-on <error|warning|none>` flag (JS and Python, in parity): controls which severity triggers a nonzero exit. Defaults to `error`, matching today's behavior exactly. `--fail-on warning` also fails on any warning finding, independent of `--max-warnings`. `--fail-on none` never fails on findings — useful for report-only/annotate-only CI runs that shouldn't block the job.
