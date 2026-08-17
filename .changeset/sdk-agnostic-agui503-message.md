---
"ag-ui-validate": patch
---

AGUI503's message no longer hardcodes `@ag-ui/core` — it now reads "not in the installed AG-UI SDK v{version}" instead of "not in @ag-ui/core v{version}". Surfaced by the Python port sharing the same catalog: the old wording was misleading coming from a validator built on a different SDK.
