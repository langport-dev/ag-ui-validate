"""AUTO-GENERATED from ag-ui-protocol v0.1.21 — do not edit by hand.
Regenerate with: python py/scripts/generate_event_table.py
tests/test_protocol_drift.py fails if this file drifts from the installed SDK.
"""

from __future__ import annotations

from typing import Any

# FieldKind: "string" | "number" | "boolean" | "object" | "array" | "any"
# EventCategory: "lifecycle" | "text" | "toolcall" | "state" | "activity"
#                | "reasoning" | "thinking" | "special" | "subagent"
# FieldSpec: {"kind": FieldKind, "required": bool, "enum": list[str] (optional)}
# EventSpec: {"category": EventCategory, "deprecated": str (optional),
#              "specUrl": str, "fields": dict[str, FieldSpec]}

SDK_VERSION = '0.1.21'

EVENT_TABLE: dict[str, dict[str, Any]] = {
    'TEXT_MESSAGE_START': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagestart',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": False, "enum": ['developer', 'system', 'assistant', 'user']},
            'name': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TEXT_MESSAGE_CONTENT': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagecontent',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TEXT_MESSAGE_END': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessageend',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TEXT_MESSAGE_CHUNK': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagechunk',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": False},
            'role': {"kind": 'string', "required": False, "enum": ['developer', 'system', 'assistant', 'user']},
            'delta': {"kind": 'string', "required": False},
            'name': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'THINKING_TEXT_MESSAGE_START': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_START',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
        },
    },
    'THINKING_TEXT_MESSAGE_CONTENT': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_CONTENT',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'delta': {"kind": 'string', "required": True},
        },
    },
    'THINKING_TEXT_MESSAGE_END': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_END',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
        },
    },
    'TOOL_CALL_START': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallstart',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'toolCallId': {"kind": 'string', "required": True},
            'toolCallName': {"kind": 'string', "required": True},
            'parentMessageId': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_ARGS': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallargs',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'toolCallId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_END': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallend',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'toolCallId': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_CHUNK': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallchunk',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'toolCallId': {"kind": 'string', "required": False},
            'toolCallName': {"kind": 'string', "required": False},
            'parentMessageId': {"kind": 'string', "required": False},
            'delta': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_RESULT': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallresult',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'toolCallId': {"kind": 'string', "required": True},
            'content': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": False, "enum": ['tool']},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'THINKING_START': {
        "category": 'thinking',
        "deprecated": 'REASONING_START',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'title': {"kind": 'string', "required": False},
        },
    },
    'THINKING_END': {
        "category": 'thinking',
        "deprecated": 'REASONING_END',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
        },
    },
    'STATE_SNAPSHOT': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#statesnapshot',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'snapshot': {"kind": 'any', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'STATE_DELTA': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#statedelta',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'delta': {"kind": 'array', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'MESSAGES_SNAPSHOT': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#messagessnapshot',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messages': {"kind": 'array', "required": True},
        },
    },
    'ACTIVITY_SNAPSHOT': {
        "category": 'activity',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#activitysnapshot',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'activityType': {"kind": 'string', "required": True},
            'content': {"kind": 'any', "required": True},
            'replace': {"kind": 'boolean', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'ACTIVITY_DELTA': {
        "category": 'activity',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#activitydelta',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'activityType': {"kind": 'string', "required": True},
            'patch': {"kind": 'array', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'RAW': {
        "category": 'special',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#raw',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'event': {"kind": 'any', "required": True},
            'source': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'CUSTOM': {
        "category": 'special',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#custom',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'name': {"kind": 'string', "required": True},
            'value': {"kind": 'any', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'RUN_STARTED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#runstarted',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'threadId': {"kind": 'string', "required": True},
            'runId': {"kind": 'string', "required": True},
            'parentRunId': {"kind": 'string', "required": False},
            'input': {"kind": 'object', "required": False},
        },
    },
    'RUN_FINISHED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#runfinished',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'threadId': {"kind": 'string', "required": True},
            'runId': {"kind": 'string', "required": True},
            'result': {"kind": 'any', "required": False},
            'outcome': {"kind": 'object', "required": False},
            'usage': {"kind": 'array', "required": False},
        },
    },
    'RUN_ERROR': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#runerror',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'message': {"kind": 'string', "required": True},
            'code': {"kind": 'string', "required": False},
            'usage': {"kind": 'array', "required": False},
        },
    },
    'STEP_STARTED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#stepstarted',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'stepName': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'STEP_FINISHED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#stepfinished',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'stepName': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_START': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningstart',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_MESSAGE_START': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagestart',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": True, "enum": ['reasoning']},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_MESSAGE_CONTENT': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagecontent',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_MESSAGE_END': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessageend',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_MESSAGE_CHUNK': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagechunk',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": False},
            'delta': {"kind": 'string', "required": False},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_END': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningend',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'messageId': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'REASONING_ENCRYPTED_VALUE': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningencryptedvalue',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'subtype': {"kind": 'string', "required": True, "enum": ['tool-call', 'message']},
            'entityId': {"kind": 'string', "required": True},
            'encryptedValue': {"kind": 'string', "required": True},
            'subagentRunId': {"kind": 'string', "required": False},
        },
    },
    'SUBAGENT_STARTED': {
        "category": 'subagent',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#subagent-events',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'subagentRunId': {"kind": 'string', "required": True},
            'name': {"kind": 'string', "required": True},
            'description': {"kind": 'string', "required": False},
            'parentSubagentRunId': {"kind": 'string', "required": False},
            'parentToolCallId': {"kind": 'string', "required": False},
            'parentMessageId': {"kind": 'string', "required": False},
        },
    },
    'SUBAGENT_FINISHED': {
        "category": 'subagent',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#subagent-events',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'subagentRunId': {"kind": 'string', "required": True},
            'result': {"kind": 'any', "required": False},
            'outcome': {"kind": 'object', "required": False},
        },
    },
    'SUBAGENT_ERROR': {
        "category": 'subagent',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#subagent-events',
        "fields": {
            'metadata': {"kind": 'object', "required": False},
            'subagentRunId': {"kind": 'string', "required": True},
            'message': {"kind": 'string', "required": True},
            'code': {"kind": 'string', "required": False},
        },
    },
}

EVENT_TYPES: list[str] = list(EVENT_TABLE.keys())

# Wire types documented as drafts (https://docs.ag-ui.com/drafts/overview) but
# not yet in ag-ui-protocol. Not errors: reported at info severity.
DRAFT_EVENT_TYPES: list[str] = ["META"]
