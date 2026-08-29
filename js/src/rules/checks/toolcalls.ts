// Tool call rules: AGUI201–AGUI208, plus TOOL_CALL_CHUNK stream handling.

import type { CheckApi, RunState, EmitFn } from "./context.js"
import { checkOwnerConsistency, str } from "./context.js"

export function handleToolCallEvent(api: CheckApi): void {
  const { type, event, run, emit, index } = api
  api.feature("backend-tool-rendering")

  switch (type) {
    case "TOOL_CALL_START": {
      const id = str(event, "toolCallId")
      if (id === undefined) return
      if (run.openToolCalls.has(id) || run.closedToolCalls.has(id)) {
        const related = run.openToolCalls.get(id)?.startIndex ?? run.closedToolCalls.get(id)!
        emit("AGUI205", { toolCallId: id }, { pointer: "/toolCallId", relatedEventIndex: related })
        return
      }
      const parent = str(event, "parentMessageId")
      // An untagged call inherits its parent message's owner (AGUI606's "an
      // untagged tool call inherits the parent message's owner");
      // ToolCallResult is deliberately exempt — it states its own owner.
      const owner = str(event, "subagentRunId") ?? (parent !== undefined ? run.messageOwner.get(parent) : undefined)
      run.openToolCalls.set(id, { startIndex: index, args: "", sawArgs: false, owner })
      if (parent !== undefined && !run.knownMessageIds.has(parent)) {
        emit("AGUI208", { parentMessageId: parent }, { pointer: "/parentMessageId" })
      }
      return
    }

    case "TOOL_CALL_ARGS": {
      const id = str(event, "toolCallId")
      if (id === undefined) return
      const open = run.openToolCalls.get(id)
      if (open === undefined) {
        emit("AGUI201", { toolCallId: id }, { pointer: "/toolCallId" })
        return
      }
      const delta = str(event, "delta")
      if (delta !== undefined) {
        open.args += delta
        open.sawArgs = true
      }
      checkOwnerConsistency(emit, type, "toolCallId", id, event, open.owner)
      return
    }

    case "TOOL_CALL_END": {
      const id = str(event, "toolCallId")
      if (id === undefined) return
      const open = run.openToolCalls.get(id)
      if (open === undefined) {
        emit("AGUI202", { toolCallId: id }, { pointer: "/toolCallId" })
        return
      }
      checkOwnerConsistency(emit, type, "toolCallId", id, event, open.owner)
      run.openToolCalls.delete(id)
      run.closedToolCalls.set(id, index)
      checkArgsJson(id, open, emit, index)
      return
    }

    case "TOOL_CALL_RESULT": {
      const id = str(event, "toolCallId")
      if (id !== undefined) {
        const open = run.openToolCalls.get(id)
        if (open !== undefined) {
          emit("AGUI206", { toolCallId: id }, {
            pointer: "/toolCallId",
            relatedEventIndex: open.startIndex,
          })
        } else if (!run.closedToolCalls.has(id) && !run.knownToolCallIds.has(id)) {
          emit("AGUI207", { toolCallId: id }, { pointer: "/toolCallId" })
        }
      }
      // The result is itself a tool message in the conversation.
      const messageId = str(event, "messageId")
      if (messageId !== undefined) run.knownMessageIds.add(messageId)
      return
    }

    case "TOOL_CALL_CHUNK": {
      const id = str(event, "toolCallId")
      const delta = str(event, "delta")
      if (id === undefined) {
        if (run.toolChunk === null) {
          emit("AGUI504", { type, detail: "first TOOL_CALL_CHUNK for a tool call must include toolCallId and toolCallName" }, {
            pointer: "/toolCallId",
          })
          return
        }
        if (delta !== undefined) {
          run.toolChunk.args += delta
          run.toolChunk.sawArgs = true
        }
        return
      }
      // SQ-9: chunk continuing an explicitly-opened call — treat as args.
      const openExplicit = run.openToolCalls.get(id)
      if (openExplicit !== undefined) {
        if (delta !== undefined) {
          openExplicit.args += delta
          openExplicit.sawArgs = true
        }
        return
      }
      if (run.toolChunk !== null && run.toolChunk.toolCallId === id) {
        if (delta !== undefined) {
          run.toolChunk.args += delta
          run.toolChunk.sawArgs = true
        }
        return
      }
      closeToolChunk(run, emit, index)
      if (run.closedToolCalls.has(id)) {
        emit("AGUI205", { toolCallId: id }, {
          pointer: "/toolCallId",
          relatedEventIndex: run.closedToolCalls.get(id)!,
        })
        return
      }
      if (str(event, "toolCallName") === undefined) {
        emit("AGUI504", { type, detail: "first TOOL_CALL_CHUNK for a tool call must include toolCallName" }, {
          pointer: "/toolCallName",
        })
      }
      run.toolChunk = {
        toolCallId: id,
        startIndex: index,
        args: delta ?? "",
        sawArgs: delta !== undefined && delta.length > 0,
      }
      return
    }
  }
}

function checkArgsJson(
  id: string,
  call: { startIndex: number; args: string; sawArgs: boolean },
  emit: EmitFn,
  atIndex: number,
): void {
  // A call that streamed no args at all is fine (a no-argument tool).
  if (!call.sawArgs || call.args.length === 0) return
  try {
    JSON.parse(call.args)
  } catch (e) {
    emit("AGUI204", { toolCallId: id, error: e instanceof Error ? e.message : String(e) }, {
      eventIndex: atIndex,
      relatedEventIndex: call.startIndex,
    })
  }
}

/** Chunk streams close implicitly on the next non-chunk event. */
export function closeToolChunk(run: RunState, emit: EmitFn, atIndex: number): void {
  if (run.toolChunk === null) return
  const { toolCallId, startIndex, args, sawArgs } = run.toolChunk
  run.toolChunk = null
  run.closedToolCalls.set(toolCallId, atIndex)
  checkArgsJson(toolCallId, { startIndex, args, sawArgs }, emit, atIndex)
}

/** AGUI203 — open tool calls when the run reaches a clean end. */
export function endOfRunToolCalls(run: RunState, emit: EmitFn, atIndex: number): void {
  for (const [id, open] of run.openToolCalls) {
    emit("AGUI203", { toolCallId: id }, {
      eventIndex: atIndex,
      relatedEventIndex: open.startIndex,
    })
  }
}
