"""Engine-level behavior not tied to one specific rule fixture. Mirrors
js/test/validator/engine.test.ts.
"""

from __future__ import annotations

from typing import Any, Dict

from ag_ui_validate.engine import create_validator
from ag_ui_validate.types import ValidatorOptions

from .helpers import finished, in_run, only, rules_of, started, text_message, tool_call, validate


class TestInputHandlingNeverThrows:
    def test_accepts_raw_json_strings(self):
        v = create_validator()
        diags = v.feed('{"type":"RUN_STARTED","threadId":"t","runId":"r"}')
        assert diags == []

    def test_malformed_json_is_agui502_not_an_exception(self):
        diags, _ = validate(['{"type": oops'])
        hits = only(diags, "AGUI502")
        assert len(hits) == 1
        assert hits[0].severity == "error"

    def test_non_object_payloads_are_agui502(self):
        for garbage in ["42", "null", '"hi"', 42, None, True, ["array"]]:
            diags, _ = validate([garbage])
            assert "AGUI502" in rules_of(diags), repr(garbage)

    def test_survives_hostile_objects(self):
        cyclic: Dict[str, Any] = {"type": "RUN_STARTED", "threadId": "t", "runId": "r"}
        cyclic["self"] = cyclic
        v = create_validator()
        v.feed(cyclic)
        v.feed({"type": {"nested": "object"}})
        v.feed({"type": "STATE_DELTA", "delta": [{"op": "add", "path": None, "value": 1}]})
        v.feed({})
        v.finalize()
        v.report()
        assert v.report().internal_errors == []


class TestAgui503UnknownEventType:
    def test_fires_for_a_type_the_sdk_does_not_define(self):
        diags, _ = validate(in_run({"type": "BANANA"}))
        hits = only(diags, "AGUI503")
        assert len(hits) == 1
        assert "BANANA" in hits[0].message

    def test_suggests_the_canonical_casing_for_near_miss_types(self):
        diags, _ = validate(in_run({"type": "runStarted", "threadId": "t", "runId": "r"}))
        hits = only(diags, "AGUI503")
        assert len(hits) == 1
        assert "RUN_STARTED" in hits[0].message

    def test_does_not_fire_for_raw_or_custom(self):
        diags, _ = validate(
            in_run({"type": "RAW", "event": {"anything": 1}}, {"type": "CUSTOM", "name": "acme.ping", "value": 1})
        )
        assert "AGUI503" not in rules_of(diags)

    def test_documented_draft_types_report_at_info_citing_the_draft_page(self):
        diags, _ = validate(in_run({"type": "META", "metaType": "thumbs_up", "payload": {}}))
        hits = only(diags, "AGUI503")
        assert len(hits) == 1
        assert hits[0].severity == "info"
        assert "drafts/meta-events" in hits[0].spec_url

    def test_deprecated_thinking_events_are_valid_not_unknown(self):
        diags, _ = validate(
            in_run(
                {"type": "THINKING_START"},
                {"type": "THINKING_TEXT_MESSAGE_START"},
                {"type": "THINKING_TEXT_MESSAGE_CONTENT", "delta": "x"},
                {"type": "THINKING_TEXT_MESSAGE_END"},
                {"type": "THINKING_END"},
            )
        )
        assert "AGUI503" not in rules_of(diags)


class TestAgui504SchemaValidation:
    def test_missing_required_field_with_pointer(self):
        diags, _ = validate(in_run({"type": "TOOL_CALL_START", "toolCallId": "c1"}))
        hits = only(diags, "AGUI504")
        assert len(hits) == 1
        assert hits[0].pointer == "/toolCallName"
        assert "toolCallName" in hits[0].message

    def test_wrong_primitive_kind(self):
        diags, _ = validate(in_run({"type": "TEXT_MESSAGE_END", "messageId": 42}))
        hits = only(diags, "AGUI504")
        assert len(hits) == 1
        assert hits[0].pointer == "/messageId"

    def test_enum_violation(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "tool"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1"},
            )
        )
        assert len(only(diags, "AGUI504")) == 1

    def test_extra_fields_are_allowed(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "vendorExtra": 1},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1"},
            )
        )
        assert diags == []

    def test_non_numeric_timestamp_is_flagged_on_the_base_event(self):
        diags, _ = validate(in_run({"type": "TEXT_MESSAGE_END", "messageId": "m1", "timestamp": "now"}))
        assert any(d.pointer == "/timestamp" for d in only(diags, "AGUI504"))


