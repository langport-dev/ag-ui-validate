import { describe, expect, it } from "vitest"
import { ndjsonLines } from "../../src/transport/ndjson.js"

const enc = new TextEncoder()

async function collect(...parts: string[]): Promise<string[]> {
  async function* chunks(): AsyncGenerator<Uint8Array> {
    for (const p of parts) yield enc.encode(p)
  }
  const out: string[] = []
  for await (const line of ndjsonLines(chunks())) out.push(line)
  return out
}

describe("ndjsonLines", () => {
  it("splits lines and skips empties", async () => {
    expect(await collect('{"a":1}\n\n{"b":2}\n')).toEqual(['{"a":1}', '{"b":2}'])
  })

  it("trims carriage returns", async () => {
    expect(await collect('{"a":1}\r\n{"b":2}\r\n')).toEqual(['{"a":1}', '{"b":2}'])
  })

  it("reassembles lines split across chunks", async () => {
    expect(await collect('{"a"', ":1}\n{", '"b":2}\n')).toEqual(['{"a":1}', '{"b":2}'])
  })

  it("yields a final line without a trailing newline", async () => {
    expect(await collect('{"a":1}\n{"b":2}')).toEqual(['{"a":1}', '{"b":2}'])
  })
})
