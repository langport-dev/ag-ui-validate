// Minimal RFC 6902 (JSON Patch) + RFC 6901 (JSON Pointer) implementation.
// Hand-rolled so the core keeps zero runtime dependencies. Immutable: the
// input document is never mutated; ops apply atomically (all or none).

export type PatchResult =
  | { ok: true; result: unknown }
  | { ok: false; error: string; opIndex: number }

export interface PatchShapeProblem {
  /** Human-readable problem. */
  error: string
  /** Index of the offending op, or -1 when the document itself is not an array. */
  opIndex: number
  /** RFC 6901 pointer into the patch document, e.g. "/0/op". */
  pointer: string
}

const OPS = ["add", "remove", "replace", "move", "copy", "test"] as const
type OpName = (typeof OPS)[number]

/** RFC 6901: "" → whole document; "/a/b" → ["a", "b"]. Returns null when invalid. */
export function parsePointer(pointer: unknown): string[] | null {
  if (typeof pointer !== "string") return null
  if (pointer === "") return []
  if (!pointer.startsWith("/")) return null
  return pointer
    .slice(1)
    .split("/")
    .map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"))
}

/** Structural validation of a patch document, without applying it. */
export function validatePatchShape(patch: unknown): PatchShapeProblem | null {
  if (!Array.isArray(patch)) {
    return { error: "patch document must be an array of operations", opIndex: -1, pointer: "" }
  }
  for (let i = 0; i < patch.length; i++) {
    const op = patch[i]
    if (typeof op !== "object" || op === null || Array.isArray(op)) {
      return { error: `operation ${i} is not an object`, opIndex: i, pointer: `/${i}` }
    }
    const o = op as Record<string, unknown>
    if (!OPS.includes(o.op as OpName)) {
      return { error: `operation ${i} has invalid op '${String(o.op)}'`, opIndex: i, pointer: `/${i}/op` }
    }
    if (parsePointer(o.path) === null) {
      return { error: `operation ${i} (${String(o.op)}) has invalid path`, opIndex: i, pointer: `/${i}/path` }
    }
    if ((o.op === "add" || o.op === "replace" || o.op === "test") && !("value" in o)) {
      return { error: `operation ${i} (${String(o.op)}) is missing value`, opIndex: i, pointer: `/${i}` }
    }
    if ((o.op === "move" || o.op === "copy") && parsePointer(o.from) === null) {
      return { error: `operation ${i} (${String(o.op)}) is missing or has invalid from`, opIndex: i, pointer: `/${i}` }
    }
  }
  return null
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clone)
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = clone(v)
    return out
  }
  return value
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a)
    const kb = Object.keys(b as object)
    return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

function arrayIndex(token: string, length: number, allowAppend: boolean): number | null {
  if (allowAppend && token === "-") return length
  if (!/^(0|[1-9]\d*)$/.test(token)) return null
  const i = Number(token)
  return i > length ? null : i
}

interface Located {
  parent: Record<string, unknown> | unknown[] | null // null → the document root itself
  key: string | number
  exists: boolean
  value: unknown
}

function locate(doc: unknown, tokens: string[], forAdd: boolean): Located | string {
  if (tokens.length === 0) return { parent: null, key: "", exists: true, value: doc }
  let current = doc
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]!
    if (Array.isArray(current)) {
      const idx = arrayIndex(token, current.length, false)
      if (idx === null || idx >= current.length) return `path segment '/${token}' does not exist`
      current = current[idx]
    } else if (typeof current === "object" && current !== null) {
      const obj = current as Record<string, unknown>
      if (!(token in obj)) return `path segment '/${token}' does not exist`
      current = obj[token]
    } else {
      return `path segment '/${token}' is not an object or array`
    }
  }
  const last = tokens[tokens.length - 1]!
  if (Array.isArray(current)) {
    const idx = arrayIndex(last, current.length, forAdd)
    if (idx === null) return `'${last}' is not a valid index for an array of length ${current.length}`
    return { parent: current, key: idx, exists: idx < current.length, value: current[idx] }
  }
  if (typeof current === "object" && current !== null) {
    const obj = current as Record<string, unknown>
    return { parent: obj, key: last, exists: last in obj, value: obj[last] }
  }
  return `target of '/${last}' is not an object or array`
}

/** Applies an RFC 6902 patch. Validates shape first; never throws. */
export function applyPatch(doc: unknown, patch: unknown): PatchResult {
  const shape = validatePatchShape(patch)
  if (shape !== null) return { ok: false, error: shape.error, opIndex: shape.opIndex }

  let result = clone(doc)
  const ops = patch as Record<string, unknown>[]

  const getAt = (pointer: string): { ok: true; value: unknown } | { ok: false; error: string } => {
    const loc = locate(result, parsePointer(pointer)!, false)
    if (typeof loc === "string") return { ok: false, error: `${pointer}: ${loc}` }
    if (!loc.exists) return { ok: false, error: `${pointer} does not exist` }
    return { ok: true, value: loc.value }
  }

  const setAt = (pointer: string, value: unknown, mustExist: boolean): string | null => {
    const tokens = parsePointer(pointer)!
    if (tokens.length === 0) {
      result = value
      return null
    }
    const loc = locate(result, tokens, !mustExist)
    if (typeof loc === "string") return `${pointer}: ${loc}`
    if (mustExist && !loc.exists) return `${pointer} does not exist`
    if (Array.isArray(loc.parent)) {
      if (mustExist) loc.parent[loc.key as number] = value
      else loc.parent.splice(loc.key as number, 0, value)
    } else {
      loc.parent![loc.key as string] = value
    }
    return null
  }

  const removeAt = (pointer: string): { ok: true; removed: unknown } | { ok: false; error: string } => {
    const tokens = parsePointer(pointer)!
    if (tokens.length === 0) return { ok: false, error: "cannot remove the whole document" }
    const loc = locate(result, tokens, false)
    if (typeof loc === "string") return { ok: false, error: `${pointer}: ${loc}` }
    if (!loc.exists) return { ok: false, error: `${pointer} does not exist` }
    if (Array.isArray(loc.parent)) loc.parent.splice(loc.key as number, 1)
    else delete loc.parent![loc.key as string]
    return { ok: true, removed: loc.value }
  }

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    const path = op.path as string
    let error: string | null = null

    switch (op.op as OpName) {
      case "add":
        error = setAt(path, clone(op.value), false)
        break
      case "replace":
        error = setAt(path, clone(op.value), true)
        break
      case "remove": {
        const r = removeAt(path)
        if (!r.ok) error = r.error
        break
      }
      case "move": {
        const from = op.from as string
        if (path.startsWith(`${from}/`)) {
          error = `cannot move ${from} into its own child ${path}`
          break
        }
        const r = removeAt(from)
        if (!r.ok) { error = r.error; break }
        error = setAt(path, r.removed, false)
        break
      }
      case "copy": {
        const r = getAt(op.from as string)
        if (!r.ok) { error = r.error; break }
        error = setAt(path, clone(r.value), false)
        break
      }
      case "test": {
        const r = getAt(path)
        if (!r.ok) error = r.error
        else if (!deepEqual(r.value, op.value)) error = `test failed at ${path}`
        break
      }
    }

    if (error !== null) return { ok: false, error, opIndex: i }
  }
  return { ok: true, result }
}

/** RFC 6901 token escaping, for building diagnostic pointers. */
export function escapePointerToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1")
}
