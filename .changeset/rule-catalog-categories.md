---
"ag-ui-validate": minor
---

Every rule in the catalog now carries a `category` (`lifecycle`, `text`, `toolcall`, `state`, `reasoning`, `transport`, or `hygiene`), matching the grouping already used in the docs and rule index. `--json` diagnostics and SARIF rule metadata (as a `properties.tags` entry) now include it, so downstream tooling can group or filter findings without re-deriving the category from the rule ID.
