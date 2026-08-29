"""Tool call rules: AGUI201-AGUI208, plus TOOL_CALL_CHUNK stream handling.
Mirrors js/src/rules/checks/toolcalls.ts.
"""

from __future__ import annotations

import json

from .context import CheckApi, EmitFn, OpenToolCall, RunState, ToolChunk, check_owner_consistency, str_field


def handle_tool_call_event(api: CheckApi) -> None:
    api.feature("backend-tool-rendering")
    run = api.run
    event = api.event
    index = api.index
    emit = api.emit
    type_ = api.type

    if type_ == "TOOL_CALL_START":
        tool_call_id = str_field(event, "toolCallId")
        if tool_call_id is None:
            return
        if tool_call_id in run.open_tool_calls or tool_call_id in run.closed_tool_calls:
            open_ = run.open_tool_calls.get(tool_call_id)
            related = open_.start_index if open_ is not None else run.closed_tool_calls[tool_call_id]
            emit("AGUI205", {"toolCallId": tool_call_id}, {"pointer": "/toolCallId", "relatedEventIndex": related})
            return
        parent = str_field(event, "parentMessageId")
        # An untagged call inherits its parent message's owner (AGUI606's
        # "an untagged tool call inherits the parent message's owner");
        # ToolCallResult is deliberately exempt - it states its own owner.
        owner = str_field(event, "subagentRunId")
        if owner is None and parent is not None:
            owner = run.message_owner.get(parent)
        run.open_tool_calls[tool_call_id] = OpenToolCall(start_index=index, owner=owner)
        if parent is not None and parent not in run.known_message_ids:
            emit("AGUI208", {"parentMessageId": parent}, {"pointer": "/parentMessageId"})
        return

    if type_ == "TOOL_CALL_ARGS":
        tool_call_id = str_field(event, "toolCallId")
        if tool_call_id is None:
            return
        open_ = run.open_tool_calls.get(tool_call_id)
        if open_ is None:
            emit("AGUI201", {"toolCallId": tool_call_id}, {"pointer": "/toolCallId"})
            return
        delta = str_field(event, "delta")
        if delta is not None:
            open_.args += delta
            open_.saw_args = True
        check_owner_consistency(emit, type_, "toolCallId", tool_call_id, event, open_.owner)
        return

    if type_ == "TOOL_CALL_END":
        tool_call_id = str_field(event, "toolCallId")
        if tool_call_id is None:
            return
        open_ = run.open_tool_calls.get(tool_call_id)
        if open_ is None:
            emit("AGUI202", {"toolCallId": tool_call_id}, {"pointer": "/toolCallId"})
            return
        check_owner_consistency(emit, type_, "toolCallId", tool_call_id, event, open_.owner)
        del run.open_tool_calls[tool_call_id]
        run.closed_tool_calls[tool_call_id] = index
        _check_args_json(tool_call_id, open_, emit, index)
        return

    if type_ == "TOOL_CALL_RESULT":
        tool_call_id = str_field(event, "toolCallId")
        if tool_call_id is not None:
            open_ = run.open_tool_calls.get(tool_call_id)
            if open_ is not None:
                emit(
                    "AGUI206",
                    {"toolCallId": tool_call_id},
                    {"pointer": "/toolCallId", "relatedEventIndex": open_.start_index},
                )
            elif tool_call_id not in run.closed_tool_calls and tool_call_id not in run.known_tool_call_ids:
                emit("AGUI207", {"toolCallId": tool_call_id}, {"pointer": "/toolCallId"})
        # The result is itself a tool message in the conversation.
        message_id = str_field(event, "messageId")
        if message_id is not None:
            run.known_message_ids.add(message_id)
        return

    if type_ == "TOOL_CALL_CHUNK":
        tool_call_id = str_field(event, "toolCallId")
        delta = str_field(event, "delta")
        if tool_call_id is None:
            if run.tool_chunk is None:
                emit(
                    "AGUI504",
                    {
                        "type": type_,
                        "detail": "first TOOL_CALL_CHUNK for a tool call must include toolCallId and toolCallName",
                    },
                    {"pointer": "/toolCallId"},
                )
                return
            if delta is not None:
                run.tool_chunk.args += delta
                run.tool_chunk.saw_args = True
            return
        # SQ-9: chunk continuing an explicitly-opened call - treat as args.
        open_explicit = run.open_tool_calls.get(tool_call_id)
        if open_explicit is not None:
            if delta is not None:
                open_explicit.args += delta
                open_explicit.saw_args = True
            return
        if run.tool_chunk is not None and run.tool_chunk.tool_call_id == tool_call_id:
            if delta is not None:
                run.tool_chunk.args += delta
                run.tool_chunk.saw_args = True
            return
        close_tool_chunk(run, emit, index)
        if tool_call_id in run.closed_tool_calls:
            emit(
                "AGUI205",
                {"toolCallId": tool_call_id},
                {"pointer": "/toolCallId", "relatedEventIndex": run.closed_tool_calls[tool_call_id]},
            )
            return
        if str_field(event, "toolCallName") is None:
            emit(
                "AGUI504",
                {"type": type_, "detail": "first TOOL_CALL_CHUNK for a tool call must include toolCallName"},
                {"pointer": "/toolCallName"},
            )
        run.tool_chunk = ToolChunk(
            tool_call_id=tool_call_id,
            start_index=index,
            args=delta or "",
            saw_args=delta is not None and len(delta) > 0,
        )
        return


def _check_args_json(tool_call_id: str, call: OpenToolCall, emit: EmitFn, at_index: int) -> None:
    # A call that streamed no args at all is fine (a no-argument tool).
    if not call.saw_args or len(call.args) == 0:
        return
    try:
        json.loads(call.args)
    except ValueError as e:
        emit(
            "AGUI204",
            {"toolCallId": tool_call_id, "error": str(e)},
            {"eventIndex": at_index, "relatedEventIndex": call.start_index},
        )


def close_tool_chunk(run: RunState, emit: EmitFn, at_index: int) -> None:
    """Chunk streams close implicitly on the next non-chunk event."""
    if run.tool_chunk is None:
        return
    chunk = run.tool_chunk
    run.tool_chunk = None
    run.closed_tool_calls[chunk.tool_call_id] = at_index
    _check_args_json(
        chunk.tool_call_id,
        OpenToolCall(start_index=chunk.start_index, args=chunk.args, saw_args=chunk.saw_args),
        emit,
        at_index,
    )


def end_of_run_tool_calls(run: RunState, emit: EmitFn, at_index: int) -> None:
    """AGUI203 - open tool calls when the run reaches a clean end."""
    for tool_call_id, open_ in run.open_tool_calls.items():
        emit(
            "AGUI203",
            {"toolCallId": tool_call_id},
            {"eventIndex": at_index, "relatedEventIndex": open_.start_index},
        )
