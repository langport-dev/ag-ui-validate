"""Fails when protocol/event_table.py drifts from the installed ag-ui-protocol.
Fix by re-running: python py/scripts/generate_event_table.py
(ag-ui-protocol is a dev dependency only — the runtime core stays
dependency-free.) Mirrors js/test/protocol-drift.test.ts.
"""

from __future__ import annotations

import sys
from pathlib import Path

import ag_ui.core.events as events
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from derive_lib import derive_event_table  # noqa: E402

from ag_ui_validate.protocol.event_table import EVENT_TABLE, EVENT_TYPES, SDK_VERSION

derived = derive_event_table(events, events.BaseEvent)


def test_covers_exactly_the_sdks_event_type_enum_in_order():
    assert EVENT_TYPES == derived["event_types"]


@pytest.mark.parametrize("wire_type", derived["event_types"])
def test_fields_match_the_sdk_schema(wire_type):
    assert EVENT_TABLE[wire_type]["fields"] == derived["table"][wire_type]["fields"]


def test_records_the_sdk_version_it_was_derived_from():
    assert SDK_VERSION
