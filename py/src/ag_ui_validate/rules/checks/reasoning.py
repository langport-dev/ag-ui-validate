"""Reasoning rules: AGUI401-AGUI402, plus REASONING_MESSAGE_CHUNK handling.

Per SQ-4: block-level nesting (REASONING_MESSAGE_* inside
REASONING_START/END) is only described as "a typical flow" by the docs, so
it is NOT enforced. AGUI401 enforces the message-level pairing, mirroring
the text message rules; AGUI402 reports unterminated starts at warning.
Mirrors js/src/rules/checks/reasoning.ts.
"""

from __future__ import annotations

from .context import CheckApi, EmitFn, ReasoningChunk, RunState, str_field


def handle_reasoning_event(api: CheckApi) -> None:
    run = api.run
    event = api.event
    index = api.index
    emit = api.emit
    type_ = api.type

    if type_ == "REASONING_START":
        message_id = str_field(event, "messageId")
        if message_id is not None:
            run.open_reasoning_blocks[message_id] = index
        return

    if type_ == "REASONING_END":
        message_id = str_field(event, "messageId")
        if message_id is not None:
            run.open_reasoning_blocks.pop(message_id, None)
        return

    if type_ == "REASONING_MESSAGE_START":
        message_id = str_field(event, "messageId")
        if message_id is not None:
            run.open_reasoning_messages[message_id] = index
        return

    if type_ == "REASONING_MESSAGE_CONTENT":
        message_id = str_field(event, "messageId")
        if message_id is None:
            return
        open_chunk = run.reasoning_chunk is not None and run.reasoning_chunk.message_id == message_id
        if message_id not in run.open_reasoning_messages and not open_chunk:
            emit("AGUI401", {"messageId": message_id}, {"pointer": "/messageId"})
        return

    if type_ == "REASONING_MESSAGE_END":
        message_id = str_field(event, "messageId")
        if message_id is not None:
            run.open_reasoning_messages.pop(message_id, None)
        return

    if type_ == "REASONING_MESSAGE_CHUNK":
        message_id = str_field(event, "messageId")
        if message_id is None:
            if run.reasoning_chunk is None:
                emit(
                    "AGUI504",
                    {"type": type_, "detail": "first REASONING_MESSAGE_CHUNK must include messageId"},
                    {"pointer": "/messageId"},
                )
                return
            if event.get("delta") == "":
                run.reasoning_chunk = None  # documented implicit close
            return
        if run.reasoning_chunk is not None and run.reasoning_chunk.message_id != message_id:
            run.reasoning_chunk = None
        if event.get("delta") == "":
            run.reasoning_chunk = None  # empty delta implicitly closes the message
            return
        if run.reasoning_chunk is None:
            run.reasoning_chunk = ReasoningChunk(message_id=message_id, start_index=index)
        return

    # REASONING_ENCRYPTED_VALUE: schema-checked only; no ordering rules cited.


def close_reasoning_chunk(run: RunState) -> None:
    """Chunked reasoning also closes on any non-reasoning event (documented)."""
    run.reasoning_chunk = None


def end_of_run_reasoning(run: RunState, emit: EmitFn, at_index: int) -> None:
    """AGUI402 - unterminated reasoning at a clean run end."""
    for message_id, start_index in run.open_reasoning_blocks.items():
        emit(
            "AGUI402",
            {"startType": "REASONING_START", "messageId": message_id},
            {"eventIndex": at_index, "relatedEventIndex": start_index},
        )
    for message_id, start_index in run.open_reasoning_messages.items():
        emit(
            "AGUI402",
            {"startType": "REASONING_MESSAGE_START", "messageId": message_id},
            {"eventIndex": at_index, "relatedEventIndex": start_index},
        )
