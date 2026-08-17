"""AUTO-GENERATED from ag-ui-protocol v0.1.20 — do not edit by hand.
Regenerate with: python py/scripts/generate_event_table.py
tests/test_protocol_drift.py fails if this file drifts from the installed SDK.
"""

from __future__ import annotations

from typing import Any

# FieldKind: "string" | "number" | "boolean" | "object" | "array" | "any"
# EventCategory: "lifecycle" | "text" | "toolcall" | "state" | "activity"
#                | "reasoning" | "thinking" | "special"
# FieldSpec: {"kind": FieldKind, "required": bool, "enum": list[str] (optional)}
# EventSpec: {"category": EventCategory, "deprecated": str (optional),
#              "specUrl": str, "fields": dict[str, FieldSpec]}

SDK_VERSION = '0.1.20'

EVENT_TABLE: dict[str, dict[str, Any]] = {
    'TEXT_MESSAGE_START': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagestart',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": False, "enum": ['developer', 'system', 'assistant', 'user']},
            'name': {"kind": 'string', "required": False},
        },
    },
    'TEXT_MESSAGE_CONTENT': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagecontent',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
        },
    },
    'TEXT_MESSAGE_END': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessageend',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
        },
    },
    'TEXT_MESSAGE_CHUNK': {
        "category": 'text',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#textmessagechunk',
        "fields": {
            'messageId': {"kind": 'string', "required": False},
            'role': {"kind": 'string', "required": False, "enum": ['developer', 'system', 'assistant', 'user']},
            'delta': {"kind": 'string', "required": False},
            'name': {"kind": 'string', "required": False},
        },
    },
    'THINKING_TEXT_MESSAGE_START': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_START',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
        },
    },
    'THINKING_TEXT_MESSAGE_CONTENT': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_CONTENT',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'delta': {"kind": 'string', "required": True},
        },
    },
    'THINKING_TEXT_MESSAGE_END': {
        "category": 'thinking',
        "deprecated": 'REASONING_MESSAGE_END',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
        },
    },
    'TOOL_CALL_START': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallstart',
        "fields": {
            'toolCallId': {"kind": 'string', "required": True},
            'toolCallName': {"kind": 'string', "required": True},
            'parentMessageId': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_ARGS': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallargs',
        "fields": {
            'toolCallId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
        },
    },
    'TOOL_CALL_END': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallend',
        "fields": {
            'toolCallId': {"kind": 'string', "required": True},
        },
    },
    'TOOL_CALL_CHUNK': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallchunk',
        "fields": {
            'toolCallId': {"kind": 'string', "required": False},
            'toolCallName': {"kind": 'string', "required": False},
            'parentMessageId': {"kind": 'string', "required": False},
            'delta': {"kind": 'string', "required": False},
        },
    },
    'TOOL_CALL_RESULT': {
        "category": 'toolcall',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#toolcallresult',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'toolCallId': {"kind": 'string', "required": True},
            'content': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": False, "enum": ['tool']},
        },
    },
    'THINKING_START': {
        "category": 'thinking',
        "deprecated": 'REASONING_START',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
            'title': {"kind": 'string', "required": False},
        },
    },
    'THINKING_END': {
        "category": 'thinking',
        "deprecated": 'REASONING_END',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#thinking-events-deprecated',
        "fields": {
        },
    },
    'STATE_SNAPSHOT': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#statesnapshot',
        "fields": {
            'snapshot': {"kind": 'any', "required": True},
        },
    },
    'STATE_DELTA': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#statedelta',
        "fields": {
            'delta': {"kind": 'array', "required": True},
        },
    },
    'MESSAGES_SNAPSHOT': {
        "category": 'state',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#messagessnapshot',
        "fields": {
            'messages': {"kind": 'array', "required": True},
        },
    },
    'ACTIVITY_SNAPSHOT': {
        "category": 'activity',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#activitysnapshot',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'activityType': {"kind": 'string', "required": True},
            'content': {"kind": 'any', "required": True},
            'replace': {"kind": 'boolean', "required": False},
        },
    },
    'ACTIVITY_DELTA': {
        "category": 'activity',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#activitydelta',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'activityType': {"kind": 'string', "required": True},
            'patch': {"kind": 'array', "required": True},
        },
    },
    'RAW': {
        "category": 'special',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#raw',
        "fields": {
            'event': {"kind": 'any', "required": True},
            'source': {"kind": 'string', "required": False},
        },
    },
    'CUSTOM': {
        "category": 'special',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#custom',
        "fields": {
            'name': {"kind": 'string', "required": True},
            'value': {"kind": 'any', "required": True},
        },
    },
    'RUN_STARTED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#runstarted',
        "fields": {
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
            'message': {"kind": 'string', "required": True},
            'code': {"kind": 'string', "required": False},
            'usage': {"kind": 'array', "required": False},
        },
    },
    'STEP_STARTED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#stepstarted',
        "fields": {
            'stepName': {"kind": 'string', "required": True},
        },
    },
    'STEP_FINISHED': {
        "category": 'lifecycle',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#stepfinished',
        "fields": {
            'stepName': {"kind": 'string', "required": True},
        },
    },
    'REASONING_START': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningstart',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
        },
    },
    'REASONING_MESSAGE_START': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagestart',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'role': {"kind": 'string', "required": True, "enum": ['reasoning']},
        },
    },
    'REASONING_MESSAGE_CONTENT': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagecontent',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
            'delta': {"kind": 'string', "required": True},
        },
    },
    'REASONING_MESSAGE_END': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessageend',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
        },
    },
    'REASONING_MESSAGE_CHUNK': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningmessagechunk',
        "fields": {
            'messageId': {"kind": 'string', "required": False},
            'delta': {"kind": 'string', "required": False},
        },
    },
    'REASONING_END': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningend',
        "fields": {
            'messageId': {"kind": 'string', "required": True},
        },
    },
    'REASONING_ENCRYPTED_VALUE': {
        "category": 'reasoning',
        "specUrl": 'https://docs.ag-ui.com/concepts/events#reasoningencryptedvalue',
        "fields": {
            'subtype': {"kind": 'string', "required": True, "enum": ['tool-call', 'message']},
            'entityId': {"kind": 'string', "required": True},
            'encryptedValue': {"kind": 'string', "required": True},
        },
    },
}

EVENT_TYPES: list[str] = list(EVENT_TABLE.keys())

# Wire types documented as drafts (https://docs.ag-ui.com/drafts/overview) but
# not yet in ag-ui-protocol. Not errors: reported at info severity.
DRAFT_EVENT_TYPES: list[str] = ["META"]