class TestHygieneRules:
    def test_agui901_raw_wrapping_a_typed_agui_event(self):
        diags, _ = validate(in_run({"type": "RAW", "event": {"type": "TOOL_CALL_RESULT", "toolCallId": "c1"}}))
        hits = only(diags, "AGUI901")
        assert len(hits) == 1
        assert hits[0].severity == "info"
        assert "TOOL_CALL_RESULT" in hits[0].message

    def test_agui901_does_not_fire_for_genuinely_foreign_events(self):
        diags, _ = validate(in_run({"type": "RAW", "event": {"kind": "langgraph-internal"}}))
        assert "AGUI901" not in rules_of(diags)

    def test_agui902_stream_with_no_timestamps_at_all(self):
        diags, _ = validate(
            [{"type": "RUN_STARTED", "threadId": "t", "runId": "r"}, {"type": "RUN_FINISHED", "threadId": "t", "runId": "r"}]
        )
        hits = only(diags, "AGUI902")
        assert len(hits) == 1
        assert hits[0].event_index == -1

    def test_agui902_stays_quiet_when_any_event_has_a_timestamp(self):
        diags, _ = validate(in_run())
        assert "AGUI902" not in rules_of(diags)

    def test_agui903_un_namespaced_custom_name(self):
        diags, _ = validate(in_run({"type": "CUSTOM", "name": "ping", "value": None}))
        hits = only(diags, "AGUI903")
        assert len(hits) == 1
        assert hits[0].severity == "info"

    def test_agui903_accepts_namespaced_names(self):
        diags, _ = validate(in_run({"type": "CUSTOM", "name": "acme.ping", "value": None}))
        assert "AGUI903" not in rules_of(diags)


class TestSeverityOverrides:
    def test_off_suppresses_a_rule(self):
        diags, _ = validate(
            in_run({"type": "CUSTOM", "name": "ping", "value": None}),
            ValidatorOptions(severity_overrides={"AGUI903": "off"}),
        )
        assert "AGUI903" not in rules_of(diags)

    def test_overridden_severity_lands_in_the_diagnostic_and_the_summary(self):
        diags, report = validate(
            in_run({"type": "CUSTOM", "name": "ping", "value": None}),
            ValidatorOptions(severity_overrides={"AGUI903": "error"}),
        )
        assert only(diags, "AGUI903")[0].severity == "error"
        assert report.summary.errors == 1
        assert report.summary.info == 0


class TestReport:
    def test_counts_by_severity_and_reports_event_count(self):
        _, report = validate(
            [started(), {"type": "TEXT_MESSAGE_CONTENT", "messageId": "ghost", "delta": ""}, finished()]
        )
        assert report.event_count == 3
        assert report.summary.errors > 0
        assert len(report.diagnostics) > 0

    def test_reports_transport_rules_as_skipped_never_silently(self):
        _, report = validate(in_run())
        skipped_rules = [s.rule for s in report.skipped]
        for rule in ["AGUI501", "AGUI505", "AGUI506", "AGUI507", "AGUI508"]:
            assert rule in skipped_rules
        assert all(len(s.reason) > 0 for s in report.skipped)

    def test_infers_the_feature_matrix_from_observed_events(self):
        _, report = validate(
            in_run(
                *text_message(),
                *tool_call(),
                {"type": "TOOL_CALL_RESULT", "messageId": "tm", "toolCallId": "call_1", "content": "ok"},
                {"type": "STATE_SNAPSHOT", "snapshot": {}},
                {"type": "CUSTOM", "name": "PredictState", "value": []},
            )
        )
        assert report.features["agentic-chat"] == "exercised"
        assert report.features["backend-tool-rendering"] == "exercised"
        assert report.features["shared-state"] == "exercised"
        assert report.features["predictive-state-updates"] == "exercised"
        assert report.features["human-in-the-loop"] == "not-exercised"
        assert report.features["agentic-generative-ui"] == "not-inferable"
        assert report.features["tool-based-generative-ui"] == "not-inferable"

    def test_an_interrupt_outcome_marks_human_in_the_loop_exercised(self):
        _, report = validate([started(), finished(outcome={"type": "interrupt", "interrupts": [{"id": "i1"}]})])
        assert report.features["human-in-the-loop"] == "exercised"


class TestFinalize:
    def test_is_idempotent(self):
        v = create_validator()
        v.feed(started())
        first = v.finalize()
        assert len(first) > 0
        assert v.finalize() == []


def _started_sub(**over: Any) -> Dict[str, Any]:
    return {"type": "SUBAGENT_STARTED", "subagentRunId": "sub_1", "name": "researcher", **over}


def _finished_sub(**over: Any) -> Dict[str, Any]:
    return {"type": "SUBAGENT_FINISHED", "subagentRunId": "sub_1", **over}


