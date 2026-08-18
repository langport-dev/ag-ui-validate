#!/usr/bin/env python3
"""Fuzz harness for the never-throws invariant: 50k seeded hostile inputs
(cyclic dicts, unserializable values, truncated JSON, deeply nested garbage)
fed to fresh validator instances. Exits 1 on any throw or recorded internal
error. Mirrors js/scripts/fuzz.mjs's generator algorithm (same LCG, same
event-type/value pools, same reset-every-500 cadence) so both fuzzers
exercise comparably hostile input shapes — not byte-identical sequences,
since the two languages' PRNG-consumption order differs slightly, but the
same invariant under the same intensity.

Usage: python py/scripts/fuzz.py [seed]
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from ag_ui_validate import create_validator  # noqa: E402
from ag_ui_validate.types import ValidatorOptions  # noqa: E402

_seed_arg = sys.argv[1] if len(sys.argv) > 1 else "42"
_seed = int(_seed_arg)


def _rnd() -> float:
    global _seed
    _seed = (_seed * 1103515245 + 12345) % 2147483648
    return _seed / 2147483648


def _pick(options):
    return options[int(_rnd() * len(options))]


TYPES = [
    "RUN_STARTED", "RUN_FINISHED", "TEXT_MESSAGE_START", "TEXT_MESSAGE_CONTENT",
    "TOOL_CALL_START", "STATE_DELTA", "STATE_SNAPSHOT", "CUSTOM", "RAW",
    "BOGUS", "runStarted", "META", "",
]


class _Unserializable:
    """Stands in for JS's function/Symbol values — an object json.dumps chokes on."""

    def __repr__(self) -> str:
        return "<unserializable>"


def _vals():
    return _pick(
        [
            None, 0, -1, 3.14, float("nan"), "", "x", True, [], {},
            [[]], {"a": {"b": {"c": {"d": {}}}}}, "null",
            (lambda: None), _Unserializable(),
        ]
    )


def _random_event(depth: int = 0):
    r = _rnd()
    if r < 0.15:
        return _vals()
    if r < 0.3:
        s = json.dumps({"type": _pick(TYPES), "messageId": "m", "delta": "d"})
        return s[: int(_rnd() * len(s))]  # truncated JSON
    e = {"type": _pick(TYPES)}
    keys = [
        "messageId", "toolCallId", "delta", "runId", "threadId", "stepName",
        "snapshot", "timestamp", "name", "value", "event", "outcome",
        "parentMessageId", "messages",
    ]
    for k in keys:
        if _rnd() < 0.4:
            e[k] = _random_event(depth + 1) if depth < 2 and _rnd() < 0.2 else _vals()
    if _rnd() < 0.1:
        e["self"] = e  # cyclic
    if _rnd() < 0.5:
        return e
    try:
        return json.dumps(e)
    except (TypeError, ValueError):
        return e


N = 50_000
throws = 0
internal = 0
v = create_validator()
for i in range(N):
    if i % 500 == 0:
        v.finalize()
        internal += len(v.report().internal_errors)
        v = create_validator(
            ValidatorOptions(features=["shared-state"], severity_overrides={"AGUI902": "off"})
        )
    try:
        v.feed(_random_event())
    except Exception:
        throws += 1
        if throws <= 3:
            print("THREW:", traceback.format_exc(), file=sys.stderr)
v.finalize()
internal += len(v.report().internal_errors)

print(f"fuzz(seed={_seed_arg}): {N} hostile inputs — {throws} throws, {internal} internal errors")
if throws > 0 or internal > 0:
    sys.exit(1)
print("NEVER-THROWS INVARIANT HOLDS")
