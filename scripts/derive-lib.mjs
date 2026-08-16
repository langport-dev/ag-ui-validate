// Shared derivation logic: turns @ag-ui/core's zod schemas into the normalized
// event table consumed by src/protocol/event-table.ts and the drift test.
//
// Normalized shape, per wire type:
//   { fields: { [name]: { kind, required, enum? } } }
// Base-event fields (type, timestamp, rawEvent) are excluded — they are common
// to every event and validated separately.

const BASE_FIELDS = new Set(["type", "timestamp", "rawEvent"])

function unwrap(schema) {
  const mods = { optional: false, hasDefault: false }
  let s = schema
  for (;;) {
    const t = s._def?.typeName
    if (t === "ZodOptional") { mods.optional = true; s = s._def.innerType }
    else if (t === "ZodNullable") { s = s._def.innerType }
    else if (t === "ZodDefault") { mods.hasDefault = true; s = s._def.innerType }
    else if (t === "ZodEffects") { s = s._def.schema }
    else if (t === "ZodLazy") { s = s._def.getter() }
    else if (t === "ZodBranded" || t === "ZodReadonly") { s = s._def.type ?? s._def.innerType }
    else break
  }
  return { schema: s, mods }
}

function fieldSpec(schema) {
  const { schema: s, mods } = unwrap(schema)
  const t = s._def?.typeName
  const required = !mods.optional && !mods.hasDefault
  switch (t) {
    case "ZodString": return { kind: "string", required }
    case "ZodNumber": return { kind: "number", required }
    case "ZodBoolean": return { kind: "boolean", required }
    case "ZodArray": return { kind: "array", required }
    case "ZodObject":
    case "ZodRecord":
    case "ZodDiscriminatedUnion": return { kind: "object", required }
    case "ZodLiteral": {
      const v = s._def.value
      if (typeof v === "string") return { kind: "string", required, enum: [v] }
      return { kind: typeof v === "number" ? "number" : "any", required }
    }
    case "ZodEnum": return { kind: "string", required, enum: [...s._def.values] }
    case "ZodNativeEnum": return { kind: "string", required, enum: Object.values(s._def.values) }
    case "ZodUnion": {
      const opts = s._def.options.map((o) => unwrap(o).schema)
      if (opts.every((o) => o._def?.typeName === "ZodLiteral" && typeof o._def.value === "string")) {
        return { kind: "string", required, enum: opts.map((o) => o._def.value) }
      }
      const kinds = new Set(opts.map((o) => fieldSpec(o).kind))
      return kinds.size === 1 ? { kind: [...kinds][0], required } : { kind: "any", required }
    }
    default: return { kind: "any", required }
  }
}

/** @param core the @ag-ui/core module */
export function deriveEventTable(core) {
  const table = {}
  const schemaExports = Object.keys(core).filter(
    (k) => k.endsWith("EventSchema") && k !== "BaseEventSchema",
  )
  for (const name of schemaExports) {
    const { schema } = unwrap(core[name])
    if (schema._def?.typeName !== "ZodObject") continue
    const shape = schema.shape
    const typeSpec = shape.type && fieldSpec(shape.type)
    const wireType = typeSpec?.enum?.[0]
    if (!wireType) continue
    const fields = {}
    for (const [field, sub] of Object.entries(shape)) {
      if (BASE_FIELDS.has(field)) continue
      fields[field] = fieldSpec(sub)
    }
    table[wireType] = { schemaExport: name, fields }
  }
  return { eventTypes: Object.values(core.EventType), table }
}
