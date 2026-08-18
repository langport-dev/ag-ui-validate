"""The fixture runner: the corpus in spec/fixtures/ is the test suite. Adding
a rule means adding a fixture directory, not writing a test. Mirrors
js/test/fixtures.test.ts.

Protocol (language-neutral, see spec/fixtures/README.md): feed every
non-empty line of the .jsonl as a RAW STRING (so malformed-JSON fixtures
reach the parser), finalize, and compare the report's diagnostics against
expected.json.

Three documented exceptions, all inherent cross-runtime/cross-SDK
differences rather than bugs — everything except `message` is still
asserted exactly for these:
  - AGUI204 / AGUI502: expected.json bakes in V8's JSON.parse error text
    (e.g. "Unexpected token 'o' ..."); Python's json module reports the same
    malformed input differently (e.g. "Expecting value: line 1 column 9").
    No shared JSON parser exists to make these identical.
  - AGUI503: the message embeds the installed SDK's version number
    ({sdkVersion}) — @ag-ui/core and ag-ui-protocol are versioned
    independently (0.0.58 vs 0.1.20 as of this writing), so this will always
    differ and isn't meaningful to compare.
  - Transport scenarios (scenario.json fixtures: AGUI501/505/506/507/508)
    describe an HTTP response body as timed byte chunks; a simulated clock
    advances by each chunk's gapMs (see spec/fixtures/README.md) and is fed
    through validate_body, mirroring js/test/fixtures.test.ts's runScenario().
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional

import pytest

from ag_ui_validate.engine import create_validator
from ag_ui_validate.protocol.event_table import EVENT_TABLE
from ag_ui_validate.transport import TransportOptions, validate_body
from ag_ui_validate.types import Diagnostic, ValidatorOptions

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "spec" / "fixtures"

# Rules whose expected.json message embeds either a native JSON-parser error
# string or an SDK version number, both of which differ between the two
# languages by design (see module docstring). Structural fields still
# compare exactly.
_RUNTIME_DEPENDENT_MESSAGE_RULES = {"AGUI204", "AGUI502", "AGUI503"}


def _diag_to_dict(d: Diagnostic) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "rule": d.rule,
        "severity": d.severity,
        "message": d.message,
        "eventIndex": d.event_index,
    }
    if d.event_type is not None:
        out["eventType"] = d.event_type
    if d.pointer is not None:
        out["pointer"] = d.pointer
    if d.related_event_index is not None:
        out["relatedEventIndex"] = d.related_event_index
    out["specUrl"] = d.spec_url
    return out


def _stream_lines(path: Path) -> List[str]:
    return [line for line in path.read_text().split("\n") if line.strip() != ""]


def _options_from_json(data: Dict[str, Any]) -> ValidatorOptions:
    return ValidatorOptions(
        spec=data.get("spec"),
        features=data.get("features"),
        severity_overrides=data.get("severityOverrides"),
        layers=data.get("layers"),
    )


def _run_fixture(lines: List[str], options: Optional[ValidatorOptions] = None) -> List[Dict[str, Any]]:
    v = create_validator(options)
    for line in lines:
        v.feed(line)
    v.finalize()
    return [_diag_to_dict(d) for d in v.report().diagnostics]


async def _run_scenario(scenario: Dict[str, Any]) -> List[Dict[str, Any]]:
    clock = {"t": 0}

    async def chunks() -> AsyncGenerator[bytes, None]:
        for chunk in scenario["chunks"]:
            clock["t"] += chunk.get("gapMs", 0)
            yield chunk["text"].encode("utf-8")
        if scenario.get("abnormalEof") is True:
            raise RuntimeError("connection dropped (simulated)")

    opts_data = scenario.get("options")
    result = await validate_body(
        chunks(),
        scenario.get("contentType"),
        TransportOptions(
            now=lambda: clock["t"],
            validator=_options_from_json(opts_data) if opts_data is not None else None,
        ),
    )
    return [_diag_to_dict(d) for d in result.report.diagnostics]


def _assert_matches(actual: List[Dict[str, Any]], expected: List[Dict[str, Any]]) -> None:
    assert len(actual) == len(expected), f"expected {expected}, got {actual}"
    for a, e in zip(actual, expected):
        if a.get("rule") in _RUNTIME_DEPENDENT_MESSAGE_RULES:
            a = {**a, "message": None}
            e = {**e, "message": None}
        assert a == e


_VALID_FILES = sorted((FIXTURES / "valid").glob("*.jsonl"))
_INVALID_DIRS = sorted(d for d in (FIXTURES / "invalid").iterdir() if d.is_dir())
_TRANSPORT_DIRS = {d.name for d in _INVALID_DIRS if (d / "scenario.json").exists()}


@pytest.mark.parametrize("path", _VALID_FILES, ids=lambda p: p.name)
def test_valid_fixture_produces_no_false_positives(path):
    lines = _stream_lines(path)
    expected_path = path.with_name(path.stem + ".expected.json")
    expected = json.loads(expected_path.read_text()) if expected_path.exists() else []
    _assert_matches(_run_fixture(lines), expected)


def test_valid_fixtures_collectively_exercise_every_core_rule_category():
    seen = set()
    for path in _VALID_FILES:
        for line in _stream_lines(path):
            try:
                event_type = json.loads(line).get("type")
            except (json.JSONDecodeError, AttributeError):
                continue  # valid fixtures contain only well-formed lines
            spec = EVENT_TABLE.get(event_type) if event_type is not None else None
            if spec is not None:
                seen.add(spec["category"])
    for category in ["lifecycle", "text", "toolcall", "state", "reasoning", "special"]:
        assert category in seen, f"no valid fixture exercises '{category}' events"


@pytest.mark.parametrize(
    "dir_path",
    [d for d in _INVALID_DIRS if d.name not in _TRANSPORT_DIRS],
    ids=lambda p: p.name,
)
def test_invalid_fixture_fires_its_namesake_rule(dir_path):
    expected = json.loads((dir_path / "expected.json").read_text())
    lines = _stream_lines(dir_path / "stream.jsonl")
    options_path = dir_path / "options.json"
    options = _options_from_json(json.loads(options_path.read_text())) if options_path.exists() else None
    actual = _run_fixture(lines, options)
    _assert_matches(actual, expected)
    rule_id = dir_path.name[:7]
    assert rule_id in [d["rule"] for d in actual], f"{dir_path.name} never fired {rule_id}"


@pytest.mark.parametrize(
    "dir_path", sorted(d for d in _INVALID_DIRS if d.name in _TRANSPORT_DIRS), ids=lambda p: p.name
)
async def test_transport_fixture_fires_its_namesake_rule(dir_path):
    expected = json.loads((dir_path / "expected.json").read_text())
    scenario = json.loads((dir_path / "scenario.json").read_text())
    actual = await _run_scenario(scenario)
    _assert_matches(actual, expected)
    rule_id = dir_path.name[:7]
    assert rule_id in [d["rule"] for d in actual], f"{dir_path.name} never fired {rule_id}"