class TestSubagentLifecycle:
    """AGUI601-AGUI605 edge cases: suspension/resumption and nesting, not
    otherwise covered by the shared fixture corpus. Mirrors
    js/test/validator/subagents.test.ts.
    """

    def test_clean_started_finished_pair_is_silent(self):
        diags, _ = validate(in_run(_started_sub(), _finished_sub()))
        assert diags == []

    def test_clean_started_errored_pair_is_silent(self):
        diags, _ = validate(in_run(_started_sub(), {"type": "SUBAGENT_ERROR", "subagentRunId": "sub_1", "message": "boom"}))
        assert diags == []

    def test_tracks_concurrent_subagents_independently(self):
        diags, _ = validate(
            in_run(
                _started_sub(subagentRunId="sub_1"),
                _started_sub(subagentRunId="sub_2"),
                _finished_sub(subagentRunId="sub_1"),
                _finished_sub(subagentRunId="sub_2"),
            )
        )
        assert diags == []

    def test_agui601_fires_when_reopening_an_open_id(self):
        diags, _ = validate(in_run(_started_sub(), _started_sub(), _finished_sub()))
        assert len(only(diags, "AGUI601")) == 1

    def test_agui601_fires_when_reusing_an_id_after_a_plain_success_close(self):
        diags, _ = validate(in_run(_started_sub(), _finished_sub(), _started_sub(), _finished_sub()))
        assert len(only(diags, "AGUI601")) == 1

    def test_agui601_fires_when_reusing_an_id_after_subagent_error(self):
        diags, _ = validate(
            in_run(_started_sub(), {"type": "SUBAGENT_ERROR", "subagentRunId": "sub_1", "message": "boom"}, _started_sub())
        )
        assert len(only(diags, "AGUI601")) == 1

    def test_agui601_does_not_fire_when_a_suspended_subagent_id_is_resumed(self):
        diags, _ = validate(
            in_run(
                _started_sub(),
                _finished_sub(outcome={"type": "suspended", "interruptIds": ["int_1"]}),
                _started_sub(),
                _finished_sub(),
            )
        )
        assert "AGUI601" not in rules_of(diags)

    def test_agui601_still_detects_a_genuine_duplicate_after_a_resumed_subagent_closes(self):
        diags, _ = validate(
            in_run(
                _started_sub(),
                _finished_sub(outcome={"type": "suspended"}),
                _started_sub(),
                _finished_sub(),
                _started_sub(),
            )
        )
        assert len(only(diags, "AGUI601")) == 1

    def test_agui602_fires_for_finished_with_no_open_start(self):
        diags, _ = validate(in_run(_finished_sub()))
        assert len(only(diags, "AGUI602")) == 1

    def test_agui603_fires_for_error_with_no_open_start(self):
        diags, _ = validate(in_run({"type": "SUBAGENT_ERROR", "subagentRunId": "sub_1", "message": "boom"}))
        assert len(only(diags, "AGUI603")) == 1

    def test_agui602_fires_for_a_second_finished_on_an_already_closed_subagent(self):
        diags, _ = validate(in_run(_started_sub(), _finished_sub(), _finished_sub()))
        assert len(only(diags, "AGUI602")) == 1

    def test_agui604_fires_at_the_terminal_event_and_points_back_to_the_start(self):
        diags, _ = validate(in_run(_started_sub()))
        hits = only(diags, "AGUI604")
        assert len(hits) == 1
        assert hits[0].related_event_index == 1

    def test_agui604_does_not_fire_after_run_error(self):
        diags, _ = validate([{"type": "RUN_STARTED", "threadId": "t", "runId": "r"}, _started_sub(), {"type": "RUN_ERROR", "message": "boom"}])
        assert "AGUI604" not in rules_of(diags)

    def test_agui604_does_not_fire_for_a_suspended_subagent(self):
        diags, _ = validate(in_run(_started_sub(), _finished_sub(outcome={"type": "suspended"})))
        assert "AGUI604" not in rules_of(diags)

    def test_agui605_fires_when_the_parent_id_was_never_observed(self):
        diags, _ = validate(in_run(_started_sub(parentSubagentRunId="ghost"), _finished_sub()))
        assert len(only(diags, "AGUI605")) == 1

    def test_agui605_does_not_fire_when_the_parent_was_started_earlier_even_if_already_finished(self):
        diags, _ = validate(
            in_run(
                _started_sub(subagentRunId="parent"),
                _finished_sub(subagentRunId="parent"),
                _started_sub(subagentRunId="child", parentSubagentRunId="parent"),
                _finished_sub(subagentRunId="child"),
            )
        )
        assert "AGUI605" not in rules_of(diags)

    def test_agui605_does_not_fire_when_the_parent_is_still_open(self):
        diags, _ = validate(
            in_run(
                _started_sub(subagentRunId="parent"),
                _started_sub(subagentRunId="child", parentSubagentRunId="parent"),
                _finished_sub(subagentRunId="child"),
                _finished_sub(subagentRunId="parent"),
            )
        )
        assert "AGUI605" not in rules_of(diags)


