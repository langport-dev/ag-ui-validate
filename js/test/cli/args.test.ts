import { describe, expect, it } from "vitest"
import { decideExitCode, parseCliArgs, USAGE } from "../../src/cli-args.js"

const ok = (argv: string[]) => {
  const r = parseCliArgs(argv)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r.config
}
const err = (argv: string[]) => {
  const r = parseCliArgs(argv)
  if (r.ok) throw new Error("expected an error")
  return r.error
}

describe("parseCliArgs", () => {
  it("parses a URL target with defaults", () => {
    const c = ok(["http://localhost:8000/agui"])
    expect(c.target).toBe("http://localhost:8000/agui")
    expect(c.format).toBe("pretty")
    expect(c.severityOverrides).toEqual({})
    expect(c.headers).toEqual({})
  })

  it("parses stdin and file targets", () => {
    expect(ok(["-"]).target).toBe("-")
    expect(ok(["run.jsonl"]).target).toBe("run.jsonl")
  })

  it("requires a target unless --help/--version", () => {
    expect(err([])).toMatch(/target/i)
    expect(ok(["--help"]).help).toBe(true)
    expect(ok(["--version"]).version).toBe(true)
  })

  it("rejects a second target", () => {
    expect(err(["a.jsonl", "b.jsonl"])).toMatch(/one target/i)
  })

  it("machine formats are mutually exclusive", () => {
    expect(ok(["-", "--json"]).format).toBe("json")
    expect(ok(["-", "--sarif"]).format).toBe("sarif")
    expect(ok(["-", "--junit"]).format).toBe("junit")
    expect(err(["-", "--json", "--sarif"])).toMatch(/one of/i)
  })

  it("--off disables rules, repeatably", () => {
    const c = ok(["-", "--off", "AGUI901", "--off", "AGUI902"])
    expect(c.severityOverrides).toEqual({ AGUI901: "off", AGUI902: "off" })
  })

  it("--rule overrides severity with ID=severity", () => {
    const c = ok(["-", "--rule", "AGUI105=error", "--rule=AGUI903=warning"])
    expect(c.severityOverrides).toEqual({ AGUI105: "error", AGUI903: "warning" })
  })

  it("rejects malformed --rule and --off values", () => {
    expect(err(["-", "--rule", "AGUI105"])).toMatch(/ID=severity/i)
    expect(err(["-", "--rule", "AGUI105=fatal"])).toMatch(/severity/i)
    expect(err(["-", "--off", "banana"])).toMatch(/AGUI/i)
  })

  it("--max-warnings takes a non-negative integer", () => {
    expect(ok(["-", "--max-warnings", "0"]).maxWarnings).toBe(0)
    expect(ok(["-", "--max-warnings=3"]).maxWarnings).toBe(3)
    expect(err(["-", "--max-warnings", "lots"])).toMatch(/integer/i)
  })

  it("--timeout is seconds, stored as ms", () => {
    expect(ok(["-", "--timeout", "30"]).timeoutMs).toBe(30000)
    expect(err(["-", "--timeout", "0"])).toMatch(/positive/i)
  })

  it("--header parses and repeats", () => {
    const c = ok(["-", "--header", "Authorization: Bearer x", "--header", "X-Trace:1"])
    expect(c.headers).toEqual({ authorization: "Bearer x", "x-trace": "1" })
    expect(err(["-", "--header", "no-colon-here"])).toMatch(/name: value/i)
  })

  it("--features splits on commas", () => {
    expect(ok(["-", "--features", "shared-state,human-in-the-loop"]).features).toEqual([
      "shared-state",
      "human-in-the-loop",
    ])
  })

  it("--no-color forces color off", () => {
    expect(ok(["-", "--no-color"]).color).toBe(false)
    expect(ok(["-"]).color).toBeNull() // auto
  })

  it("--group is a pretty-output flag", () => {
    expect(ok(["-", "--group"]).group).toBe(true)
    expect(ok(["-"]).group).toBe(false)
    expect(err(["-", "--group", "--json"])).toMatch(/pretty/i)
    expect(err(["-", "--json", "--group"])).toMatch(/pretty/i) // order-independent
    // file outputs are unaffected: full reports still go to the files
    expect(ok(["-", "--group", "--sarif-file", "o.sarif"]).group).toBe(true)
  })

  it("file-output flags store paths and combine with any stdout format", () => {
    const c = ok(["-", "--sarif-file", "out.sarif", "--junit-file=out.xml", "--json-file", "r.json"])
    expect(c.sarifFile).toBe("out.sarif")
    expect(c.junitFile).toBe("out.xml")
    expect(c.jsonFile).toBe("r.json")
    expect(c.format).toBe("pretty") // stdout format untouched
    expect(ok(["-", "--json", "--sarif-file", "o.sarif"]).format).toBe("json")
    expect(err(["-", "--sarif-file"])).toMatch(/value/i)
  })

  it("rejects unknown flags with usage help", () => {
    expect(err(["-", "--frobnicate"])).toMatch(/unknown/i)
  })

  it("flags needing values reject a missing value", () => {
    expect(err(["-", "--rule"])).toMatch(/value/i)
  })

  it("USAGE mentions every flag", () => {
    for (const flag of ["--json", "--sarif", "--junit", "--max-warnings", "--rule", "--off", "--features", "--timeout", "--header", "--no-color", "--group", "--sarif-file", "--junit-file", "--json-file"]) {
      expect(USAGE).toContain(flag)
    }
  })
})

describe("decideExitCode", () => {
  it("0 on a clean report", () => {
    expect(decideExitCode({ errors: 0, warnings: 2, info: 5 })).toBe(0)
  })
  it("1 when errors exist", () => {
    expect(decideExitCode({ errors: 1, warnings: 0, info: 0 })).toBe(1)
  })
  it("1 when warnings exceed --max-warnings", () => {
    expect(decideExitCode({ errors: 0, warnings: 3, info: 0 }, 2)).toBe(1)
    expect(decideExitCode({ errors: 0, warnings: 2, info: 0 }, 2)).toBe(0)
  })
})
