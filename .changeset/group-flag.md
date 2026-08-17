---
"ag-ui-validate": minor
---

New `--group` CLI flag: collapses repeated findings into one line per rule with a count and sample event indexes, for large streams where the same violation repeats. Summary totals and exit codes are unchanged. Also exported as `formatGroupedDiagnostics` from `ag-ui-validate/report`.
