"""Lifecycle rules: AGUI001-AGUI008. Run open/terminate logic lives in the
engine (engine.py) because it owns run-scope resets; this module holds the
step pairing and the RUN_FINISHED id-stability check. Mirrors
js/src/rules/checks/lifecycle.ts.
"""

from __future__ import annotations

from .context import CheckApi, EmitFn, OpenStep, RunState, str_field


def handle_step_event(api: CheckApi) -> None:
    step_name = str_field(api.event, "stepName")
    if step_name is None:
        return

    if api.type == "STEP_STARTED":
        open_ = api.run.open_steps.get(step_name)
        if open_ is not None:
            open_.count += 1  # re-entrant same-name steps are tolerated (SQ-10)
        else:
            api.run.open_steps[step_name] = OpenStep(count=1, first_index=api.index)
        return

    if api.type == "STEP_FINISHED":
        open_ = api.run.open_steps.get(step_name)
        if open_ is None:
            api.emit("AGUI006", {"stepName": step_name}, {"pointer": "/stepName"})
            return
        open_.count -= 1
        if open_.count == 0:
            del api.run.open_steps[step_name]


def check_run_id_stability(api: CheckApi) -> None:
    """AGUI008 - RUN_FINISHED must carry the ids RUN_STARTED established."""
    run = api.run
    if run.implicit:
        return  # no RUN_STARTED to compare against
    for field_name, expected in (("threadId", run.thread_id), ("runId", run.run_id)):
        actual = str_field(api.event, field_name)
        if actual is not None and expected is not None and actual != expected:
            api.emit(
                "AGUI008",
                {"field": field_name, "actual": actual, "expected": expected},
                {"pointer": f"/{field_name}", "relatedEventIndex": run.start_index},
            )


def end_of_run_steps(run: RunState, emit: EmitFn, at_index: int) -> None:
    """AGUI007 - open steps when the run reaches a clean end."""
    for step_name, open_ in run.open_steps.items():
        emit(
            "AGUI007",
            {"stepName": step_name},
            {"eventIndex": at_index, "relatedEventIndex": open_.first_index},
        )
