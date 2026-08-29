---
"ag-ui-validate": minor
---

Support for the AG-UI subagent lifecycle events (`SUBAGENT_STARTED`/`SUBAGENT_FINISHED`/`SUBAGENT_ERROR`, added in `@ag-ui/core` 0.0.59 / `ag-ui-protocol` 0.1.21), in parity across JS and Python. Six new rules (`AGUI601`–`AGUI606`) catch duplicate or unmatched `SUBAGENT_STARTED`/`FINISHED`/`ERROR` (with the suspended-subagent resumption exception), subagents left open at `RUN_FINISHED`, unknown `parentSubagentRunId` references, and continuation events (text messages, tool calls, steps) whose `subagentRunId` disagrees with the owner their entity was opened under.
