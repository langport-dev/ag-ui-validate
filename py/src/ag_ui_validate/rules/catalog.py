"""Typed loader for the rule catalog. The catalog itself is data
(catalog.json) so other implementations can share it; this module gives it
types and validates its invariants once at load time.

Note the asymmetry: the validator never throws on stream input, but a
malformed catalog is a programming error in this package, so the loader
raises loudly at import time.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Set, Tuple

Severity = Literal["error", "warning", "info"]
SeverityOrOff = Literal["error", "warning", "info", "off"]

_SEVERITIES = {"error", "warning", "info"}
_LAYERS = {"core", "transport"}
_CATEGORIES = {"lifecycle", "text", "toolcall", "state", "reasoning", "transport", "hygiene"}
_ID_RE = re.compile(r"^AGUI\d{3}$")
_PLACEHOLDER_RE = re.compile(r"\{(\w+)\}")


@dataclass(frozen=True)
class RuleDefinition:
    id: str
    severity: str
    title: str
    # Which part of the protocol this rule governs, e.g. "toolcall".
    category: str
    # Human template with {placeholder} slots filled per diagnostic.
    message_template: str
    # Governing spec section. Mandatory: rules that cannot cite one don't ship.
    spec_url: str
    since: str
    # Where the rule is evaluated. Transport rules are skipped (and the skip
    # reported) when validating recorded input with no transport in play.
    checked_in: str
    # Exact sentence from the spec section, where one exists.
    spec_quote: Optional[str] = None
    # Canonical AG-UI feature this rule relates to, if any.
    feature: Optional[str] = None
    # True when the rule only fires if opts.features declares `feature`.
    requires_feature: bool = False
    # Cross-reference into docs/spec-questions.md for downgraded/ambiguous rules.
    spec_question: Optional[str] = None


@dataclass(frozen=True)
class Catalog:
    catalog_version: str
    spec: str
    rules: Tuple[RuleDefinition, ...]


def _rule_from_json(data: Dict[str, Any]) -> RuleDefinition:
    return RuleDefinition(
        id=data.get("id") or "",
        severity=data.get("severity") or "",
        title=data.get("title") or "",
        category=data.get("category") or "",
        message_template=data.get("messageTemplate") or "",
        spec_url=data.get("specUrl") or "",
        since=data.get("since") or "",
        checked_in=data.get("checkedIn") or "",
        spec_quote=data.get("specQuote"),
        feature=data.get("feature"),
        requires_feature=bool(data.get("requiresFeature", False)),
        spec_question=data.get("specQuestion"),
    )


def validate_catalog(data: Any) -> Catalog:
    """Validates catalog data and returns it typed. Raises on structural problems."""
    if not isinstance(data, dict) or not isinstance(data.get("rules"), list):
        raise ValueError("rule catalog: expected an object with a rules array")

    problems: List[str] = []
    seen: Set[str] = set()
    rules = []
    for raw in data["rules"]:
        rule = _rule_from_json(raw)
        where = rule.id or "<missing id>"
        if not _ID_RE.match(rule.id):
            problems.append(f"{where}: id must match AGUI###")
        if rule.id in seen:
            problems.append(f"{where}: duplicate id")
        seen.add(rule.id)
        if rule.severity not in _SEVERITIES:
            problems.append(f"{where}: bad severity '{rule.severity}'")
        if not rule.title:
            problems.append(f"{where}: missing title")
        if rule.category not in _CATEGORIES:
            problems.append(f"{where}: bad category '{rule.category}'")
        if not rule.message_template:
            problems.append(f"{where}: missing messageTemplate")
        if not rule.spec_url.startswith("https://"):
            problems.append(f"{where}: specUrl must be an https URL")
        if not rule.since:
            problems.append(f"{where}: missing since")
        if rule.checked_in not in _LAYERS:
            problems.append(f"{where}: bad checkedIn '{rule.checked_in}'")
        if rule.requires_feature and not rule.feature:
            problems.append(f"{where}: requiresFeature without feature")
        rules.append(rule)

    if problems:
        joined = "\n  ".join(problems)
        raise ValueError(f"rule catalog is invalid:\n  {joined}")

    return Catalog(
        catalog_version=data.get("catalogVersion") or "",
        spec=data.get("spec") or "",
        rules=tuple(rules),
    )


def _find_spec_dir() -> Any:
    """Locate the shared spec/ directory: the packaged copy (force-included
    into the wheel via pyproject.toml) for real installs, or the repo-root
    one for editable installs — hatchling's editable mode points straight at
    `src/ag_ui_validate` without materializing force-include, so the packaged
    path doesn't exist until a real wheel is built.

    Return type is Any rather than the precise
    importlib.resources.abc.Traversable | pathlib.Path union: both support
    the `/` and `.is_dir()`/`.read_text()` calls used on the result, but
    aren't related by a common typed protocol worth spelling out here.
    """
    packaged = resources.files("ag_ui_validate") / "spec"
    if packaged.is_dir():
        return packaged
    dev_spec = Path(__file__).resolve().parents[4] / "spec"
    if dev_spec.is_dir():
        return dev_spec
    raise FileNotFoundError(
        "could not locate spec/ (checked the packaged resource and the repo-relative dev path)"
    )


def _load_catalog_json() -> Any:
    return json.loads((_find_spec_dir() / "catalog.json").read_text())


CATALOG: Catalog = validate_catalog(_load_catalog_json())

RULES: Dict[str, RuleDefinition] = {r.id: r for r in CATALOG.rules}


def format_message(rule: RuleDefinition, params: Dict[str, Any]) -> str:
    """Fills a rule's messageTemplate. Unknown placeholders are left intact."""

    def repl(m: "re.Match[str]") -> str:
        key = m.group(1)
        return str(params[key]) if key in params else m.group(0)

    return _PLACEHOLDER_RE.sub(repl, rule.message_template)
