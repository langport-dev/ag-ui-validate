// Fails when src/protocol/event-table.ts drifts from the installed @ag-ui/core.
// Fix by re-running: node scripts/generate-event-table.mjs
// (@ag-ui/core is a devDependency only — the runtime core stays dependency-free.)
import { describe, expect, it } from "vitest"
import * as core from "@ag-ui/core"
// @ts-expect-error plain-JS derivation helper shared with scripts/
import { deriveEventTable } from "../scripts/derive-lib.mjs"
import { EVENT_TABLE, EVENT_TYPES, SDK_VERSION } from "../src/protocol/event-table.js"

const derived = deriveEventTable(core) as {
  eventTypes: string[]
  table: Record<string, { fields: Record<string, unknown> }>
}

describe("protocol drift against @ag-ui/core", () => {
  it("covers exactly the SDK's EventType enum, in order", () => {
    expect(EVENT_TYPES).toEqual(derived.eventTypes)
  })

  it.each(derived.eventTypes)("%s fields match the SDK schema", (type) => {
    expect(EVENT_TABLE[type]?.fields).toEqual(derived.table[type]?.fields)
  })

  it("records the SDK version it was derived from", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    expect(SDK_VERSION).toBeTruthy()
  })
})
