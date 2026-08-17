"""State rules: AGUI301-AGUI305, plus MESSAGES_SNAPSHOT history harvesting.
Mirrors js/src/rules/checks/state.ts.
"""

from __future__ import annotations

from ...protocol.jsonpatch import PatchErr, apply_patch, validate_patch_shape
from .context import CheckApi


def handle_state_event(api: CheckApi) -> None:
    run = api.run
    stream = api.stream
    event = api.event
    emit = api.emit
    type_ = api.type

    if type_ == "STATE_SNAPSHOT":
        api.feature("shared-state")
        if run.state.deltas_since_snapshot > 0:
            emit("AGUI304", {"deltaCount": run.state.deltas_since_snapshot}, {})
        run.state.known = True
        run.state.value = event.get("snapshot")
        run.state.snapshot_seen = True
        run.state.deltas_since_snapshot = 0
        stream.any_snapshot = True
        return

    if type_ == "STATE_DELTA":
        api.feature("shared-state")
        delta = event.get("delta")
        if not isinstance(delta, list):
            return  # AGUI504 already reported the kind mismatch
        shape = validate_patch_shape(delta)
        if shape is not None:
            emit("AGUI303", {"error": shape.error}, {"pointer": f"/delta{shape.pointer}"})
            return
        if not run.state.snapshot_seen and not run.state.agui301_fired:
            # The base may be seeded out-of-band via RunAgentInput.state (SQ-1),
            # so this is informational, and patch application is not judged
            # until a snapshot establishes an observable base.
            emit("AGUI301", {}, {})
            run.state.agui301_fired = True
        if run.state.known:
            applied = apply_patch(run.state.value, delta)
            if isinstance(applied, PatchErr):
                emit("AGUI302", {"error": applied.error}, {"pointer": f"/delta/{applied.op_index}"})
            else:
                run.state.value = applied.result
        run.state.deltas_since_snapshot += 1
        return

    if type_ == "MESSAGES_SNAPSHOT":
        # Snapshots can carry history from before this capture: harvest ids so
        # reference checks (AGUI207/AGUI208) don't false-positive on them.
        messages = event.get("messages")
        if not isinstance(messages, list):
            return
        for message in messages:
            if not isinstance(message, dict):
                continue
            if isinstance(message.get("id"), str):
                run.known_message_ids.add(message["id"])
            tool_calls = message.get("toolCalls")
            if isinstance(tool_calls, list):
                for call in tool_calls:
                    if isinstance(call, dict) and isinstance(call.get("id"), str):
                        run.known_tool_call_ids.add(call["id"])
        return
