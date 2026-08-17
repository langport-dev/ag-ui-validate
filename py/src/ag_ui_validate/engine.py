"""ag_ui_validate core: a pure function over an AG-UI event sequence. Zero
I/O, zero runtime dependencies. Transports, the CLI, and the pytest plugin
are thin wrappers over this module.

Two invariants hold everywhere here:
  - the validator NEVER raises on input: broken input is its input;
  - every diagnostic cites the spec section that governs it (spec_url).

Mirrors js/src/index.ts. The closure-returning-object-literal `createValidator()`
becomes a `Validator` class with instance state instead of captured closure
variables — the one structural (not behavioral) change from the TS source.
"""

from __future__ import annotations

import json
import re
import traceback
from typing import Any, Dict, List, Optional

from .protocol.event_table import DRAFT_EVENT_TYPES, EVENT_TABLE, EVENT_TYPES, SDK_VERSION
from .rules.catalog import RULES, format_message
from .rules.checks.context import CheckApi, RunState, StreamState, Terminal, new_run_state, str_field
from .rules.checks.lifecycle import check_run_id_stability, end_of_run_steps, handle_step_event
from .rules.checks.reasoning import close_reasoning_chunk, end_of_run_reasoning, handle_reasoning_event
from .rules.checks.state import handle_state_event
from .rules.checks.text import close_text_chunk, end_of_run_text, handle_text_event
from .rules.checks.toolcalls import close_tool_chunk, end_of_run_tool_calls, handle_tool_call_event
from .rules.checks.transport import TRANSPORT_RULE_IDS, TRANSPORT_SKIP_REASON
from .types import CANONICAL_FEATURES, Diagnostic, Report, SkippedRule, Summary, ValidatorOptions

_DRAFTS_META_URL = "https://docs.ag-ui.com/drafts/meta-events"

# Features whose exercise cannot be distinguished on a passive stream: both
# generative-UI features need knowledge of the frontend's tool/component
# registry, which is out-of-band (see SQ-13).
_NOT_INFERABLE = {"agentic-generative-ui", "tool-based-generative-ui"}

# "runStarted" -> "RUN_STARTED": case-insensitive match against wire types.
_CANONICAL_BY_SQUASHED: Dict[str, str] = {t.replace("_", "").lower(): t for t in EVENT_TYPES}

_SQUASH_RE = re.compile(r"[_\-\s]")
_NAMESPACE_RE = re.compile(r"[.:/]")


def _describe_value(v: Any) -> str:
    if v is None:
        return "null"
    if isinstance(v, list):
        return "array"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def _validate_schema(type_: str, spec: Dict[str, Any], ev: Dict[str, Any], emit) -> None:
    for field_name, fs in spec["fields"].items():
        if field_name not in ev:
            if fs.get("required"):
                emit(
                    "AGUI504",
                    {"type": type_, "detail": f"missing required field '{field_name}' ({fs['kind']})"},
                    {"pointer": f"/{field_name}"},
                )
            continue
        v = ev[field_name]
        kind = fs["kind"]
        if kind == "string":
            kind_ok = isinstance(v, str)
        elif kind == "number":
            kind_ok = isinstance(v, (int, float)) and not isinstance(v, bool)
        elif kind == "boolean":
            kind_ok = isinstance(v, bool)
        elif kind == "array":
            kind_ok = isinstance(v, list)
        elif kind == "object":
            kind_ok = isinstance(v, dict)
        else:  # "any"
            kind_ok = True
        if not kind_ok:
            article = "an" if kind == "array" else "a"
            emit(
                "AGUI504",
                {
                    "type": type_,
                    "detail": f"field '{field_name}' must be {article} {kind}, got {_describe_value(v)}",
                },
                {"pointer": f"/{field_name}"},
            )
            continue
        enum = fs.get("enum")
        if enum is not None and isinstance(v, str) and v not in enum:
            emit(
                "AGUI504",
                {"type": type_, "detail": f"field '{field_name}' must be one of {'|'.join(enum)}, got '{v}'"},
                {"pointer": f"/{field_name}"},
            )


