"""Mirrors js/test/vitest/matcher.test.ts, adapted from vitest's boolean
matcher (with .not) to the assert-raises idiom described in
docs/PYTHON-PORT-PLAN.md §6.
"""

from __future__ import annotations

import json
import re

import pytest

from ag_ui_validate.pytest_plugin import assert_valid_agui, validate_agui

from .helpers import finished, in_run, started, text_message, tool_call

GOOD = in_run(*text_message())
# TOOL_CALL_START that never terminates -> AGUI203 (error)
BAD = [started(), tool_call("call_7")[0], finished()]


class TestAssertValidAgui:
    def test_passes_on_a_well_formed_stream(self):
        assert_valid_agui(GOOD)  # does not raise

    def test_fails_on_a_violating_stream_naming_the_rule(self):
        with pytest.raises(AssertionError, match="AGUI203"):
            assert_valid_agui(BAD)

    def test_warning_severity_findings_do_not_fail_by_default(self):
        assert_valid_agui(BAD, severity_overrides={"AGUI203": "warning"})  # does not raise

    def test_max_warnings_makes_warnings_fail(self):
        with pytest.raises(AssertionError, match="(?i)warning"):
            assert_valid_agui(BAD, severity_overrides={"AGUI203": "warning"}, max_warnings=0)

    def test_severity_overrides_can_disable_a_rule_entirely(self):
        assert_valid_agui(BAD, severity_overrides={"AGUI203": "off"})  # does not raise

    def test_declared_features_are_forwarded_to_the_validator(self):
        assert_valid_agui(GOOD, features=["shared-state"])  # does not raise

    def test_accepts_a_jsonl_string_eg_a_capture_read_from_disk(self):
        capture = "\n".join(json.dumps(e) for e in GOOD) + "\n"
        assert_valid_agui(capture)  # does not raise
        with pytest.raises(AssertionError, match="AGUI502"):
            assert_valid_agui(f"{capture}{{not json\n")

    def test_raises_typeerror_on_a_received_value_that_is_neither_a_list_nor_a_string(self):
        with pytest.raises(TypeError, match="(?i)array|jsonl"):
            assert_valid_agui(42)  # type: ignore[arg-type]  # deliberate misuse, asserting the runtime guard
        # a single event dict must be wrapped in a list
        with pytest.raises(TypeError, match="(?i)array|jsonl"):
            assert_valid_agui(started())  # type: ignore[arg-type]  # deliberate misuse, asserting the runtime guard


class TestValidateAgui:
    def test_failure_message_carries_the_pretty_formatted_findings_and_spec_links(self):
        with pytest.raises(AssertionError) as exc_info:
            assert_valid_agui(BAD)
        message = str(exc_info.value)
        assert "✖ AGUI203" in message
        assert "docs.ag-ui.com" in message
        assert "\x1b[" not in message  # never ANSI-colored

    def test_report_reflects_a_clean_result_when_valid(self):
        report = validate_agui(GOOD)
        assert report.summary.errors == 0
        assert report.event_count == len(GOOD)

    def test_mentions_the_warning_budget_when_max_warnings_caused_the_failure(self):
        with pytest.raises(AssertionError) as exc_info:
            assert_valid_agui(BAD, severity_overrides={"AGUI203": "warning"}, max_warnings=0)
        message = str(exc_info.value)
        assert re.search(r"1 warning.*max_warnings|max_warnings.*1 warning", message, re.I | re.S)