class TestSubagentOwnershipConsistency:
    """AGUI606: a continuation/close event's subagentRunId must agree with
    its entity's owner. Fixture coverage (spec/fixtures/invalid/AGUI606-*)
    exercises the text-message case; these cover the toolcall/step variants
    and the documented exceptions (TOOL_CALL_RESULT, omitted tags,
    parentMessageId inheritance). Mirrors
    js/test/validator/subagent-ownership.test.ts.
    """

    def test_does_not_fire_when_the_continuation_omits_subagent_run_id(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "subagentRunId": "sub_1"},
                {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1"},
            )
        )
        assert "AGUI606" not in rules_of(diags)

    def test_does_not_fire_when_the_continuation_repeats_the_same_tag(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "subagentRunId": "sub_1"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1", "subagentRunId": "sub_1"},
            )
        )
        assert "AGUI606" not in rules_of(diags)

    def test_fires_when_a_message_opened_under_the_run_is_continued_under_a_subagent(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant"},
                {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "hi", "subagentRunId": "sub_1"},
            )
        )
        hits = only(diags, "AGUI606")
        assert len(hits) == 1
        assert "the run" in hits[0].message

    def test_fires_when_tool_call_end_disagrees_with_start(self):
        diags, _ = validate(
            in_run(
                {"type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "t", "subagentRunId": "sub_1"},
                {"type": "TOOL_CALL_END", "toolCallId": "c1", "subagentRunId": "sub_2"},
            )
        )
        assert len(only(diags, "AGUI606")) == 1

    def test_untagged_tool_call_inherits_parent_messages_owner(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "subagentRunId": "sub_1"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1", "subagentRunId": "sub_1"},
                {"type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "t", "parentMessageId": "m1"},
                {"type": "TOOL_CALL_END", "toolCallId": "c1", "subagentRunId": "sub_1"},
            )
        )
        assert "AGUI606" not in rules_of(diags)

    def test_flags_a_tool_call_continuation_that_contradicts_the_inherited_owner(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "subagentRunId": "sub_1"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1", "subagentRunId": "sub_1"},
                {"type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "t", "parentMessageId": "m1"},
                {"type": "TOOL_CALL_END", "toolCallId": "c1", "subagentRunId": "sub_2"},
            )
        )
        assert len(only(diags, "AGUI606")) == 1

    def test_explicit_owner_on_tool_call_start_overrides_inheritance(self):
        diags, _ = validate(
            in_run(
                {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "subagentRunId": "sub_1"},
                {"type": "TEXT_MESSAGE_END", "messageId": "m1", "subagentRunId": "sub_1"},
                {
                    "type": "TOOL_CALL_START",
                    "toolCallId": "c1",
                    "toolCallName": "t",
                    "parentMessageId": "m1",
                    "subagentRunId": "sub_2",
                },
                {"type": "TOOL_CALL_END", "toolCallId": "c1", "subagentRunId": "sub_2"},
            )
        )
        assert "AGUI606" not in rules_of(diags)

    def test_tool_call_result_is_exempt(self):
        diags, _ = validate(
            in_run(
                {"type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "t", "subagentRunId": "sub_1"},
                {"type": "TOOL_CALL_RESULT", "messageId": "tm1", "toolCallId": "c1", "content": "ok", "subagentRunId": "sub_2"},
                {"type": "TOOL_CALL_END", "toolCallId": "c1", "subagentRunId": "sub_1"},
            )
        )
        assert "AGUI606" not in rules_of(diags)

    def test_fires_when_step_finished_disagrees_with_the_owner_step_started_recorded(self):
        diags, _ = validate(
            in_run(
                {"type": "STEP_STARTED", "stepName": "plan", "subagentRunId": "sub_1"},
                {"type": "STEP_FINISHED", "stepName": "plan", "subagentRunId": "sub_2"},
            )
        )
        assert len(only(diags, "AGUI606")) == 1

    def test_a_reentrant_step_started_does_not_change_the_recorded_owner(self):
        diags, _ = validate(
            in_run(
                {"type": "STEP_STARTED", "stepName": "plan", "subagentRunId": "sub_1"},
                {"type": "STEP_STARTED", "stepName": "plan", "subagentRunId": "sub_2"},
                {"type": "STEP_FINISHED", "stepName": "plan", "subagentRunId": "sub_2"},
                {"type": "STEP_FINISHED", "stepName": "plan", "subagentRunId": "sub_1"},
            )
        )
        assert len(only(diags, "AGUI606")) == 1


class TestMultiRunStreams:
    def test_validates_each_run_independently_and_accepts_parent_run_id_branching(self):
        diags, _ = validate(
            [
                started(runId="r1"),
                finished(runId="r1"),
                started(runId="r2", parentRunId="r1"),
                {"type": "TOOL_CALL_START", "toolCallId": "c1", "toolCallName": "t"},
                finished(runId="r2"),
            ]
        )
        assert rules_of(diags) == ["AGUI203"]
