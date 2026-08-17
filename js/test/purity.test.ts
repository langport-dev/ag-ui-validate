// Static isomorphism guard. The core (everything under src/ except
// src/transport/) must stay pure: no I/O, no clocks, no platform globals —
// the moment it touches one, it forks into Node-only and browser-only
// variants. The transport layer may use web-platform APIs (fetch,
// TextDecoder, timers) but nothing Node-specific.
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const SRC = fileURLToPath(new URL("../src/", import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith(".ts")) out.push(full)
  }
  return out
}

const allFiles = walk(SRC)
// The CLI executable is the one deliberately Node-only file: it is a bin
// entry, never importable from the library, and may use any Node API.
const NODE_ONLY = [join(SRC, "cli.ts")]
const scannedFiles = allFiles.filter((f) => !NODE_ONLY.includes(f))
const coreFiles = scannedFiles.filter((f) => !f.includes(`${SRC}transport`))

// Usage patterns (call/construct/property), so prose in comments can still
// name the APIs without tripping the guard.
const CORE_BANNED: [RegExp, string][] = [
  [/\bfetch\s*\(/, "fetch call"],
  [/new\s+(TextDecoder|TextEncoder|ReadableStream|AbortController|EventSource|WebSocket|XMLHttpRequest)\b/, "platform constructor"],
  [/\b(setTimeout|setInterval|queueMicrotask)\s*\(/, "timer"],
  [/\bDate\.now\b|\bnew\s+Date\b/, "clock"],
  [/\bMath\.random\b/, "nondeterminism"],
  [/\b(document|window|navigator|process)\s*[.[]/, "platform global"],
]

const UNIVERSALLY_BANNED: [RegExp, string][] = [
  [/from\s+"node:/, "node built-in import"],
  [/require\s*\(\s*"/, "require call"],
  [/from\s+"(fs|path|http|https|net|os|child_process|worker_threads)"/, "node built-in import"],
]

describe("core purity (src/ minus transport/)", () => {
  it.each(coreFiles.map((f) => [f.slice(SRC.length), f] as const))("%s", (_rel, file) => {
    const source = readFileSync(file, "utf8")
    for (const [pattern, label] of [...CORE_BANNED, ...UNIVERSALLY_BANNED]) {
      expect(pattern.test(source), `${label} (${pattern}) found in core file`).toBe(false)
    }
  })
})

describe("transport isomorphism (web APIs allowed, Node APIs not)", () => {
  it.each(scannedFiles.filter((f) => f.includes(`${SRC}transport`)).map((f) => [f.slice(SRC.length), f] as const))(
    "%s",
    (_rel, file) => {
      const source = readFileSync(file, "utf8")
      for (const [pattern, label] of UNIVERSALLY_BANNED) {
        expect(pattern.test(source), `${label} (${pattern}) found in transport file`).toBe(false)
      }
    },
  )
})

describe("node-only isolation", () => {
  it("no library file imports the CLI executable", () => {
    for (const file of scannedFiles) {
      const source = readFileSync(file, "utf8")
      expect(/from\s+"[^"]*\/cli\.js"|from\s+"\.\/cli\.js"/.test(source), `${file} imports cli.js`).toBe(false)
    }
  })
})