class Validator:
    def __init__(self, options: Optional[ValidatorOptions] = None):
        options = options or ValidatorOptions()
        self._overrides: Dict[str, str] = dict(options.severity_overrides or {})
        self._declared_features = set(options.features or [])
        self._layers = {"core", *(options.layers or [])}

        self._diagnostics: List[Diagnostic] = []
        self._internal_errors: List[str] = []
        self._explicit_skips: Dict[str, str] = {}
        self._stream = StreamState()
        self._run: Optional[RunState] = None
        self._finalized = False

    def _make_emit(self, batch: List[Diagnostic], current: Optional[Dict[str, Any]]):
        def emit(rule_id: str, params: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> None:
            extra = extra or {}
            rule = RULES.get(rule_id)
            if rule is None:
                self._internal_errors.append(f"emit() for unknown rule {rule_id}")
                return
            override = self._overrides.get(rule_id)
            if override == "off":
                return
            severity = override
            if severity is None:
                severity = extra.get("severity")
            if severity is None:
                severity = rule.severity
            event_index_provided = "eventIndex" in extra
            about_current_event = not event_index_provided and current is not None
            event_index = extra["eventIndex"] if event_index_provided else (current["index"] if current is not None else -1)
            spec_url = extra.get("specUrl")
            if spec_url is None:
                spec_url = rule.spec_url
            diag = Diagnostic(
                rule=rule_id,
                severity=severity,
                message=format_message(rule, params) + extra.get("messageSuffix", ""),
                event_index=event_index,
                spec_url=spec_url,
            )
            if about_current_event:
                diag.event_type = current["type"]
            if "pointer" in extra:
                diag.pointer = extra["pointer"]
            if "relatedEventIndex" in extra:
                diag.related_event_index = extra["relatedEventIndex"]
            self._diagnostics.append(diag)
            batch.append(diag)

        return emit

    def _close_chunks(self, r: RunState, emit, at_index: int, except_: Optional[str] = None) -> None:
        """Chunk streams close implicitly on any event of a different type."""
        if except_ != "TEXT_MESSAGE_CHUNK":
            close_text_chunk(r, at_index)
        if except_ != "TOOL_CALL_CHUNK":
            close_tool_chunk(r, emit, at_index)
        if except_ != "REASONING_MESSAGE_CHUNK":
            close_reasoning_chunk(r)

    def _end_of_run_checks(self, r: RunState, emit, at_index: int) -> None:
        """Unterminated-at-run-end rules. Only on a *clean* end (RUN_FINISHED
        or a stream that just stops): after RUN_ERROR, open streams are
        expected debris of the failure, and flagging them would manufacture
        noise."""
        end_of_run_text(r, emit, at_index)
        end_of_run_tool_calls(r, emit, at_index)
        end_of_run_steps(r, emit, at_index)
        end_of_run_reasoning(r, emit, at_index)

    def _ensure_run(self, index: int, type_: str, emit) -> RunState:
        """Opens the implicit run scope for streams that never announced one."""
        if self._run is None:
            if not self._stream.agui001_fired:
                emit("AGUI001", {"type": type_}, {})
                self._stream.agui001_fired = True
            self._run = new_run_state(run_id=None, thread_id=None, start_index=index, implicit=True)
        return self._run

    def _api(self, index: int, type_: str, event: Dict[str, Any], r: RunState, emit) -> CheckApi:
        return CheckApi(
            index=index,
            type=type_,
            event=event,
            run=r,
            stream=self._stream,
            emit=emit,
            feature=lambda f: self._stream.features.add(f),
        )

    def _process_event(self, input_: Any, batch: List[Diagnostic]) -> None:
        index = self._stream.event_count
        self._stream.event_count += 1

        # 1. Parse. Malformed input is a diagnostic, never an exception.
        parsed = input_
        if isinstance(input_, str):
            try:
                parsed = json.loads(input_)
            except ValueError as e:
                self._make_emit(batch, {"index": index, "type": ""})("AGUI502", {"error": str(e)})
                return
        if not isinstance(parsed, dict):
            self._make_emit(batch, {"index": index, "type": ""})(
                "AGUI502", {"error": f"payload is {_describe_value(parsed)}, expected a JSON object"}
            )
            return
        ev = parsed

        # 2. The declared type is the key to everything else.
        ev_type = ev.get("type")
        if not isinstance(ev_type, str):
            self._make_emit(batch, {"index": index, "type": ""})(
                "AGUI504",
                {"type": "(untyped)", "detail": "event has no string 'type' property"},
                {"pointer": "/type"},
            )
            return
        type_ = ev_type
        emit = self._make_emit(batch, {"index": index, "type": type_})

        # 3. Base-event fields.
        if "timestamp" in ev and ev["timestamp"] is not None:
            ts = ev["timestamp"]
            if isinstance(ts, (int, float)) and not isinstance(ts, bool):
                self._stream.saw_timestamp = True
            else:
                emit(
                    "AGUI504",
                    {"type": type_, "detail": f"field 'timestamp' must be a number, got {_describe_value(ts)}"},
                    {"pointer": "/timestamp"},
                )

        # 4. Unknown types: AGUI503 (documented drafts at info; casing hints
        #    for near-misses - SQ-7).
        spec = EVENT_TABLE.get(type_)
        if spec is None:
            if type_ in DRAFT_EVENT_TYPES:
                emit(
                    "AGUI503",
                    {"type": type_, "sdkVersion": SDK_VERSION},
                    {
                        "severity": "info",
                        "specUrl": _DRAFTS_META_URL,
                        "messageSuffix": " — documented draft event type, not yet in @ag-ui/core",
                    },
                )
            else:
                squashed = _SQUASH_RE.sub("", type_).lower()
                canonical = _CANONICAL_BY_SQUASHED.get(squashed)
                extra = {}
                if canonical is not None:
                    extra["messageSuffix"] = (
                        f" — did you mean '{canonical}'? AG-UI wire types use SCREAMING_SNAKE_CASE"
                    )
                emit("AGUI503", {"type": type_, "sdkVersion": SDK_VERSION}, extra)
            return

        # 5. Schema validation for the declared type (AGUI504).
        _validate_schema(type_, spec, ev, emit)

        # 6. Lifecycle position.
        if type_ == "RUN_STARTED":
            if self._run is None:
                self._run = new_run_state(
                    run_id=str_field(ev, "runId"), thread_id=str_field(ev, "threadId"), start_index=index, implicit=False
                )
            elif self._run.terminal is not None:
                # A new run after a clean terminal: multi-run streams are
                # legal (serialized logs branch via parentRunId - SQ-6).
                # Fresh scope.
                self._run = new_run_state(
                    run_id=str_field(ev, "runId"), thread_id=str_field(ev, "threadId"), start_index=index, implicit=False
                )
            elif self._run.implicit:
                # The stream opened without RUN_STARTED (AGUI001 already
                # fired); the late start legitimizes the implicit scope
                # rather than double-firing.
                self._close_chunks(self._run, emit, index)
                self._run.implicit = False
                self._run.run_id = str_field(ev, "runId")
                self._run.thread_id = str_field(ev, "threadId")
            else:
                self._close_chunks(self._run, emit, index)
                emit(
                    "AGUI002",
                    {"runId": str_field(ev, "runId") or "(missing)"},
                    {"relatedEventIndex": self._run.start_index},
                )
            return

        r = self._ensure_run(index, type_, emit)

        # 7. Nothing may follow a terminal event (AGUI004/AGUI005).
        if r.terminal is not None:
            terminal_type = r.terminal.type
            if type_ in ("RUN_FINISHED", "RUN_ERROR") and type_ != terminal_type:
                emit("AGUI005", {"type": type_, "terminalType": terminal_type}, {"relatedEventIndex": r.terminal.index})
            else:
                emit("AGUI004", {"type": type_, "terminalType": terminal_type}, {"relatedEventIndex": r.terminal.index})
            return

        self._close_chunks(r, emit, index, type_)

        # 8. Terminal events.
        if type_ in ("RUN_FINISHED", "RUN_ERROR"):
            if type_ == "RUN_FINISHED":
                check_run_id_stability(self._api(index, type_, ev, r, emit))
                self._end_of_run_checks(r, emit, index)
                outcome = ev.get("outcome")
                if isinstance(outcome, dict) and outcome.get("type") == "interrupt":
                    self._stream.features.add("human-in-the-loop")
            r.terminal = Terminal(type=type_, index=index)
            return

        # 9. Per-category checks.
        a = self._api(index, type_, ev, r, emit)
        category = spec["category"]
        if category == "lifecycle":
            handle_step_event(a)  # STEP_STARTED / STEP_FINISHED
        elif category == "text":
            handle_text_event(a)
        elif category == "toolcall":
            handle_tool_call_event(a)
        elif category == "state":
            handle_state_event(a)
        elif category == "reasoning":
            handle_reasoning_event(a)
        elif category == "thinking":
            # Deprecated but valid (SQ-8): schema-checked above, no ordering
            # rules in the catalog yet - a "deprecated event used" rule is
            # proposed upstream rather than invented here.
            pass
        elif category == "activity":
            pass  # No activity rules in the catalog yet.
        elif category == "special":
            if type_ == "RAW":
                wrapped = ev.get("event")
                if isinstance(wrapped, dict):
                    wrapped_type = wrapped.get("type")
                    if isinstance(wrapped_type, str) and wrapped_type in EVENT_TABLE:
                        emit("AGUI901", {"wrappedType": wrapped_type}, {"pointer": "/event/type"})
            elif type_ == "CUSTOM":
                name = str_field(ev, "name")
                if name is not None:
                    if name == "PredictState":
                        self._stream.features.add("predictive-state-updates")
                    if not _NAMESPACE_RE.search(name):
                        emit("AGUI903", {"name": name}, {"pointer": "/name"})

    def feed(self, event: Any) -> List[Diagnostic]:
        """Feed one event - a parsed dict, or a raw JSON string (malformed
        JSON is a diagnostic, not an exception). Returns diagnostics
        detectable at this event, in stream order. Never raises."""
        batch: List[Diagnostic] = []
        try:
            self._process_event(event, batch)
        except Exception:
            self._internal_errors.append(f"feed(event {self._stream.event_count - 1}): {traceback.format_exc()}")
        return batch

    def finalize(self) -> List[Diagnostic]:
        """End-of-stream checks (unterminated tool calls, missing
        RUN_FINISHED, ...). Idempotent: second and later calls return [].
        Never raises."""
        if self._finalized:
            return []
        self._finalized = True
        batch: List[Diagnostic] = []
        emit = self._make_emit(batch, None)
        try:
            if self._run is not None and self._run.terminal is None:
                self._close_chunks(self._run, emit, -1)
                emit(
                    "AGUI003",
                    {"runId": self._run.run_id or "(unknown)"},
                    {"eventIndex": -1, "relatedEventIndex": self._run.start_index},
                )
                self._end_of_run_checks(self._run, emit, -1)
            if self._stream.event_count > 0 and not self._stream.saw_timestamp:
                emit("AGUI902", {"eventCount": self._stream.event_count}, {"eventIndex": -1})
            if "shared-state" in self._declared_features and not self._stream.any_snapshot:
                emit("AGUI305", {}, {"eventIndex": -1})
        except Exception:
            self._internal_errors.append(f"finalize(): {traceback.format_exc()}")
        return batch

    def emit_external(
        self, rule: str, params: Optional[Dict[str, Any]] = None, extra: Optional[Dict[str, Any]] = None
    ) -> Optional[Diagnostic]:
        """For wrapping layers (transport, CLI): report a layer-checked rule
        through the same catalog formatting, severity overrides, and summary
        as core diagnostics. Returns the diagnostic, or None when the rule is
        unknown (recorded in internal_errors) or overridden off. Never
        raises."""
        batch: List[Diagnostic] = []
        try:
            self._make_emit(batch, None)(rule, params or {}, extra or {})
        except Exception as e:
            self._internal_errors.append(f"emitExternal({rule}): {e}")
        return batch[0] if batch else None

    def mark_skipped(self, rule: str, reason: str) -> None:
        """For wrapping layers: declare that a rule was NOT evaluated and why
        (e.g. timing rules on recorded input). The entry appears in
        report().skipped, replacing any layer-computed entry for the same
        rule. Never raises."""
        self._explicit_skips[str(rule)] = str(reason)

    def report(self) -> Report:
        """Cumulative report over everything fed so far. Never raises."""
        summary = Summary()
        for d in self._diagnostics:
            if d.severity == "error":
                summary.errors += 1
            elif d.severity == "warning":
                summary.warnings += 1
            else:
                summary.info += 1

        features: Dict[str, str] = {}
        for f in CANONICAL_FEATURES:
            if f in _NOT_INFERABLE:
                features[f] = "not-inferable"
            elif f in self._stream.features:
                features[f] = "exercised"
            else:
                features[f] = "not-exercised"

        skipped: List[SkippedRule] = (
            []
            if "transport" in self._layers
            else [
                SkippedRule(rule=rid, reason=TRANSPORT_SKIP_REASON)
                for rid in TRANSPORT_RULE_IDS
                if self._overrides.get(rid) != "off"
            ]
        )
        if "shared-state" not in self._declared_features and self._overrides.get("AGUI305") != "off":
            skipped.append(
                SkippedRule(
                    rule="AGUI305",
                    reason="only evaluated when the 'shared-state' feature is declared via options.features",
                )
            )
        for rule_id, severity in self._overrides.items():
            if severity == "off" and rule_id in RULES:
                skipped.append(SkippedRule(rule=rule_id, reason="disabled by severityOverrides"))
        if self._explicit_skips:
            skipped = [s for s in skipped if s.rule not in self._explicit_skips]
            for rule_id, reason in self._explicit_skips.items():
                skipped.append(SkippedRule(rule=rule_id, reason=reason))

        return Report(
            diagnostics=list(self._diagnostics),
            summary=summary,
            features=features,
            skipped=skipped,
            event_count=self._stream.event_count,
            internal_errors=list(self._internal_errors),
        )


def create_validator(options: Optional[ValidatorOptions] = None) -> Validator:
    return Validator(options)
