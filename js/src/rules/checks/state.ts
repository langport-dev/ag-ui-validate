// State rules: AGUI301–AGUI305, plus MESSAGES_SNAPSHOT history harvesting.

import { applyPatch, validatePatchShape } from "../../protocol/jsonpatch.js"
import type { CheckApi } from "./context.js"

export function handleStateEvent(api: CheckApi): void {
  const { type, event, run, stream, emit } = api

  switch (type) {
    case "STATE_SNAPSHOT": {
      api.feature("shared-state")
      if (run.state.deltasSinceSnapshot > 0) {
        emit("AGUI304", { deltaCount: run.state.deltasSinceSnapshot }, {})
      }
      run.state.known = true
      run.state.value = event.snapshot
      run.state.snapshotSeen = true
      run.state.deltasSinceSnapshot = 0
      stream.anySnapshot = true
      return
    }

    case "STATE_DELTA": {
      api.feature("shared-state")
      const delta = event.delta
      if (!Array.isArray(delta)) return // AGUI504 already reported the kind mismatch
      const shape = validatePatchShape(delta)
      if (shape !== null) {
        emit("AGUI303", { error: shape.error }, { pointer: `/delta${shape.pointer}` })
        return
      }
      if (!run.state.snapshotSeen && !run.state.agui301Fired) {
        // The base may be seeded out-of-band via RunAgentInput.state (SQ-1),
        // so this is informational, and patch application is not judged until
        // a snapshot establishes an observable base.
        emit("AGUI301", {}, {})
        run.state.agui301Fired = true
      }
      if (run.state.known) {
        const applied = applyPatch(run.state.value, delta)
        if (applied.ok) {
          run.state.value = applied.result
        } else {
          emit("AGUI302", { error: applied.error }, { pointer: `/delta/${applied.opIndex}` })
        }
      }
      run.state.deltasSinceSnapshot += 1
      return
    }

    case "MESSAGES_SNAPSHOT": {
      // Snapshots can carry history from before this capture: harvest ids so
      // reference checks (AGUI207/AGUI208) don't false-positive on them.
      const messages = event.messages
      if (!Array.isArray(messages)) return
      for (const message of messages) {
        if (typeof message !== "object" || message === null) continue
        const m = message as Record<string, unknown>
        if (typeof m.id === "string") run.knownMessageIds.add(m.id)
        if (Array.isArray(m.toolCalls)) {
          for (const call of m.toolCalls) {
            if (typeof call === "object" && call !== null) {
              const id = (call as Record<string, unknown>).id
              if (typeof id === "string") run.knownToolCallIds.add(id)
            }
          }
        }
      }
      return
    }
  }
}
