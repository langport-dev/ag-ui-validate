# Rule index

<!-- Generated from spec/catalog.json by scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

All 46 conformance rules, grouped by the part of the
protocol they guard. Every diagnostic links to the spec section it is
grounded in; ambiguous spec behavior is capped at `info` severity and
tracked in [spec-questions.md](../spec-questions.md).

## Lifecycle

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI001](AGUI001.md) | error | core | Run does not start with RUN_STARTED |
| [AGUI002](AGUI002.md) | error | core | Multiple RUN_STARTED in one run |
| [AGUI003](AGUI003.md) | error | core | Run not terminated |
| [AGUI004](AGUI004.md) | error | core | Event after terminal event |
| [AGUI005](AGUI005.md) | error | core | RUN_FINISHED and RUN_ERROR are mutually exclusive |
| [AGUI006](AGUI006.md) | error | core | STEP_FINISHED without matching STEP_STARTED |
| [AGUI007](AGUI007.md) | error | core | Step unterminated at run end |
| [AGUI008](AGUI008.md) | warning | core | Unstable threadId/runId across the run |

## Text messages

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI101](AGUI101.md) | error | core | TEXT_MESSAGE_CONTENT without start |
| [AGUI102](AGUI102.md) | error | core | TEXT_MESSAGE_END without start |
| [AGUI103](AGUI103.md) | error | core | Text message unterminated at run end |
| [AGUI104](AGUI104.md) | error | core | Duplicate messageId within a run |
| [AGUI105](AGUI105.md) | warning | core | Empty content delta |
| [AGUI106](AGUI106.md) | error | core | Interleaved message streams sharing a messageId |

## Tool calls

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI201](AGUI201.md) | error | core | TOOL_CALL_ARGS without start |
| [AGUI202](AGUI202.md) | error | core | TOOL_CALL_END without start |
| [AGUI203](AGUI203.md) | error | core | Unterminated tool call |
| [AGUI204](AGUI204.md) | error | core | Tool call arguments are not valid JSON |
| [AGUI205](AGUI205.md) | error | core | Duplicate toolCallId within a run |
| [AGUI206](AGUI206.md) | warning | core | TOOL_CALL_RESULT before TOOL_CALL_END |
| [AGUI207](AGUI207.md) | error | core | TOOL_CALL_RESULT references unknown toolCallId |
| [AGUI208](AGUI208.md) | info | core | parentMessageId references unknown message |

## State

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI301](AGUI301.md) | info | core | STATE_DELTA before any STATE_SNAPSHOT |
| [AGUI302](AGUI302.md) | error | core | STATE_DELTA failed to apply |
| [AGUI303](AGUI303.md) | error | core | STATE_DELTA is not a valid RFC 6902 patch document |
| [AGUI304](AGUI304.md) | info | core | Mid-run STATE_SNAPSHOT discards accumulated deltas |
| [AGUI305](AGUI305.md) | warning | core | Shared state declared but never established |

## Reasoning

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI401](AGUI401.md) | error | core | REASONING_MESSAGE_CONTENT without start |
| [AGUI402](AGUI402.md) | warning | core | Reasoning unterminated at run end |

## Subagents

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI601](AGUI601.md) | error | core | Duplicate SUBAGENT_STARTED for a subagentRunId |
| [AGUI602](AGUI602.md) | error | core | SUBAGENT_FINISHED without matching SUBAGENT_STARTED |
| [AGUI603](AGUI603.md) | error | core | SUBAGENT_ERROR without matching SUBAGENT_STARTED |
| [AGUI604](AGUI604.md) | error | core | Subagent unterminated at run end |
| [AGUI605](AGUI605.md) | warning | core | parentSubagentRunId references a subagent never started |
| [AGUI606](AGUI606.md) | warning | core | Continuation event's subagentRunId disagrees with its entity's owner |

## Transport

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI501](AGUI501.md) | error | transport | Malformed SSE framing |
| [AGUI502](AGUI502.md) | error | core | Event payload is not valid JSON |
| [AGUI503](AGUI503.md) | error | core | Unknown event type |
| [AGUI504](AGUI504.md) | error | core | Event fails schema validation for its declared type |
| [AGUI505](AGUI505.md) | warning | transport | Unexpected Content-Type |
| [AGUI506](AGUI506.md) | info | transport | No keepalive frame within the configured window |
| [AGUI507](AGUI507.md) | info | transport | Response appears buffered rather than incrementally flushed |
| [AGUI508](AGUI508.md) | error | transport | Stream ended without a terminal event |

## Protocol hygiene

| Rule | Severity | Layer | Title |
|---|---|---|---|
| [AGUI901](AGUI901.md) | info | core | RAW event wraps a typed AG-UI event |
| [AGUI902](AGUI902.md) | info | core | Events carry no timestamps |
| [AGUI903](AGUI903.md) | info | core | CUSTOM event name is not namespaced |
