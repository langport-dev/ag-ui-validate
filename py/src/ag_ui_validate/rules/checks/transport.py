"""Transport rules (AGUI501, AGUI505-AGUI508) are only checkable against a
live connection: SSE framing, Content-Type, keepalive timing, flush
behaviour, abnormal EOF. The core cannot observe any of that from a parsed
event sequence, so it reports these rules as skipped - never silently - and
the transport layer (ag_ui_validate.transport, PM5) evaluates them.

AGUI502/503/504 are transport-adjacent but *are* checkable here (the core
accepts raw JSON strings), so they live in the engine, not this list.
Mirrors js/src/rules/checks/transport.ts.
"""

from __future__ import annotations

from ..catalog import CATALOG

TRANSPORT_SKIP_REASON = (
    "transport-layer rule; only checkable against a live connection "
    "(validated by ag_ui_validate.transport)"
)

TRANSPORT_RULE_IDS: tuple = tuple(r.id for r in CATALOG.rules if r.checked_in == "transport")
