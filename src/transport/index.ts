// ag-ui-validate/transport: SSE + NDJSON clients over the pure core.
// This is the I/O layer — fetch, streams, and clocks live here, never in the
// core. Uses only web-platform APIs (fetch, TextDecoder, AbortController) so
// it stays isomorphic: Node 20+, browsers, Deno, Workers.

import { createValidator } from "../index.js"
import type { Diagnostic, Report, ValidationLayer, ValidatorOptions } from "../index.js"
import { ndjsonLines } from "./ndjson.js"
import { sseItems } from "./sse.js"

export { ndjsonLines } from "./ndjson.js"
export { sseItems } from "./sse.js"
export type { SseItem, SseProblemCode } from "./sse.js"

const DEFAULT_KEEPALIVE_MS = 30_000

export interface TransportRequestInit {
  method: string
  headers: Record<string, string>
  body?: string
  signal?: AbortSignal
}

export interface TransportResponseLike {
  status: number
  headers: { get(name: string): string | null }
  body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array> | null
}

export type FetchLike = (url: string, init: TransportRequestInit) => Promise<TransportResponseLike>

/** Operational failure (unreachable endpoint, non-2xx, no body) — distinct
 * from conformance findings, which are diagnostics. */
export class TransportError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "TransportError"
    if (status !== undefined) this.status = status
  }
}

export interface TransportOptions {
  /** Options passed through to createValidator ("transport" layer is added). */
  validator?: ValidatorOptions
  /** Extra request headers (validateEndpoint only). */
  headers?: Record<string, string>
  /** RunAgentInput to POST; defaults to a minimal valid input with one user message. */
  input?: unknown
  method?: "POST" | "GET"
  /** AGUI506 window; default 30 000 ms. */
  keepaliveWindowMs?: number
  /** Abort the request after this long (validateEndpoint only). */
  timeoutMs?: number
  /** Injectable fetch (tests, custom stacks). Default: globalThis.fetch. */
  fetchImpl?: FetchLike
  /** Injectable clock for keepalive/buffering measurement. Default: Date.now. */
  now?: () => number
  /**
   * The body is a recording (file, stdin) rather than a live connection.
   * Timing-based rules (AGUI506, AGUI507) and mid-stream disconnect detection
   * (AGUI508) are meaningless for recordings; they are reported as skipped
   * with a reason instead of risking false positives, and read failures become
   * TransportErrors (tool failure) rather than AGUI508 findings.
   */
  recorded?: boolean
  signal?: AbortSignal
  /** Called after each fed event with the diagnostics it produced. */
  onEvent?: (raw: string, diagnostics: Diagnostic[]) => void
  /** Called for every diagnostic as soon as it is detected. */
  onDiagnostic?: (diagnostic: Diagnostic) => void
}

export interface TransportResult {
  report: Report
  /** HTTP status; null when validating a bare body/recording. */
  status: number | null
  contentType: string | null
  /** Events fed to the validator (SSE frames / NDJSON lines). */
  eventCount: number
  /** Present when the connection failed mid-stream (see AGUI508). */
  transportError?: string
}

