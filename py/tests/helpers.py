"""Test helpers mirroring js/test/helpers.ts."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ag_ui_validate.engine import create_validator
from ag_ui_validate.types import Diagnostic, Report, ValidatorOptions

# All helper events carry a timestamp so well-formed fixtures don't trip
# AGUI902 (stream carries no timestamps at all).
TS = 1755300000000


def validate(events: List[Any], opts: Optional[ValidatorOptions] = None):
    """Feeds all events, finalizes, and returns everything."""
    v = create_validator(opts)
    diags: List[Diagnostic] = []
    for e in events:
        diags.extend(v.feed(e))
    diags.extend(v.finalize())
    return diags, v.report()


def rules_of(diags: List[Diagnostic]) -> List[str]:
    return [d.rule for d in diags]


def only(diags: List[Diagnostic], rule: str) -> List[Diagnostic]:
    return [d for d in diags if d.rule == rule]


def started(**over: Any) -> Dict[str, Any]:
    return {"type": "RUN_STARTED", "threadId": "thread_1", "runId": "run_1", "timestamp": TS, **over}


def finished(**over: Any) -> Dict[str, Any]:
    return {"type": "RUN_FINISHED", "threadId": "thread_1", "runId": "run_1", "timestamp": TS, **over}


def in_run(*events: Any) -> List[Any]:
    """Wraps events in a well-formed run envelope."""
    return [started(), *events, finished()]


def text_message(id_: str = "msg_1", delta: str = "hello") -> List[Dict[str, Any]]:
    return [
        {"type": "TEXT_MESSAGE_START", "messageId": id_, "role": "assistant", "timestamp": TS},
        {"type": "TEXT_MESSAGE_CONTENT", "messageId": id_, "delta": delta, "timestamp": TS},
        {"type": "TEXT_MESSAGE_END", "messageId": id_, "timestamp": TS},
    ]


def tool_call(id_: str = "call_1", name: str = "get_weather", args: str = '{"city":"Berlin"}') -> List[Dict[str, Any]]:
    return [
        {"type": "TOOL_CALL_START", "toolCallId": id_, "toolCallName": name, "timestamp": TS},
        {"type": "TOOL_CALL_ARGS", "toolCallId": id_, "delta": args, "timestamp": TS},
        {"type": "TOOL_CALL_END", "toolCallId": id_, "timestamp": TS},
    ]
