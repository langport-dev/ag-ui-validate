"""The corpus's notion of validity must match the protocol steward's: every
event in a valid/ fixture parses with ag-ui-protocol's own Event schema, and
the schema-violation fixtures are rejected by the SDK for the same reason we
flag them. Mirrors js/test/sdk-alignment.test.ts. (ag-ui-protocol is a dev
dependency — test-only, never runtime; see py/pyproject.toml.)
"""

from __future__ import annotations

import json
from pathlib import Path

import ag_ui.core as core
import pytest
from pydantic import TypeAdapter, ValidationError

FIXTURES = Path(__file__).resolve().parents[2] / "spec" / "fixtures"
_EVENT = TypeAdapter(core.Event)


def _lines(path: Path) -> list:
    return [line for line in path.read_text().splitlines() if line.strip()]


def _sdk_accepts(raw: dict) -> bool:
    try:
        _EVENT.validate_python(raw)
        return True
    except ValidationError:
        return False


VALID_FILES = sorted(p.name for p in (FIXTURES / "valid").glob("*.jsonl"))


@pytest.mark.parametrize("file", VALID_FILES)
def test_every_event_in_valid_fixture_parses_with_the_sdk(file):
    for line in _lines(FIXTURES / "valid" / file):
        raw = json.loads(line)
        assert _sdk_accepts(raw), f"SDK rejects {file}: {line[:80]}"


def _event_at(dir_name: str, index: int) -> dict:
    return json.loads(_lines(FIXTURES / "invalid" / dir_name / "stream.jsonl")[index])


def test_agui504_offending_event_is_rejected_by_the_sdk_too():
    assert not _sdk_accepts(_event_at("AGUI504-schema-violation", 1))


def test_agui503_unknown_type_is_rejected_by_the_sdk_too():
    assert not _sdk_accepts(_event_at("AGUI503-unknown-event-type", 1))


@pytest.mark.parametrize(
    "dir_name", ["AGUI203-unterminated-tool-call", "AGUI104-duplicate-message-id"]
)
def test_sequencing_only_fixtures_stay_schema_clean_per_the_sdk(dir_name):
    # These violate ordering rules, not schemas — the SDK must accept every
    # individual event, which is exactly why a validator has to exist.
    for line in _lines(FIXTURES / "invalid" / dir_name / "stream.jsonl"):
        raw = json.loads(line)
        assert _sdk_accepts(raw), f"{dir_name}: {line[:60]}"
