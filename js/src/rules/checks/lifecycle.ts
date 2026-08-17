// Lifecycle rules: AGUI001–AGUI008. Run open/terminate logic lives in the
// engine (src/index.ts) because it owns run-scope resets; this module holds
// the step pairing and the RUN_FINISHED id-stability check.

import type { CheckApi, RunState, EmitFn } from "./context.js"
import { str } from "./context.js"

export function handleStepEvent(api: CheckApi): void {
  const { type, event, run, emit, index } = api
  const stepName = str(event, "stepName")
  if (stepName === undefined) return

  if (type === "STEP_STARTED") {
    const open = run.openSteps.get(stepName)
    if (open !== undefined) {
      open.count += 1 // re-entrant same-name steps are tolerated (SQ-10)
    } else {
      run.openSteps.set(stepName, { count: 1, firstIndex: index })
    }
    return
  }

  if (type === "STEP_FINISHED") {
    const open = run.openSteps.get(stepName)
    if (open === undefined) {
      emit("AGUI006", { stepName }, { pointer: "/stepName" })
      return
    }
    open.count -= 1
    if (open.count === 0) run.openSteps.delete(stepName)
  }
}

/** AGUI008 — RUN_FINISHED must carry the ids RUN_STARTED established. */
export function checkRunIdStability(api: CheckApi): void {
  const { event, run, emit } = api
  if (run.implicit) return // no RUN_STARTED to compare against
  for (const field of ["threadId", "runId"] as const) {
    const actual = str(api.event, field)
    const expected = field === "threadId" ? run.threadId : run.runId
    if (actual !== undefined && expected !== null && actual !== expected) {
      emit("AGUI008", { field, actual, expected }, {
        pointer: `/${field}`,
        relatedEventIndex: run.startIndex,
      })
    }
  }
  void event
}

/** AGUI007 — open steps when the run reaches a clean end. */
export function endOfRunSteps(run: RunState, emit: EmitFn, atIndex: number): void {
  for (const [stepName, open] of run.openSteps) {
    emit("AGUI007", { stepName }, {
      eventIndex: atIndex,
      relatedEventIndex: open.firstIndex,
    })
  }
}
