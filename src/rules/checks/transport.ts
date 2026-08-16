// Transport rules (AGUI501, AGUI505–AGUI508) are only checkable against a
// live connection: SSE framing, Content-Type, keepalive timing, flush
// behaviour, abnormal EOF. The core cannot observe any of that from a parsed
// event sequence, so it reports these rules as skipped — never silently —
// and the transport layer (ag-ui-validate/transport, M5) evaluates them.
//
// AGUI502/503/504 are transport-adjacent but *are* checkable here (the core
// accepts raw JSON strings), so they live in the engine, not this list.

import { CATALOG } from "../catalog.js"

export const TRANSPORT_SKIP_REASON =
  "transport-layer rule; only checkable against a live connection (validated by ag-ui-validate/transport)"

export const TRANSPORT_RULE_IDS: readonly string[] = CATALOG.rules
  .filter((r) => r.checkedIn === "transport")
  .map((r) => r.id)
