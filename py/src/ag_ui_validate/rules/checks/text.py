"""Text message rules: AGUI101-AGUI106, plus TEXT_MESSAGE_CHUNK stream
handling. Mirrors js/src/rules/checks/text.ts.
"""

from __future__ import annotations

from typing import Any, Dict

from .context import CheckApi, EmitFn, OpenMessage, RunState, TextChunk, str_field


def handle_text_event(api: CheckApi) -> None:
    api.feature("agentic-chat")
    run = api.run
    event = api.event
    index = api.index
    emit = api.emit
    type_ = api.type

    if type_ == "TEXT_MESSAGE_START":
        message_id = str_field(event, "messageId")
        if message_id is None:
            return
        if message_id in run.open_messages:
            emit(
                "AGUI106",
                {"messageId": message_id},
                {"pointer": "/messageId", "relatedEventIndex": run.open_messages[message_id].start_index},
            )
            return
        if message_id in run.closed_messages:
            emit(
                "AGUI104",
                {"messageId": message_id},
                {"pointer": "/messageId", "relatedEventIndex": run.closed_messages[message_id]},
            )
            return
        run.open_messages[message_id] = OpenMessage(start_index=index)
        run.known_message_ids.add(message_id)
        return

    if type_ == "TEXT_MESSAGE_CONTENT":
        message_id = str_field(event, "messageId")
        if message_id is None:
            return
        open_ = run.open_messages.get(message_id)
        if open_ is None:
            extra: Dict[str, Any] = {"pointer": "/messageId"}
            closed_at = run.closed_messages.get(message_id)
            if closed_at is not None:
                extra["relatedEventIndex"] = closed_at
            emit("AGUI101", {"messageId": message_id}, extra)
            return
        if event.get("delta") == "":
            emit(
                "AGUI105",
                {"messageId": message_id},
                {"pointer": "/delta", "relatedEventIndex": open_.start_index},
            )
        return

    if type_ == "TEXT_MESSAGE_END":
        message_id = str_field(event, "messageId")
        if message_id is None:
            return
        if message_id not in run.open_messages:
            emit("AGUI102", {"messageId": message_id}, {"pointer": "/messageId"})
            return
        del run.open_messages[message_id]
        run.closed_messages[message_id] = index
        return

    if type_ == "TEXT_MESSAGE_CHUNK":
        message_id = str_field(event, "messageId")
        if message_id is None:
            # Continuation chunks may omit messageId; the first chunk must not
            # (docs: "First chunk for a message must include messageId").
            if run.text_chunk is None:
                emit(
                    "AGUI504",
                    {"type": type_, "detail": "first TEXT_MESSAGE_CHUNK for a message must include messageId"},
                    {"pointer": "/messageId"},
                )
            return
        # Mixing chunk and explicit forms on one id is undefined behaviour
        # (SQ-9): tolerated, treated as content for the open message.
        if message_id in run.open_messages:
            return
        if run.text_chunk is not None and run.text_chunk.message_id == message_id:
            return
        close_text_chunk(run, index)
        if message_id in run.closed_messages:
            emit(
                "AGUI104",
                {"messageId": message_id},
                {"pointer": "/messageId", "relatedEventIndex": run.closed_messages[message_id]},
            )
            return
        run.text_chunk = TextChunk(message_id=message_id, start_index=index)
        run.known_message_ids.add(message_id)
        return


def close_text_chunk(run: RunState, at_index: int) -> None:
    """Chunk streams close implicitly on the next non-chunk event."""
    if run.text_chunk is None:
        return
    run.closed_messages[run.text_chunk.message_id] = at_index
    run.text_chunk = None


def end_of_run_text(run: RunState, emit: EmitFn, at_index: int) -> None:
    """AGUI103 - open messages when the run reaches a clean end."""
    for message_id, open_ in run.open_messages.items():
        emit(
            "AGUI103",
            {"messageId": message_id},
            {"eventIndex": at_index, "relatedEventIndex": open_.start_index},
        )
