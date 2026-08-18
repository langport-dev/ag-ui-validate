"""Meta-test for the rule catalog: every entry must cite the spec, and have
fixture coverage. Mirrors js/test/catalog.test.ts.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from ag_ui_validate.rules.catalog import CATALOG, RULES, format_message, validate_catalog

ROOT = Path(__file__).resolve().parents[2]


def test_loads_and_validates():
    assert len(CATALOG.rules) > 0
    assert len(RULES) == len(CATALOG.rules)


@pytest.mark.parametrize("rule", CATALOG.rules, ids=lambda r: r.id)
def test_cites_a_real_spec_section(rule):
    assert re.match(
        r"^https://(docs\.ag-ui\.com|html\.spec\.whatwg\.org|datatracker\.ietf\.org)/",
        rule.spec_url,
    )


def test_only_downgraded_ambiguous_rules_cite_spec_questions_and_all_citations_resolve():
    spec_questions = (ROOT / "docs" / "spec-questions.md").read_text()
    for rule in CATALOG.rules:
        if rule.spec_question:
            assert f"## {rule.spec_question}:" in spec_questions, (
                f"{rule.id} cites {rule.spec_question}"
            )


def test_rules_that_fire_only_under_a_declared_feature_name_that_feature():
    for rule in CATALOG.rules:
        if rule.requires_feature:
            assert rule.feature


def test_message_templates_format_cleanly():
    rule = RULES.get("AGUI203")
    assert rule is not None
    assert format_message(rule, {"toolCallId": "call_7"}) == (
        "TOOL_CALL_START id 'call_7' never terminated"
    )


def test_rejects_a_catalog_with_a_missing_spec_url():
    with pytest.raises(ValueError, match="specUrl"):
        validate_catalog(
            {
                "catalogVersion": "0",
                "spec": "0.x",
                "rules": [
                    {
                        "id": "AGUI999",
                        "severity": "error",
                        "title": "x",
                        "messageTemplate": "x",
                        "since": "0.x",
                        "checkedIn": "core",
                    }
                ],
            }
        )


_CATEGORIES = {"lifecycle", "text", "toolcall", "state", "reasoning", "transport", "hygiene"}


def test_rejects_a_catalog_with_an_unknown_category():
    with pytest.raises(ValueError, match="category"):
        validate_catalog(
            {
                "catalogVersion": "0",
                "spec": "0.x",
                "rules": [
                    {
                        "id": "AGUI999",
                        "severity": "error",
                        "title": "x",
                        "messageTemplate": "x",
                        "specUrl": "https://docs.ag-ui.com/x",
                        "since": "0.x",
                        "checkedIn": "core",
                        "category": "nonsense",
                    }
                ],
            }
        )


@pytest.mark.parametrize("rule", CATALOG.rules, ids=lambda r: r.id)
def test_has_a_known_category(rule):
    assert rule.category in _CATEGORIES


def test_category_matches_the_rule_id_hundreds_digit_grouping():
    expected_by_prefix = {
        "0": "lifecycle",
        "1": "text",
        "2": "toolcall",
        "3": "state",
        "4": "reasoning",
        "5": "transport",
        "9": "hygiene",
    }
    for rule in CATALOG.rules:
        assert rule.category == expected_by_prefix[rule.id[4]], rule.id


def test_every_rule_has_an_invalid_fixture_directory_whose_expected_json_fires_it():
    root = ROOT / "spec" / "fixtures" / "invalid"
    dirs = [d.name for d in root.iterdir() if d.is_dir()]
    for rule in CATALOG.rules:
        matching = [d for d in dirs if d.startswith(f"{rule.id}-")]
        assert matching, f"{rule.id} has no spec/fixtures/invalid/{rule.id}-*/ directory"
        expected = json.loads((root / matching[0] / "expected.json").read_text())
        assert rule.id in [d["rule"] for d in expected], (
            f"{matching[0]}/expected.json must include {rule.id}"
        )