function randomId(prefix: string): string {
  const c = globalThis.crypto
  const suffix =
    c !== undefined && "randomUUID" in c
      ? c.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${suffix}`
}

/** The minimal valid RunAgentInput POSTed when none is supplied. */
export function defaultRunAgentInput(): Record<string, unknown> {
  return {
    threadId: randomId("thread"),
    runId: randomId("run"),
    state: {},
    messages: [{ id: randomId("msg"), role: "user", content: "Hello! Please respond briefly." }],
    tools: [],
    context: [],
    forwardedProps: {},
  }
}

async function* iterateBody(
  body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
): AsyncGenerator<Uint8Array> {
  if (Symbol.asyncIterator in body) {
    yield* body as AsyncIterable<Uint8Array>
    return
  }
  const reader = (body as ReadableStream<Uint8Array>).getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      if (value !== undefined) yield value
    }
  } finally {
    reader.releaseLock()
  }
}

/** Buffers up to the first line to guess SSE vs NDJSON, then replays. */
async function sniffFormat(
  source: AsyncGenerator<Uint8Array>,
): Promise<{ format: "sse" | "ndjson"; replay: AsyncGenerator<Uint8Array> }> {
  const held: Uint8Array[] = []
  const decoder = new TextDecoder()
  let text = ""
  while (!text.includes("\n") && text.length < 4096) {
    const { done, value } = await source.next()
    if (done) break
    held.push(value)
    text += decoder.decode(value, { stream: true })
  }
  const firstLine = (text.split("\n")[0] ?? "").trim()
  const format = firstLine.startsWith("{") || firstLine.startsWith("[") ? "ndjson" : "sse"
  async function* replay(): AsyncGenerator<Uint8Array> {
    yield* held
    for (;;) {
      const { done, value } = await source.next()
      if (done) return
      yield value
    }
  }
  return { format, replay: replay() }
}

export async function validateBody(
  body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>,
  contentType: string | null,
  opts: TransportOptions = {},
): Promise<TransportResult> {
  const userLayers = opts.validator?.layers ?? []
  const layers: ValidationLayer[] = [...new Set<ValidationLayer>([...userLayers, "core", "transport"])]
  const v = createValidator({ ...(opts.validator ?? {}), layers })
  const now = opts.now ?? Date.now
  const keepaliveWindow = opts.keepaliveWindowMs ?? DEFAULT_KEEPALIVE_MS
  const recorded = opts.recorded === true

  const emitTransport: typeof v.emitExternal = (rule, params, extra) => {
    const d = v.emitExternal(rule, params, extra)
    if (d !== null) opts.onDiagnostic?.(d)
    return d
  }

  // Byte-level tap: chunk arrival times drive AGUI506 (silent gaps) and
  // AGUI507 (everything in one chunk = buffered, not flushed).
  let chunkCount = 0
  let maxGapMs = 0
  let lastArrival: number | null = null
  async function* tapped(): AsyncGenerator<Uint8Array> {
    for await (const chunk of iterateBody(body)) {
      const t = now()
      if (lastArrival !== null) maxGapMs = Math.max(maxGapMs, t - lastArrival)
      lastArrival = t
      chunkCount += 1
      yield chunk
    }
  }

  const mime = contentType === null ? null : (contentType.split(";")[0] ?? "").trim().toLowerCase()
  if (contentType === null) {
    v.markSkipped("AGUI505", "no Content-Type header is available for this input")
  } else if (mime !== "text/event-stream" && mime !== "application/x-ndjson") {
    emitTransport("AGUI505", { contentType: mime === "" ? "(none)" : mime })
  }
  if (recorded) {
    v.markSkipped("AGUI506", "keepalive timing is not meaningful for recorded input")
    v.markSkipped("AGUI507", "chunk arrival timing is not meaningful for recorded input")
    v.markSkipped(
      "AGUI508",
      "abnormal disconnects cannot be distinguished from end-of-capture in recorded input",
    )
  }

  let format: "sse" | "ndjson"
  let stream: AsyncGenerator<Uint8Array> = tapped()
  if (mime === "text/event-stream") format = "sse"
  else if (mime === "application/x-ndjson") format = "ndjson"
  else ({ format, replay: stream } = await sniffFormat(stream))
  if (format === "ndjson") {
    v.markSkipped("AGUI501", "the stream is NDJSON; there is no SSE framing to check")
  }

  let eventCount = 0
  let runOpen = false
  let openRunId: string | null = null
  const feedRaw = (raw: string): void => {
    eventCount += 1
    const diags = v.feed(raw)
    try {
      const parsed = JSON.parse(raw) as { type?: unknown; runId?: unknown }
      if (parsed?.type === "RUN_STARTED") {
        runOpen = true
        openRunId = typeof parsed.runId === "string" ? parsed.runId : null
      } else if (parsed?.type === "RUN_FINISHED" || parsed?.type === "RUN_ERROR") {
        runOpen = false
      }
    } catch {
      // unparseable payloads are already AGUI502 diagnostics from the core
    }
    opts.onEvent?.(raw, diags)
    if (opts.onDiagnostic !== undefined) for (const d of diags) opts.onDiagnostic(d)
  }

  let transportError: string | undefined
  try {
    if (format === "sse") {
      for await (const item of sseItems(stream)) {
        if (item.kind === "event") feedRaw(item.data)
        else if (item.kind === "problem") emitTransport("AGUI501", { detail: item.detail })
      }
    } else {
      for await (const line of ndjsonLines(stream)) feedRaw(line)
    }
  } catch (e) {
    if (recorded) {
      // A read failure on a recording is a broken input, not an observation
      // about the agent's transport behavior.
      throw e instanceof TransportError
        ? e
        : new TransportError(
            `failed to read recorded input: ${e instanceof Error ? e.message : String(e)}`,
          )
    }
    transportError = e instanceof Error ? e.message : String(e)
    if (runOpen) {
      // The connection died mid-run. The core's finalize will additionally
      // report the run (and any open streams) as unterminated — both are true
      // statements about the observed stream.
      emitTransport("AGUI508", { runId: openRunId ?? "(unknown)" })
    }
  }

  if (!recorded) {
    if (lastArrival !== null) maxGapMs = Math.max(maxGapMs, now() - lastArrival)
    if (maxGapMs > keepaliveWindow) {
      emitTransport("AGUI506", { seconds: Math.round(maxGapMs / 1000) })
    }
    if (chunkCount === 1 && eventCount >= 3) {
      emitTransport("AGUI507", { detail: `entire body (${eventCount} events) arrived in a single chunk` })
    }
  }

  const finalDiags = v.finalize()
  if (opts.onDiagnostic !== undefined) for (const d of finalDiags) opts.onDiagnostic(d)

  const result: TransportResult = {
    report: v.report(),
    status: null,
    contentType,
    eventCount,
  }
  if (transportError !== undefined) result.transportError = transportError
  return result
}

export async function validateEndpoint(
  url: string,
  opts: TransportOptions = {},
): Promise<TransportResult> {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as FetchLike | undefined)
  if (fetchImpl === undefined) {
    throw new TransportError("no fetch implementation available; pass fetchImpl")
  }

  const method = opts.method ?? "POST"
  const headers: Record<string, string> = {
    accept: "text/event-stream, application/x-ndjson",
    ...(method === "POST" ? { "content-type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  }

  const controller = new AbortController()
  const timers: ReturnType<typeof setTimeout>[] = []
  if (opts.timeoutMs !== undefined) {
    timers.push(
      setTimeout(
        () => controller.abort(new TransportError(`timed out after ${opts.timeoutMs}ms`)),
        opts.timeoutMs,
      ),
    )
  }
  opts.signal?.addEventListener("abort", () => controller.abort(opts.signal?.reason), { once: true })

  try {
    let res: TransportResponseLike
    try {
      const init: TransportRequestInit = { method, headers, signal: controller.signal }
      if (method === "POST") init.body = JSON.stringify(opts.input ?? defaultRunAgentInput())
      res = await fetchImpl(url, init)
    } catch (e) {
      throw e instanceof TransportError
        ? e
        : new TransportError(`request failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    if (res.status < 200 || res.status >= 300) {
      throw new TransportError(`endpoint responded with HTTP ${res.status}`, res.status)
    }
    if (res.body === null) throw new TransportError("response has no body", res.status)
    const contentType = res.headers.get("content-type") ?? ""
    const result = await validateBody(res.body, contentType, opts)
    return { ...result, status: res.status }
  } finally {
    for (const timer of timers) clearTimeout(timer)
  }
}
