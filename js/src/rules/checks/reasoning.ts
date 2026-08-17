// Reasoning rules: AGUI401–AGUI402, plus REASONING_MESSAGE_CHUNK handling.
//
// Per SQ-4: block-level nesting (REASONING_MESSAGE_* inside
// REASONING_START/END) is only described as "a typical flow" by the docs, so
// it is NOT enforced. AGUI401 enforces the message-level pairing, mirroring
// the text message rules; AGUI402 reports unterminated starts at warning.

import type { CheckApi, RunState, EmitFn } from "./context.js"
import { str } from "./context.js"

export function handleReasoningEvent(api: CheckApi): void {
  const { type, event, run, emit, index } = api

  switch (type) {
    case "REASONING_START": {
      const id = str(event, "messageId")
      if (id !== undefined) run.openReasoningBlocks.set(id, index)
      return
    }

    case "REASONING_END": {
      const id = str(event, "messageId")
      if (id !== undefined) run.openReasoningBlocks.delete(id)
      return
    }

    case "REASONING_MESSAGE_START": {
      const id = str(event, "messageId")
      if (id !== undefined) run.openReasoningMessages.set(id, index)
      return
    }

    case "REASONING_MESSAGE_CONTENT": {
      const id = str(event, "messageId")
      if (id === undefined) return
      const openChunk = run.reasoningChunk !== null && run.reasoningChunk.messageId === id
      if (!run.openReasoningMessages.has(id) && !openChunk) {
        emit("AGUI401", { messageId: id }, { pointer: "/messageId" })
      }
      return
    }

    case "REASONING_MESSAGE_END": {
      const id = str(event, "messageId")
      if (id !== undefined) run.openReasoningMessages.delete(id)
      return
    }

    case "REASONING_MESSAGE_CHUNK": {
      const id = str(event, "messageId")
      if (id === undefined) {
        if (run.reasoningChunk === null) {
          emit("AGUI504", { type, detail: "first REASONING_MESSAGE_CHUNK must include messageId" }, {
            pointer: "/messageId",
          })
          return
        }
        if (event.delta === "") run.reasoningChunk = null // documented implicit close
        return
      }
      if (run.reasoningChunk !== null && run.reasoningChunk.messageId !== id) {
        run.reasoningChunk = null
      }
      if (event.delta === "") {
        run.reasoningChunk = null // empty delta implicitly closes the message
        return
      }
      if (run.reasoningChunk === null) {
        run.reasoningChunk = { messageId: id, startIndex: index }
      }
      return
    }

    // REASONING_ENCRYPTED_VALUE: schema-checked only; no ordering rules cited.
  }
}

/** Chunked reasoning also closes on any non-reasoning event (documented). */
export function closeReasoningChunk(run: RunState): void {
  run.reasoningChunk = null
}

/** AGUI402 — unterminated reasoning at a clean run end. */
export function endOfRunReasoning(run: RunState, emit: EmitFn, atIndex: number): void {
  for (const [id, startIndex] of run.openReasoningBlocks) {
    emit("AGUI402", { startType: "REASONING_START", messageId: id }, {
      eventIndex: atIndex,
      relatedEventIndex: startIndex,
    })
  }
  for (const [id, startIndex] of run.openReasoningMessages) {
    emit("AGUI402", { startType: "REASONING_MESSAGE_START", messageId: id }, {
      eventIndex: atIndex,
      relatedEventIndex: startIndex,
    })
  }
}
