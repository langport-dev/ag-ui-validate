"""Minimal RFC 6902 (JSON Patch) + RFC 6901 (JSON Pointer) implementation.
Hand-rolled so the core keeps zero runtime dependencies. Immutable: the
input document is never mutated; ops apply atomically (all or none).
Mirrors js/src/protocol/jsonpatch.ts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, List, Optional, Union

_OPS = {"add", "remove", "replace", "move", "copy", "test"}
_ARRAY_INDEX_RE = re.compile(r"^(0|[1-9]\d*)$")


@dataclass
class PatchOk:
    result: Any


@dataclass
class PatchErr:
    error: str
    op_index: int


PatchResult = Union[PatchOk, PatchErr]


@dataclass
class PatchShapeProblem:
    """Structural problem found while validating a patch document."""

    error: str
    # Index of the offending op, or -1 when the document itself is not an array.
    op_index: int
    # RFC 6901 pointer into the patch document, e.g. "/0/op".
    pointer: str


def parse_pointer(pointer: Any) -> Optional[List[str]]:
    """RFC 6901: "" -> whole document; "/a/b" -> ["a", "b"]. None when invalid."""
    if not isinstance(pointer, str):
        return None
    if pointer == "":
        return []
    if not pointer.startswith("/"):
        return None
    return [t.replace("~1", "/").replace("~0", "~") for t in pointer[1:].split("/")]


def validate_patch_shape(patch: Any) -> Optional[PatchShapeProblem]:
    """Structural validation of a patch document, without applying it."""
    if not isinstance(patch, list):
        return PatchShapeProblem(
            error="patch document must be an array of operations", op_index=-1, pointer=""
        )
    for i, op in enumerate(patch):
        if not isinstance(op, dict):
            return PatchShapeProblem(error=f"operation {i} is not an object", op_index=i, pointer=f"/{i}")
        if op.get("op") not in _OPS:
            return PatchShapeProblem(
                error=f"operation {i} has invalid op '{op.get('op')}'", op_index=i, pointer=f"/{i}/op"
            )
        if parse_pointer(op.get("path")) is None:
            return PatchShapeProblem(
                error=f"operation {i} ({op.get('op')}) has invalid path", op_index=i, pointer=f"/{i}/path"
            )
        if op["op"] in ("add", "replace", "test") and "value" not in op:
            return PatchShapeProblem(
                error=f"operation {i} ({op['op']}) is missing value", op_index=i, pointer=f"/{i}"
            )
        if op["op"] in ("move", "copy") and parse_pointer(op.get("from")) is None:
            return PatchShapeProblem(
                error=f"operation {i} ({op['op']}) is missing or has invalid from",
                op_index=i,
                pointer=f"/{i}",
            )
    return None


def _clone(value: Any) -> Any:
    if isinstance(value, list):
        return [_clone(v) for v in value]
    if isinstance(value, dict):
        return {k: _clone(v) for k, v in value.items()}
    return value


def _deep_equal(a: Any, b: Any) -> bool:
    # bool is a subclass of int in Python (True == 1), but JS's === treats
    # booleans and numbers as distinct — guard that explicitly.
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_deep_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(_deep_equal(a[k], b[k]) for k in a)
    if isinstance(a, (list, dict)) or isinstance(b, (list, dict)):
        return False
    return a == b


def _array_index(token: str, length: int, allow_append: bool) -> Optional[int]:
    if allow_append and token == "-":
        return length
    if not _ARRAY_INDEX_RE.match(token):
        return None
    i = int(token)
    return None if i > length else i


@dataclass
class _Located:
    parent: Any  # dict | list | None (None -> the document root itself)
    key: Union[str, int]
    exists: bool
    value: Any


def _locate(doc: Any, tokens: List[str], for_add: bool) -> Union[_Located, str]:
    if len(tokens) == 0:
        return _Located(parent=None, key="", exists=True, value=doc)
    current = doc
    for token in tokens[:-1]:
        if isinstance(current, list):
            idx = _array_index(token, len(current), False)
            if idx is None or idx >= len(current):
                return f"path segment '/{token}' does not exist"
            current = current[idx]
        elif isinstance(current, dict):
            if token not in current:
                return f"path segment '/{token}' does not exist"
            current = current[token]
        else:
            return f"path segment '/{token}' is not an object or array"
    last = tokens[-1]
    if isinstance(current, list):
        idx = _array_index(last, len(current), for_add)
        if idx is None:
            return f"'{last}' is not a valid index for an array of length {len(current)}"
        return _Located(parent=current, key=idx, exists=idx < len(current), value=current[idx] if idx < len(current) else None)
    if isinstance(current, dict):
        return _Located(parent=current, key=last, exists=last in current, value=current.get(last))
    return f"target of '/{last}' is not an object or array"


def apply_patch(doc: Any, patch: Any) -> PatchResult:
    """Applies an RFC 6902 patch. Validates shape first; never raises."""
    shape = validate_patch_shape(patch)
    if shape is not None:
        return PatchErr(error=shape.error, op_index=shape.op_index)

    # `result` is captured by reference in the nested helpers below (mirrors
    # the TS closure's mutable outer `result` variable) via a one-item list.
    result_box = [_clone(doc)]
    ops = patch

    def get_at(pointer: str):
        loc = _locate(result_box[0], parse_pointer(pointer), False)
        if isinstance(loc, str):
            return None, f"{pointer}: {loc}"
        if not loc.exists:
            return None, f"{pointer} does not exist"
        return loc.value, None

    def set_at(pointer: str, value: Any, must_exist: bool) -> Optional[str]:
        tokens = parse_pointer(pointer)
        if len(tokens) == 0:
            result_box[0] = value
            return None
        loc = _locate(result_box[0], tokens, not must_exist)
        if isinstance(loc, str):
            return f"{pointer}: {loc}"
        if must_exist and not loc.exists:
            return f"{pointer} does not exist"
        if isinstance(loc.parent, list):
            if must_exist:
                loc.parent[loc.key] = value
            else:
                loc.parent.insert(loc.key, value)
        else:
            loc.parent[loc.key] = value
        return None

    def remove_at(pointer: str):
        tokens = parse_pointer(pointer)
        if len(tokens) == 0:
            return None, "cannot remove the whole document"
        loc = _locate(result_box[0], tokens, False)
        if isinstance(loc, str):
            return None, f"{pointer}: {loc}"
        if not loc.exists:
            return None, f"{pointer} does not exist"
        if isinstance(loc.parent, list):
            del loc.parent[loc.key]
        else:
            del loc.parent[loc.key]
        return loc.value, None

    for i, op in enumerate(ops):
        path = op["path"]
        error: Optional[str] = None
        kind = op["op"]

        if kind == "add":
            error = set_at(path, _clone(op["value"]), False)
        elif kind == "replace":
            error = set_at(path, _clone(op["value"]), True)
        elif kind == "remove":
            _, error = remove_at(path)
        elif kind == "move":
            from_ = op["from"]
            if path.startswith(f"{from_}/"):
                error = f"cannot move {from_} into its own child {path}"
            else:
                removed, error = remove_at(from_)
                if error is None:
                    error = set_at(path, removed, False)
        elif kind == "copy":
            value, error = get_at(op["from"])
            if error is None:
                error = set_at(path, _clone(value), False)
        elif kind == "test":
            value, error = get_at(path)
            if error is None and not _deep_equal(value, op["value"]):
                error = f"test failed at {path}"

        if error is not None:
            return PatchErr(error=error, op_index=i)

    return PatchOk(result=result_box[0])


def escape_pointer_token(token: str) -> str:
    """RFC 6901 token escaping, for building diagnostic pointers."""
    return token.replace("~", "~0").replace("/", "~1")
