"""Mirrors js/test/report/reporters.test.ts."""

from __future__ import annotations

import json as json_module
from dataclasses import replace

from ag_ui_validate.report import (
    format_diagnostic_line,
    format_grouped_diagnostics,
    format_report_summary,
    to_json_report,
    to_junit,
    to_sarif,
)
from ag_ui_validate.types import Diagnostic, Report, SkippedRule, Summary

D203 = Diagnostic(
    rule="AGUI203",
    severity="error",
    message="TOOL_CALL_START id 'call_7' never terminated",
    event_index=42,
    event_type="RUN_FINISHED",
    related_event_index=17,
    spec_url="https://docs.ag-ui.com/concepts/events#tool-call-events",
)
D902 = Diagnostic(
    rule="AGUI902",
    severity="info",
    message="None of the 61 events carry the optional timestamp property",
    event_index=-1,
    spec_url="https://docs.ag-ui.com/concepts/events#base-event-properties",
)
D105 = Diagnostic(
    rule="AGUI105",
    severity="warning",
    message="TEXT_MESSAGE_CONTENT for messageId 'm<1>' has an empty delta",
    event_index=7,
    pointer="/delta",
    spec_url="https://docs.ag-ui.com/concepts/events#textmessagecontent",
)

REPORT = Report(
    diagnostics=[D203, D105, D902],
    summary=Summary(errors=1, warnings=1, info=1),
    features={
        "agentic-chat": "exercised",
        "backend-tool-rendering": "exercised",
        "human-in-the-loop": "not-exercised",
        "agentic-generative-ui": "not-inferable",
        "tool-based-generative-ui": "not-inferable",
        "shared-state": "not-exercised",
        "predictive-state-updates": "not-exercised",
    },
    skipped=[SkippedRule(rule="AGUI506", reason="keepalive timing is not meaningful for recorded input")],
    event_count=61,
    internal_errors=[],
)

CLEAN = replace(REPORT, diagnostics=[], summary=Summary(errors=0, warnings=0, info=0))


class TestPretty:
    def test_formats_a_diagnostic_line_like_the_specs_example_output(self):
        line = format_diagnostic_line(D203, color=False)
        assert "✖ AGUI203" in line
        assert "error" in line
        assert "event 42" in line
        assert "TOOL_CALL_START id 'call_7' never terminated" in line

    def test_stream_level_findings_show_dash_instead_of_an_event_index(self):
        line = format_diagnostic_line(D902, color=False)
        assert "ℹ AGUI902" in line
        assert "—" in line

    def test_no_ansi_codes_without_color(self):
        assert "\x1b[" not in format_diagnostic_line(D203, color=False)
        assert "\x1b[" in format_diagnostic_line(D203, color=True)

    def test_summarizes_counts_and_the_feature_matrix(self):
        s = format_report_summary(REPORT, color=False)
        assert "1 error, 1 warning, 1 info" in s
        assert "2 of 7 AG-UI features exercised" in s
        assert "1 rule not evaluated" in s

    def test_celebrates_a_clean_run(self):
        s = format_report_summary(CLEAN, color=False)
        assert "no conformance violations" in s
        assert "61 events" in s


def _dup(i: int) -> Diagnostic:
    return replace(D105, message=f"TEXT_MESSAGE_CONTENT for messageId 'm{i}' has an empty delta", event_index=i)


class TestPrettyGrouped:
    def test_collapses_repeats_of_a_rule_into_one_line_with_a_count_and_sample_indexes(self):
        out = format_grouped_diagnostics([_dup(7), _dup(12), _dup(18), _dup(25), _dup(31)], color=False)
        lines = [l for l in out.split("\n") if "AGUI105" in l]
        assert len(lines) == 1
        assert "×5" in out
        assert "Empty content delta" in out  # catalog title, not one occurrence's message
        assert "events 7, 12, 18" in out
        assert "+2 more" in out
        assert D105.spec_url in out

    def test_orders_groups_by_severity_then_rule_id_and_handles_stream_level_findings(self):
        out = format_grouped_diagnostics([D902, D105, D203], color=False)
        order = [out.index(r) for r in ["AGUI203", "AGUI105", "AGUI902"]]
        assert -1 not in order
        assert order == sorted(order)
        assert "×1" in out
        assert "stream" in out  # AGUI902 has no event index
        assert "\x1b[" not in out
        assert "\x1b[" in format_grouped_diagnostics([D203], color=True)

    def test_a_single_occurrence_never_says_more(self):
        assert "more" not in format_grouped_diagnostics([D203], color=False)


class TestJson:
    def test_wraps_the_report_with_tool_metadata(self):
        out = to_json_report(REPORT, tool={"name": "ag-ui-validate", "version": "1.2.3"}, target="run.jsonl")
        assert out["tool"] == {"name": "ag-ui-validate", "version": "1.2.3"}
        assert out["target"] == "run.jsonl"
        assert out["summary"] == {"errors": 1, "warnings": 1, "info": 1}
        assert len(out["diagnostics"]) == 3
        assert json_module.loads(json_module.dumps(out)) == out  # JSON-safe


class TestSarif:
    def test_emits_valid_sarif_structure_with_level_mapping_and_rule_metadata(self):
        s = to_sarif(REPORT, tool_version="1.2.3", artifact_uri="run.jsonl")
        assert s["version"] == "2.1.0"
        assert "sarif" in s["$schema"]
        run = s["runs"][0]
        assert run["tool"]["driver"]["name"] == "ag-ui-validate"
        assert run["tool"]["driver"]["version"] == "1.2.3"
        levels = [r["level"] for r in run["results"]]
        assert levels == ["error", "warning", "note"]
        meta = next(r for r in run["tool"]["driver"]["rules"] if r["id"] == "AGUI203")
        assert "docs.ag-ui.com" in meta["helpUri"]
        assert meta["shortDescription"]["text"] == "Unterminated tool call"
        assert meta["defaultConfiguration"]["level"] == "error"
        info = next(r for r in run["tool"]["driver"]["rules"] if r["id"] == "AGUI902")
        assert info["defaultConfiguration"]["level"] == "note"
        # line-based location for line-oriented input: eventIndex 42 -> line 43
        assert run["results"][0]["locations"][0]["physicalLocation"]["region"]["startLine"] == 43
        # stream-level findings carry no location
        assert run["results"][2]["locations"] == []

    def test_omits_locations_entirely_when_there_is_no_line_based_artifact(self):
        s = to_sarif(REPORT, tool_version="1.2.3")
        assert s["runs"][0]["results"][0]["locations"] == []


class TestJunit:
    def test_emits_one_testcase_per_finding_failures_for_errors_escaped_xml(self):
        xml = to_junit(REPORT, name="run.jsonl")
        assert '<?xml version="1.0" encoding="UTF-8"?>' in xml
        assert 'tests="3"' in xml
        assert 'failures="1"' in xml
        assert 'skipped="2"' in xml
        assert "AGUI203" in xml
        assert "m&lt;1&gt;" in xml  # the < > in the message got escaped
        assert "m<1>" not in xml

    def test_wraps_the_suite_in_a_testsuites_root_for_strict_ci_parsers(self):
        xml = to_junit(REPORT, name="run.jsonl")
        import re

        assert re.search(r'<testsuites [^>]*tests="3"[^>]*>', xml)
        assert xml.strip().endswith("</testsuites>")

    def test_a_clean_report_is_a_single_passing_testcase(self):
        xml = to_junit(CLEAN, name="run.jsonl")
        assert 'tests="1"' in xml
        assert 'failures="0"' in xml
        assert "conformance" in xml
