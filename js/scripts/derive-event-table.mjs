// Derives the canonical AG-UI event table from @ag-ui/core's zod schemas.
// Usage: node scripts/derive-event-table.mjs > /tmp/event-table.json
//
// The output is the source of truth for src/protocol/event-table.ts; a vitest
// meta-test re-runs this derivation against the installed @ag-ui/core and fails
// if the checked-in table has drifted from the SDK.

import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const core = require("@ag-ui/core")

function unwrap(schema) {
  const mods = { optional: false, nullable: false, hasDefault: false }
  let s = schema
  for (;;) {
    const t = s._def?.typeName
    if (t === "ZodOptional") { mods.optional = true; s = s._def.innerType }
    else if (t === "ZodNullable") { mods.nullable = true; s = s._def.innerType }
    else if (t === "ZodDefault") { mods.hasDefault = true; s = s._def.innerType }
    else if (t === "ZodEffects") { s = s._def.schema }
    else if (t === "ZodLazy") { s = s._def.getter() }
    else if (t === "ZodBranded" || t === "ZodReadonly") { s = s._def.type ?? s._def.innerType }
    else break
  }
  return { schema: s, mods }
}

function describe(schema, depth = 0) {
  const { schema: s, mods } = unwrap(schema)
  const t = s._def?.typeName
  let type
  switch (t) {
    case "ZodString": type = "string"; break
    case "ZodNumber": type = "number"; break
    case "ZodBoolean": type = "boolean"; break
    case "ZodAny": type = "any"; break
    case "ZodUnknown": type = "unknown"; break
    case "ZodLiteral": type = { literal: s._def.value }; break
    case "ZodEnum": type = { enum: s._def.values }; break
    case "ZodNativeEnum": type = { enum: Object.values(s._def.values) }; break
    case "ZodArray": type = { array: depth > 4 ? "..." : describe(s._def.type, depth + 1).type }; break
    case "ZodRecord": type = "record"; break
    case "ZodUnion":
      type = { union: s._def.options.map((o) => (depth > 4 ? "..." : describe(o, depth + 1).type)) }
      break
    case "ZodDiscriminatedUnion":
      type = { discriminatedUnion: s._def.discriminator, options: [...s._def.options.keys?.() ?? []] }
      break
    case "ZodObject": {
      if (depth > 4) { type = "object"; break }
      const fields = {}
      for (const [k, v] of Object.entries(s.shape)) fields[k] = describe(v, depth + 1)
      type = { object: fields }
      break
    }
    default: type = t ?? "unknown"
  }
  const out = { type }
  if (mods.optional) out.optional = true
  if (mods.nullable) out.nullable = true
  if (mods.hasDefault) out.hasDefault = true
  return out
}

const eventSchemaExports = Object.keys(core).filter((k) => k.endsWith("EventSchema") && k !== "BaseEventSchema")
const table = {}
for (const name of eventSchemaExports) {
  const desc = describe(core[name])
  const typeField = desc.type?.object?.type
  const literal = typeField?.type?.literal ?? typeField?.type?.enum?.[0]
  if (!literal) continue
  table[literal] = { schemaExport: name, fields: desc.type.object }
}

const result = {
  sdk: { name: "@ag-ui/core", version: require("@ag-ui/core/package.json").version },
  eventTypes: Object.values(core.EventType),
  events: table,
}
process.stdout.write(JSON.stringify(result, null, 2) + "\n")
