# AGUI208 — parentMessageId references unknown message

<!-- Generated from spec/catalog.json by js/scripts/generate-rule-docs.mjs.
     Do not edit by hand; run `npm run docs:generate`. -->

**Severity:** info · **Group:** Tool calls · **Checked in:** core · **Since:** 0.x

**Message:** `TOOL_CALL_START parentMessageId '{parentMessageId}' matches no message observed in this stream`

## Spec grounding

> The optional parentMessageId allows linking the tool call to a specific message in the conversation, providing context for why the tool is being used.

Source: <https://docs.ag-ui.com/concepts/events#toolcallstart>

The spec is not fully explicit here; the ambiguity is tracked as
[SQ-11](../spec-questions.md) and the severity is capped
accordingly (false positives are worse than false negatives).

## Example

A violating stream from the corpus ([`spec/fixtures/invalid/AGUI208-unknown-parent-message-id`](../../spec/fixtures/invalid/AGUI208-unknown-parent-message-id)):

```jsonl
{"type":"RUN_STARTED","threadId":"thread_001","runId":"run_001","timestamp":1755300015900}
{"type":"TOOL_CALL_START","toolCallId":"call_001","toolCallName":"get_weather","parentMessageId":"msg_ghost","timestamp":1755300016000}
{"type":"TOOL_CALL_END","toolCallId":"call_001","timestamp":1755300016100}
{"type":"RUN_FINISHED","threadId":"thread_001","runId":"run_001","outcome":{"type":"success"},"timestamp":1755300016200}
```

Expected findings:

- `info` AGUI208 at event 1 — TOOL_CALL_START parentMessageId 'msg_ghost' matches no message observed in this stream
