// Subagent lifecycle rules: AGUI601–AGUI605.
//
// Scope: the SUBAGENT_STARTED/FINISHED/ERROR lifecycle itself, per
// https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce. Ownership
// consistency for events attributed to a subagent via their own optional
// subagentRunId field (text messages, tool calls, steps, ...) is a separate,
// broader concern not covered here.

import type { CheckApi, RunState, EmitFn } from "./context.js"
import { str } from "./context.js"

export function handleSubagentEvent(api: CheckApi): void {
  const { type, event, run, emit, index } = api

  switch (type) {
    case "SUBAGENT_STARTED": {
      const id = str(event, "subagentRunId")
      if (id === undefined) return
      run.knownSubagentRunIds.add(id)

      const open = run.openSubagents.get(id)
      if (open !== undefined) {
        emit("AGUI601", { subagentRunId: id }, { pointer: "/subagentRunId", relatedEventIndex: open.startIndex })
        return
      }
      const closed = run.closedSubagents.get(id)
      if (closed !== undefined && !closed.resumable) {
        emit("AGUI601", { subagentRunId: id }, { pointer: "/subagentRunId", relatedEventIndex: closed.index })
        return
      }

      // Either brand new, or a legitimate resumption of a suspended subagent.
      run.openSubagents.set(id, { startIndex: index })
      if (closed !== undefined) run.closedSubagents.delete(id)

      const parent = str(event, "parentSubagentRunId")
      if (parent !== undefined && !run.knownSubagentRunIds.has(parent)) {
        emit("AGUI605", { parentSubagentRunId: parent }, { pointer: "/parentSubagentRunId" })
      }
      return
    }

    case "SUBAGENT_FINISHED": {
      const id = str(event, "subagentRunId")
      if (id === undefined) return
      const open = run.openSubagents.get(id)
      if (open === undefined) {
        emit("AGUI602", { subagentRunId: id }, { pointer: "/subagentRunId" })
        return
      }
      run.openSubagents.delete(id)
      const outcome = event.outcome
      const resumable = typeof outcome === "object" && outcome !== null && (outcome as { type?: unknown }).type === "suspended"
      run.closedSubagents.set(id, { index, resumable })
      return
    }

    case "SUBAGENT_ERROR": {
      const id = str(event, "subagentRunId")
      if (id === undefined) return
      const open = run.openSubagents.get(id)
      if (open === undefined) {
        emit("AGUI603", { subagentRunId: id }, { pointer: "/subagentRunId" })
        return
      }
      run.openSubagents.delete(id)
      run.closedSubagents.set(id, { index, resumable: false })
      return
    }
  }
}

/** AGUI604 — open subagents when the run reaches a clean end. */
export function endOfRunSubagents(run: RunState, emit: EmitFn, atIndex: number): void {
  for (const [id, open] of run.openSubagents) {
    emit("AGUI604", { subagentRunId: id }, { eventIndex: atIndex, relatedEventIndex: open.startIndex })
  }
}
