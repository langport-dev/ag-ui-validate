// Text message rules: AGUI101–AGUI106, plus TEXT_MESSAGE_CHUNK stream handling.

import type { CheckApi, RunState, EmitFn } from "./context.js"
import { checkOwnerConsistency, str } from "./context.js"

export function handleTextEvent(api: CheckApi): void {
  const { type, event, run, emit, index } = api
  api.feature("agentic-chat")

  switch (type) {
    case "TEXT_MESSAGE_START": {
      const id = str(event, "messageId")
      if (id === undefined) return
      if (run.openMessages.has(id)) {
        emit("AGUI106", { messageId: id }, {
          pointer: "/messageId",
          relatedEventIndex: run.openMessages.get(id)!.startIndex,
        })
        return
      }
      if (run.closedMessages.has(id)) {
        emit("AGUI104", { messageId: id }, {
          pointer: "/messageId",
          relatedEventIndex: run.closedMessages.get(id)!,
        })
        return
      }
      const owner = str(event, "subagentRunId")
      run.openMessages.set(id, { startIndex: index, owner })
      run.knownMessageIds.add(id)
      run.messageOwner.set(id, owner)
      return
    }

    case "TEXT_MESSAGE_CONTENT": {
      const id = str(event, "messageId")
      if (id === undefined) return
      const open = run.openMessages.get(id)
      if (open === undefined) {
        const closedAt = run.closedMessages.get(id)
        emit("AGUI101", { messageId: id }, {
          pointer: "/messageId",
          ...(closedAt !== undefined ? { relatedEventIndex: closedAt } : {}),
        })
        return
      }
      if (event.delta === "") {
        emit("AGUI105", { messageId: id }, { pointer: "/delta", relatedEventIndex: open.startIndex })
      }
      checkOwnerConsistency(emit, type, "messageId", id, event, open.owner)
      return
    }

    case "TEXT_MESSAGE_END": {
      const id = str(event, "messageId")
      if (id === undefined) return
      const open = run.openMessages.get(id)
      if (open === undefined) {
        emit("AGUI102", { messageId: id }, { pointer: "/messageId" })
        return
      }
      checkOwnerConsistency(emit, type, "messageId", id, event, open.owner)
      run.openMessages.delete(id)
      run.closedMessages.set(id, index)
      return
    }

    case "TEXT_MESSAGE_CHUNK": {
      const id = str(event, "messageId")
      if (id === undefined) {
        // Continuation chunks may omit messageId; the first chunk must not
        // (docs: "First chunk for a message must include messageId").
        if (run.textChunk === null) {
          emit("AGUI504", { type, detail: "first TEXT_MESSAGE_CHUNK for a message must include messageId" }, {
            pointer: "/messageId",
          })
        }
        return
      }
      // Mixing chunk and explicit forms on one id is undefined behaviour
      // (SQ-9): tolerated, treated as content for the open message.
      if (run.openMessages.has(id)) return
      if (run.textChunk !== null && run.textChunk.messageId === id) return
      closeTextChunk(run, index)
      if (run.closedMessages.has(id)) {
        emit("AGUI104", { messageId: id }, {
          pointer: "/messageId",
          relatedEventIndex: run.closedMessages.get(id)!,
        })
        return
      }
      run.textChunk = { messageId: id, startIndex: index }
      run.knownMessageIds.add(id)
      // Chunk attribution consistency is a known gap (SQ-15); still record
      // the owner so a TOOL_CALL_START.parentMessageId can inherit it.
      run.messageOwner.set(id, str(event, "subagentRunId"))
      return
    }
  }
}

/** Chunk streams close implicitly on the next non-chunk event. */
export function closeTextChunk(run: RunState, atIndex: number): void {
  if (run.textChunk === null) return
  run.closedMessages.set(run.textChunk.messageId, atIndex)
  run.textChunk = null
}

/** AGUI103 — open messages when the run reaches a clean end. */
export function endOfRunText(run: RunState, emit: EmitFn, atIndex: number): void {
  for (const [id, open] of run.openMessages) {
    emit("AGUI103", { messageId: id }, {
      eventIndex: atIndex,
      relatedEventIndex: open.startIndex,
    })
  }
}
