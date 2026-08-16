import { createValidator } from "../src/index.js"
import type { Diagnostic, Report, ValidatorOptions } from "../src/types.js"

/** Feeds all events, finalizes, and returns everything. */
export function validate(
  events: unknown[],
  opts?: ValidatorOptions,
): { diags: Diagnostic[]; report: Report } {
  const v = createValidator(opts)
  const diags: Diagnostic[] = []
  for (const e of events) diags.push(...v.feed(e))
  diags.push(...v.finalize())
  return { diags, report: v.report() }
}

export const rulesOf = (diags: Diagnostic[]): string[] => diags.map((d) => d.rule)

export const only = (diags: Diagnostic[], rule: string): Diagnostic[] =>
  diags.filter((d) => d.rule === rule)

// All helper events carry a timestamp so well-formed fixtures don't trip
// AGUI902 (stream carries no timestamps at all).
const TS = 1755300000000

export const started = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "RUN_STARTED",
  threadId: "thread_1",
  runId: "run_1",
  timestamp: TS,
  ...over,
})

export const finished = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "RUN_FINISHED",
  threadId: "thread_1",
  runId: "run_1",
  timestamp: TS,
  ...over,
})

/** Wraps events in a well-formed run envelope. */
export const inRun = (...events: unknown[]): unknown[] => [started(), ...events, finished()]

export const textMessage = (id = "msg_1", delta = "hello"): unknown[] => [
  { type: "TEXT_MESSAGE_START", messageId: id, role: "assistant", timestamp: TS },
  { type: "TEXT_MESSAGE_CONTENT", messageId: id, delta, timestamp: TS },
  { type: "TEXT_MESSAGE_END", messageId: id, timestamp: TS },
]

export const toolCall = (id = "call_1", name = "get_weather", args = '{"city":"Berlin"}'): unknown[] => [
  { type: "TOOL_CALL_START", toolCallId: id, toolCallName: name, timestamp: TS },
  { type: "TOOL_CALL_ARGS", toolCallId: id, delta: args, timestamp: TS },
  { type: "TOOL_CALL_END", toolCallId: id, timestamp: TS },
]
