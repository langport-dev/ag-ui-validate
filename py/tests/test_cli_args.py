"""Mirrors js/test/cli/args.test.ts."""

from __future__ import annotations

import pytest

from ag_ui_validate.cli_args import USAGE, CliConfig, decide_exit_code, parse_cli_args
from ag_ui_validate.types import Summary


def _ok(argv) -> CliConfig:
    r = parse_cli_args(argv)
    if not r.ok:
        raise AssertionError(f"expected ok, got: {r.error}")
    return r.config


def _err(argv) -> str:
    r = parse_cli_args(argv)
    if r.ok:
        raise AssertionError("expected an error")
    return r.error


class TestParseCliArgs:
    def test_parses_a_url_target_with_defaults(self):
        c = _ok(["http://localhost:8000/agui"])
        assert c.target == "http://localhost:8000/agui"
        assert c.format == "pretty"
        assert c.severity_overrides == {}
        assert c.headers == {}

    def test_parses_stdin_and_file_targets(self):
        assert _ok(["-"]).target == "-"
        assert _ok(["run.jsonl"]).target == "run.jsonl"

    def test_requires_a_target_unless_help_version(self):
        assert "target" in _err([]).lower()
        assert _ok(["--help"]).help is True
        assert _ok(["--version"]).version is True

    def test_rejects_a_second_target(self):
        assert "one target" in _err(["a.jsonl", "b.jsonl"]).lower()

    def test_machine_formats_are_mutually_exclusive(self):
        assert _ok(["-", "--json"]).format == "json"
        assert _ok(["-", "--sarif"]).format == "sarif"
        assert _ok(["-", "--junit"]).format == "junit"
        assert "one of" in _err(["-", "--json", "--sarif"]).lower()

    def test_off_disables_rules_repeatably(self):
        c = _ok(["-", "--off", "AGUI901", "--off", "AGUI902"])
        assert c.severity_overrides == {"AGUI901": "off", "AGUI902": "off"}

    def test_rule_overrides_severity_with_id_equals_severity(self):
        c = _ok(["-", "--rule", "AGUI105=error", "--rule=AGUI903=warning"])
        assert c.severity_overrides == {"AGUI105": "error", "AGUI903": "warning"}

    def test_rejects_malformed_rule_and_off_values(self):
        assert "id=severity" in _err(["-", "--rule", "AGUI105"]).lower()
        assert "severity" in _err(["-", "--rule", "AGUI105=fatal"]).lower()
        assert "agui" in _err(["-", "--off", "banana"]).lower()

    def test_max_warnings_takes_a_non_negative_integer(self):
        assert _ok(["-", "--max-warnings", "0"]).max_warnings == 0
        assert _ok(["-", "--max-warnings=3"]).max_warnings == 3
        assert "integer" in _err(["-", "--max-warnings", "lots"]).lower()

    def test_timeout_is_seconds_stored_as_ms(self):
        assert _ok(["-", "--timeout", "30"]).timeout_ms == 30000
        assert "positive" in _err(["-", "--timeout", "0"]).lower()

    def test_header_parses_and_repeats(self):
        c = _ok(["-", "--header", "Authorization: Bearer x", "--header", "X-Trace:1"])
        assert c.headers == {"authorization": "Bearer x", "x-trace": "1"}
        assert "name: value" in _err(["-", "--header", "no-colon-here"]).lower()

    def test_features_splits_on_commas(self):
        assert _ok(["-", "--features", "shared-state,human-in-the-loop"]).features == [
            "shared-state",
            "human-in-the-loop",
        ]

    def test_no_color_forces_color_off(self):
        assert _ok(["-", "--no-color"]).color is False
        assert _ok(["-"]).color is None  # auto

    def test_group_is_a_pretty_output_flag(self):
        assert _ok(["-", "--group"]).group is True
        assert _ok(["-"]).group is False
        assert "pretty" in _err(["-", "--group", "--json"]).lower()
        assert "pretty" in _err(["-", "--json", "--group"]).lower()  # order-independent
        # file outputs are unaffected: full reports still go to the files
        assert _ok(["-", "--group", "--sarif-file", "o.sarif"]).group is True

    def test_file_output_flags_store_paths_and_combine_with_any_stdout_format(self):
        c = _ok(["-", "--sarif-file", "out.sarif", "--junit-file=out.xml", "--json-file", "r.json"])
        assert c.sarif_file == "out.sarif"
        assert c.junit_file == "out.xml"
        assert c.json_file == "r.json"
        assert c.format == "pretty"  # stdout format untouched
        assert _ok(["-", "--json", "--sarif-file", "o.sarif"]).format == "json"
        assert "value" in _err(["-", "--sarif-file"]).lower()

    def test_rejects_unknown_flags_with_usage_help(self):
        assert "unknown" in _err(["-", "--frobnicate"]).lower()

    def test_flags_needing_values_reject_a_missing_value(self):
        assert "value" in _err(["-", "--rule"]).lower()

    def test_fail_on_takes_error_warning_or_none(self):
        assert _ok(["-", "--fail-on", "error"]).fail_on == "error"
        assert _ok(["-", "--fail-on", "warning"]).fail_on == "warning"
        assert _ok(["-", "--fail-on", "none"]).fail_on == "none"
        assert _ok(["-"]).fail_on is None  # unset means "error", the historical default
        assert "error, warning, or none" in _err(["-", "--fail-on", "info"]).lower()

    def test_usage_mentions_every_flag(self):
        for flag in [
            "--json", "--sarif", "--junit", "--max-warnings", "--rule", "--off",
            "--features", "--timeout", "--header", "--no-color", "--group",
            "--sarif-file", "--junit-file", "--json-file", "--fail-on",
        ]:
            assert flag in USAGE


class TestDecideExitCode:
    def test_0_on_a_clean_report(self):
        assert decide_exit_code(Summary(errors=0, warnings=2, info=5)) == 0

    def test_1_when_errors_exist(self):
        assert decide_exit_code(Summary(errors=1, warnings=0, info=0)) == 1

    def test_1_when_warnings_exceed_max_warnings(self):
        assert decide_exit_code(Summary(errors=0, warnings=3, info=0), 2) == 1
        assert decide_exit_code(Summary(errors=0, warnings=2, info=0), 2) == 0

    def test_fail_on_defaults_to_error_unchanged_from_today(self):
        assert decide_exit_code(Summary(errors=1, warnings=0, info=0)) == 1
        assert decide_exit_code(Summary(errors=0, warnings=3, info=0), 2) == 1

    def test_fail_on_warning_also_fails_on_any_warning_independent_of_max_warnings(self):
        assert decide_exit_code(Summary(errors=0, warnings=1, info=0), None, "warning") == 1
        assert decide_exit_code(Summary(errors=0, warnings=0, info=5), None, "warning") == 0
        assert decide_exit_code(Summary(errors=1, warnings=0, info=0), None, "warning") == 1

    def test_fail_on_none_never_fails_on_findings_including_errors_and_max_warnings(self):
        assert decide_exit_code(Summary(errors=5, warnings=5, info=0), 0, "none") == 0
