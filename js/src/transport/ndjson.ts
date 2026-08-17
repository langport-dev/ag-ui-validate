// Incremental NDJSON (application/x-ndjson) line splitter. Yields non-empty
// lines with trailing CR stripped; the core decides whether they parse.

export async function* ndjsonLines(source: AsyncIterable<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  function clean(line: string): string | null {
    const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line
    return trimmed.trim() === "" ? null : trimmed
  }

  for await (const chunk of source) {
    buffer += decoder.decode(chunk, { stream: true })
    let i: number
    while ((i = buffer.indexOf("\n")) !== -1) {
      const line = clean(buffer.slice(0, i))
      buffer = buffer.slice(i + 1)
      if (line !== null) yield line
    }
  }
  buffer += decoder.decode()
  const last = clean(buffer)
  if (last !== null) yield last
}
