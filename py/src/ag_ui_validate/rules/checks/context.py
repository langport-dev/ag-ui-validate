"""Internal validator state and the API each check module sees.
Everything here is engine-internal; the public surface lives in types.py.
Mirrors js/src/rules/checks/context.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional, Set

# Emit a diagnostic for rule `id`; params fill the catalog messageTemplate.
# extra may carry: event_index, pointer, related_event_index,
# severity (instance-level floor, e.g. draft META downgrades AGUI503),
# spec_url (instance-level override, e.g. draft docs page),
# message_suffix (appended to the formatted message, e.g. casing hints).
EmitFn = Callable[..., None]


@dataclass
class OpenToolCall:
    start_index: int
    args: str = ""
    saw_args: bool = False


@dataclass
class Terminal:
    type: str
    index: int


@dataclass
class OpenMessage:
    start_index: int


@dataclass
class OpenStep:
    count: int
    first_index: int


@dataclass
class OpenSubagent:
    start_index: int


@dataclass
class ClosedSubagent:
    index: int
    # True only when closed via SUBAGENT_FINISHED with outcome.type ==
    # "suspended" - the one case where a later SUBAGENT_STARTED reusing this
    # id is a legitimate continuation, not a duplicate (AGUI601).
    resumable: bool = False


@dataclass
class StateInfo:
    # True once a STATE_SNAPSHOT established an observable base (SQ-1).
    known: bool = False
    value: Any = None
    deltas_since_snapshot: int = 0
    snapshot_seen: bool = False
    agui301_fired: bool = False


@dataclass
class TextChunk:
    message_id: str
    start_index: int


@dataclass
class ToolChunk:
    tool_call_id: str
    start_index: int
    args: str
    saw_args: bool


@dataclass
class ReasoningChunk:
    message_id: str
    start_index: int


@dataclass
class RunState:
    # None while the run is implicit (stream opened without RUN_STARTED).
    run_id: Optional[str]
    thread_id: Optional[str]
    start_index: int
    implicit: bool
    terminal: Optional[Terminal] = None

    open_messages: Dict[str, OpenMessage] = field(default_factory=dict)
    # message_id -> index of the event that closed it.
    closed_messages: Dict[str, int] = field(default_factory=dict)
    # Every message id observed (starts, chunks, snapshots, tool results).
    known_message_ids: Set[str] = field(default_factory=set)

    open_tool_calls: Dict[str, OpenToolCall] = field(default_factory=dict)
    closed_tool_calls: Dict[str, int] = field(default_factory=dict)
    # Ids also known from MESSAGES_SNAPSHOT history.
    known_tool_call_ids: Set[str] = field(default_factory=set)

    # step_name -> re-entrant open count (SQ-10) and first-open index.
    open_steps: Dict[str, OpenStep] = field(default_factory=dict)

    open_subagents: Dict[str, OpenSubagent] = field(default_factory=dict)
    closed_subagents: Dict[str, ClosedSubagent] = field(default_factory=dict)
    # Every subagentRunId ever started (open or closed), for parentSubagentRunId checks.
    known_subagent_run_ids: Set[str] = field(default_factory=set)

    open_reasoning_blocks: Dict[str, int] = field(default_factory=dict)
    open_reasoning_messages: Dict[str, int] = field(default_factory=dict)

    state: StateInfo = field(default_factory=StateInfo)

    # Implicit streams opened by *_CHUNK events; closed by any other event.
    text_chunk: Optional[TextChunk] = None
    tool_chunk: Optional[ToolChunk] = None
    reasoning_chunk: Optional[ReasoningChunk] = None


def new_run_state(
    *, run_id: Optional[str], thread_id: Optional[str], start_index: int, implicit: bool
) -> RunState:
    return RunState(run_id=run_id, thread_id=thread_id, start_index=start_index, implicit=implicit)


@dataclass
class StreamState:
    event_count: int = 0
    saw_timestamp: bool = False
    any_snapshot: bool = False
    agui001_fired: bool = False
    features: Set[str] = field(default_factory=set)


@dataclass
class CheckApi:
    """What a per-event check handler receives."""

    index: int
    type: str
    event: Dict[str, Any]
    run: RunState
    stream: StreamState
    emit: EmitFn
    feature: Callable[[str], None]


def str_field(event: Dict[str, Any], field_name: str) -> Optional[str]:
    """Reads a field only if it is a string (schema problems already reported)."""
    v = event.get(field_name)
    return v if isinstance(v, str) else None
