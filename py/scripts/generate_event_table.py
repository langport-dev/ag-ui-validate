#!/usr/bin/env python3
"""Regenerates py/src/ag_ui_validate/protocol/event_table.py from the
installed ag-ui-protocol.

Usage: python py/scripts/generate_event_table.py

The generated file is checked in so the core stays dependency-free at
runtime; tests/test_protocol_drift.py fails when it drifts from the SDK.
"""

from __future__ import annotations

import json
import sys
from importlib.metadata import version as pkg_version
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from derive_lib import derive_event_table  # noqa: E402

import ag_ui.core.events as events  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
EVENTS_DOC = "https://docs.ag-ui.com/concepts/events"

categories = json.loads((ROOT / "spec" / "event-categories.json").read_text())
CATEGORY = categories["eventCategory"]
DEPRECATED = categories["deprecated"]


def docs_url(wire_type: str, class_name: str) -> str:
    if CATEGORY.get(wire_type) == "thinking":
        return f"{EVENTS_DOC}#thinking-events-deprecated"
    # Anchor is the lowercased event name with the "Event" suffix stripped,
    # e.g. ToolCallStartEvent -> #toolcallstart. Matches the TS side exactly
    # (there it strips "EventSchema" off the zod export name instead).
    anchor = class_name[: -len("Event")] if class_name.endswith("Event") else class_name
    return f"{EVENTS_DOC}#{anchor.lower()}"


derived = derive_event_table(events, events.BaseEvent)
event_types = derived["event_types"]
table = derived["table"]

missing = [t for t in event_types if t not in table]
if missing:
    print(f"EventType values with no derivable schema: {missing}", file=sys.stderr)
    sys.exit(1)
uncategorized = [t for t in table if t not in CATEGORY]
if uncategorized:
    print(f"New event types need a category assignment: {uncategorized}", file=sys.stderr)
    sys.exit(1)

sdk_version = pkg_version("ag-ui-protocol")


def render_field(name: str, spec: dict) -> str:
    parts = [f"\"kind\": {spec['kind']!r}", f"\"required\": {spec['required']!r}"]
    if "enum" in spec:
        parts.append(f"\"enum\": {spec['enum']!r}")
    return f"            {name!r}: {{{', '.join(parts)}}},"


entries = []
for wire_type in event_types:
    entry = table[wire_type]
    lines = [f"    {wire_type!r}: {{", f"        \"category\": {CATEGORY[wire_type]!r},"]
    if wire_type in DEPRECATED:
        lines.append(f"        \"deprecated\": {DEPRECATED[wire_type]!r},")
    lines.append(f"        \"specUrl\": {docs_url(wire_type, entry['class_name'])!r},")
    lines.append("        \"fields\": {")
    for field_name, spec in entry["fields"].items():
        lines.append(render_field(field_name, spec))
    lines.append("        },")
    lines.append("    },")
    entries.append("\n".join(lines))

out = f'''"""AUTO-GENERATED from ag-ui-protocol v{sdk_version} — do not edit by hand.
Regenerate with: python py/scripts/generate_event_table.py
tests/test_protocol_drift.py fails if this file drifts from the installed SDK.
"""

from __future__ import annotations

from typing import Any

# FieldKind: "string" | "number" | "boolean" | "object" | "array" | "any"
# EventCategory: "lifecycle" | "text" | "toolcall" | "state" | "activity"
#                | "reasoning" | "thinking" | "special"
# FieldSpec: {{"kind": FieldKind, "required": bool, "enum": list[str] (optional)}}
# EventSpec: {{"category": EventCategory, "deprecated": str (optional),
#              "specUrl": str, "fields": dict[str, FieldSpec]}}

SDK_VERSION = {sdk_version!r}

EVENT_TABLE: dict[str, dict[str, Any]] = {{
{chr(10).join(entries)}
}}

EVENT_TYPES: list[str] = list(EVENT_TABLE.keys())

# Wire types documented as drafts (https://docs.ag-ui.com/drafts/overview) but
# not yet in ag-ui-protocol. Not errors: reported at info severity.
DRAFT_EVENT_TYPES: list[str] = ["META"]
'''

out_path = ROOT / "py" / "src" / "ag_ui_validate" / "protocol" / "event_table.py"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(out)
print(
    f"Wrote py/src/ag_ui_validate/protocol/event_table.py "
    f"(ag-ui-protocol v{sdk_version}, {len(event_types)} event types)"
)
