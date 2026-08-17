// RFC 6902 unit tests, including examples lifted from the RFC's appendix A.
import { describe, expect, it } from "vitest"
import { applyPatch, validatePatchShape } from "../../src/protocol/jsonpatch.js"

const apply = (doc: unknown, ops: unknown[]) => applyPatch(doc, ops)

describe("applyPatch — RFC 6902 semantics", () => {
  it("A.1 add an object member", () => {
    const r = apply({ foo: "bar" }, [{ op: "add", path: "/baz", value: "qux" }])
    expect(r).toEqual({ ok: true, result: { foo: "bar", baz: "qux" } })
  })

  it("A.2 add an array element", () => {
    const r = apply({ foo: ["bar", "baz"] }, [{ op: "add", path: "/foo/1", value: "qux" }])
    expect(r).toEqual({ ok: true, result: { foo: ["bar", "qux", "baz"] } })
  })

  it("appends with '-'", () => {
    const r = apply({ foo: ["bar"] }, [{ op: "add", path: "/foo/-", value: "baz" }])
    expect(r).toEqual({ ok: true, result: { foo: ["bar", "baz"] } })
  })

  it("A.3 remove an object member", () => {
    const r = apply({ baz: "qux", foo: "bar" }, [{ op: "remove", path: "/baz" }])
    expect(r).toEqual({ ok: true, result: { foo: "bar" } })
  })

  it("A.4 remove an array element", () => {
    const r = apply({ foo: ["bar", "qux", "baz"] }, [{ op: "remove", path: "/foo/1" }])
    expect(r).toEqual({ ok: true, result: { foo: ["bar", "baz"] } })
  })

  it("A.5 replace a value", () => {
    const r = apply({ baz: "qux", foo: "bar" }, [{ op: "replace", path: "/baz", value: "boo" }])
    expect(r).toEqual({ ok: true, result: { baz: "boo", foo: "bar" } })
  })

  it("A.6 move a value", () => {
    const r = apply({ foo: { bar: "baz", waldo: "fred" }, qux: { corge: "grault" } }, [
      { op: "move", from: "/foo/waldo", path: "/qux/thud" },
    ])
    expect(r).toEqual({ ok: true, result: { foo: { bar: "baz" }, qux: { corge: "grault", thud: "fred" } } })
  })

  it("A.7 move an array element", () => {
    const r = apply({ foo: ["all", "grass", "cows", "eat"] }, [
      { op: "move", from: "/foo/1", path: "/foo/3" },
    ])
    expect(r).toEqual({ ok: true, result: { foo: ["all", "cows", "eat", "grass"] } })
  })

  it("A.8/A.9 test ops succeed and fail by deep equality", () => {
    expect(apply({ baz: "qux", foo: ["a", 2, "c"] }, [
      { op: "test", path: "/baz", value: "qux" },
      { op: "test", path: "/foo/1", value: 2 },
    ]).ok).toBe(true)
    expect(apply({ baz: "qux" }, [{ op: "test", path: "/baz", value: "bar" }]).ok).toBe(false)
  })

  it("A.10 add a nested member object", () => {
    const r = apply({ foo: "bar" }, [{ op: "add", path: "/child", value: { grandchild: {} } }])
    expect(r).toEqual({ ok: true, result: { foo: "bar", child: { grandchild: {} } } })
  })

  it("A.12 add to a nonexistent target fails", () => {
    const r = apply({ foo: "bar" }, [{ op: "add", path: "/baz/bat", value: "qux" }])
    expect(r.ok).toBe(false)
  })

  it("A.14 ~ escape ordering", () => {
    const r = apply({ "/": 9, "~1": 10 }, [{ op: "test", path: "/~01", value: 10 }])
    expect(r.ok).toBe(true)
  })

  it("A.16 copy", () => {
    const r = apply({ baz: ["A"], bar: 1 }, [{ op: "copy", from: "/baz/0", path: "/boo" }])
    expect(r).toEqual({ ok: true, result: { baz: ["A"], bar: 1, boo: "A" } })
  })

  it("replace on a missing member fails", () => {
    const r = apply({ a: 1 }, [{ op: "replace", path: "/b", value: 2 }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain("/b")
  })

  it("out-of-bounds array index fails", () => {
    const r = apply({ items: [] }, [{ op: "replace", path: "/items/3", value: "x" }])
    expect(r.ok).toBe(false)
  })

  it("leading-zero and non-numeric array indices fail", () => {
    expect(apply({ a: [1] }, [{ op: "replace", path: "/a/01", value: 2 }]).ok).toBe(false)
    expect(apply({ a: [1] }, [{ op: "replace", path: "/a/x", value: 2 }]).ok).toBe(false)
  })

  it("moving a value into its own child fails", () => {
    const r = apply({ a: { b: {} } }, [{ op: "move", from: "/a", path: "/a/b/c" }])
    expect(r.ok).toBe(false)
  })

  it("whole-document replacement via empty pointer", () => {
    const r = apply({ a: 1 }, [{ op: "replace", path: "", value: { b: 2 } }])
    expect(r).toEqual({ ok: true, result: { b: 2 } })
  })

  it("does not mutate the input document", () => {
    const doc = { items: ["a"] }
    apply(doc, [{ op: "add", path: "/items/-", value: "b" }])
    expect(doc).toEqual({ items: ["a"] })
  })
})

describe("validatePatchShape — structural validation without application", () => {
  it("accepts a valid patch", () => {
    expect(validatePatchShape([{ op: "add", path: "/a", value: 1 }])).toBeNull()
  })

  it.each([
    [{ notAnArray: true }, /array/i],
    [[{ path: "/a", value: 1 }], /op/],
    [[{ op: "merge", path: "/a", value: 1 }], /op/],
    [[{ op: "add", path: "no-slash", value: 1 }], /path/],
    [[{ op: "add", path: "/a" }], /value/],
    [[{ op: "move", path: "/a" }], /from/],
    [["not-an-object"], /object/],
  ])("rejects %j", (patch, pattern) => {
    const problem = validatePatchShape(patch)
    expect(problem).not.toBeNull()
    expect(problem!.error).toMatch(pattern)
  })
})
