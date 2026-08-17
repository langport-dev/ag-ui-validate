"""Shared derivation logic: turns ag-ui-protocol's pydantic models into the
normalized event table consumed by protocol/event_table.py and the drift
test. Mirrors js/scripts/derive-lib.mjs's zod-walking logic, but over
pydantic v2 FieldInfo/annotations instead of zod's `_def` internals.

Normalized shape, per wire type:
    {"class_name": ..., "fields": {name: {"kind", "required", "enum"?}}}
Base-event fields (type, timestamp, rawEvent) are excluded — they are common
to every event and validated separately.
"""

from __future__ import annotations

import enum
import inspect
import typing

BASE_FIELDS = {"type", "timestamp", "rawEvent"}


def _unwrap_annotated(t):
    # pydantic wraps discriminated-union fields in Annotated[Union[...], FieldInfo(...)].
    while hasattr(t, "__metadata__"):
        t = t.__origin__
    return t


def _strip_optional(t):
    t = _unwrap_annotated(t)
    if typing.get_origin(t) is typing.Union:
        args = [a for a in typing.get_args(t) if a is not type(None)]
        if len(args) == 1:
            return _strip_optional(args[0])
    return t


def _classify(t) -> dict:
    t = _strip_optional(t)
    origin = typing.get_origin(t)

    if origin is typing.Literal:
        values = [v.value if isinstance(v, enum.Enum) else v for v in typing.get_args(t)]
        if all(isinstance(v, str) for v in values):
            return {"kind": "string", "enum": values}
        if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in values):
            return {"kind": "number"}
        return {"kind": "any"}

    if origin in (list, typing.List):
        return {"kind": "array"}

    if origin in (dict, typing.Dict):
        return {"kind": "object"}

    if origin is typing.Union:
        parts = [_classify(a) for a in typing.get_args(t)]
        if all(p["kind"] == "string" and "enum" in p for p in parts):
            merged: list[str] = []
            for p in parts:
                merged.extend(p["enum"])
            return {"kind": "string", "enum": merged}
        kinds = {p["kind"] for p in parts}
        return {"kind": next(iter(kinds))} if len(kinds) == 1 else {"kind": "any"}

    if origin is not None:
        return {"kind": "any"}

    if t is str:
        return {"kind": "string"}
    if t in (int, float):
        return {"kind": "number"}
    if t is bool:
        return {"kind": "boolean"}
    if t is typing.Any or t is type(None):
        return {"kind": "any"}
    if inspect.isclass(t) and issubclass(t, enum.Enum):
        values = [m.value for m in t]
        if all(isinstance(v, str) for v in values):
            return {"kind": "string", "enum": values}
        return {"kind": "any"}
    if inspect.isclass(t):
        return {"kind": "object"}
    return {"kind": "any"}


def field_spec(field_info) -> dict:
    spec = _classify(field_info.annotation)
    ordered = {"kind": spec["kind"], "required": field_info.is_required()}
    if "enum" in spec:
        ordered["enum"] = spec["enum"]
    return ordered


def derive_event_table(events_module, base_event_cls) -> dict:
    """@param events_module the ag_ui.core.events module."""
    table = {}
    for name in dir(events_module):
        cls = getattr(events_module, name)
        is_event = (
            inspect.isclass(cls) and issubclass(cls, base_event_cls) and cls is not base_event_cls
        )
        if not is_event:
            continue
        type_field = cls.model_fields.get("type")
        if type_field is None:
            continue
        type_args = typing.get_args(type_field.annotation)
        if not type_args:
            continue
        wire_type = type_args[0]
        if isinstance(wire_type, enum.Enum):
            wire_type = wire_type.value
        if not isinstance(wire_type, str):
            continue
        fields = {}
        for field_name, info in cls.model_fields.items():
            alias = info.alias or field_name
            if alias in BASE_FIELDS:
                continue
            fields[alias] = field_spec(info)
        table[wire_type] = {"class_name": name, "fields": fields}

    event_types = [e.value for e in events_module.EventType]
    return {"event_types": event_types, "table": table}
