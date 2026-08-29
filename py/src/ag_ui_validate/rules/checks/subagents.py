"""Subagent lifecycle rules: AGUI601-AGUI605. Mirrors
js/src/rules/checks/subagents.ts.

Scope: the SUBAGENT_STARTED/FINISHED/ERROR lifecycle itself, per
https://docs.ag-ui.com/concepts/subagents#rules-clients-enforce. Ownership
consistency for events attributed to a subagent via their own optional
`subagentRunId` field (text messages, tool calls, steps, ...) is a separate,
broader concern not covered here.
"""

from __future__ import annotations

from .context import CheckApi, ClosedSubagent, EmitFn, OpenSubagent, RunState, str_field


def handle_subagent_event(api: CheckApi) -> None:
    run = api.run
    event = api.event
    index = api.index
    emit = api.emit
    type_ = api.type

    if type_ == "SUBAGENT_STARTED":
        subagent_run_id = str_field(event, "subagentRunId")
        if subagent_run_id is None:
            return
        run.known_subagent_run_ids.add(subagent_run_id)

        open_ = run.open_subagents.get(subagent_run_id)
        if open_ is not None:
            emit(
                "AGUI601",
                {"subagentRunId": subagent_run_id},
                {"pointer": "/subagentRunId", "relatedEventIndex": open_.start_index},
            )
            return
        closed = run.closed_subagents.get(subagent_run_id)
        if closed is not None and not closed.resumable:
            emit(
                "AGUI601",
                {"subagentRunId": subagent_run_id},
                {"pointer": "/subagentRunId", "relatedEventIndex": closed.index},
            )
            return

        # Either brand new, or a legitimate resumption of a suspended subagent.
        run.open_subagents[subagent_run_id] = OpenSubagent(start_index=index)
        if closed is not None:
            del run.closed_subagents[subagent_run_id]

        parent = str_field(event, "parentSubagentRunId")
        if parent is not None and parent not in run.known_subagent_run_ids:
            emit("AGUI605", {"parentSubagentRunId": parent}, {"pointer": "/parentSubagentRunId"})
        return

    if type_ == "SUBAGENT_FINISHED":
        subagent_run_id = str_field(event, "subagentRunId")
        if subagent_run_id is None:
            return
        open_ = run.open_subagents.get(subagent_run_id)
        if open_ is None:
            emit("AGUI602", {"subagentRunId": subagent_run_id}, {"pointer": "/subagentRunId"})
            return
        del run.open_subagents[subagent_run_id]
        outcome = event.get("outcome")
        resumable = isinstance(outcome, dict) and outcome.get("type") == "suspended"
        run.closed_subagents[subagent_run_id] = ClosedSubagent(index=index, resumable=resumable)
        return

    if type_ == "SUBAGENT_ERROR":
        subagent_run_id = str_field(event, "subagentRunId")
        if subagent_run_id is None:
            return
        open_ = run.open_subagents.get(subagent_run_id)
        if open_ is None:
            emit("AGUI603", {"subagentRunId": subagent_run_id}, {"pointer": "/subagentRunId"})
            return
        del run.open_subagents[subagent_run_id]
        run.closed_subagents[subagent_run_id] = ClosedSubagent(index=index, resumable=False)
        return


def end_of_run_subagents(run: RunState, emit: EmitFn, at_index: int) -> None:
    """AGUI604 - open subagents when the run reaches a clean end."""
    for subagent_run_id, open_ in run.open_subagents.items():
        emit(
            "AGUI604",
            {"subagentRunId": subagent_run_id},
            {"eventIndex": at_index, "relatedEventIndex": open_.start_index},
        )
