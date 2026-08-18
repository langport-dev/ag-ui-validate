"""Core public types. Mirrors src/types.ts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Literal, Optional, Tuple

from .rules.catalog import Severity, SeverityOrOff

__all__ = [
    "Severity",
    "SeverityOrOff",
    "Diagnostic",
    "CanonicalFeature",
    "CANONICAL_FEATURES",
    "FeatureStatus",
    "FeatureMatrix",
    "Summary",
    "SkippedRule",
    "Report",
    "ValidationLayer",
    "ValidatorOptions",
]


@dataclass
class Diagnostic:
    """A single conformance finding."""

    rule: str
    severity: str
    message: str
    # 0-based position in the stream of the event this diagnostic is about.
    # Stream-level diagnostics (e.g. AGUI902) use -1.
    event_index: int
    # Link to the governing spec section. Always populated.
    spec_url: str
    # The event's declared type, if parseable.
    event_type: Optional[str] = None
    # RFC 6901 JSON pointer into the event, e.g. "/toolCallId".
    pointer: Optional[str] = None
    # e.g. the unterminated TOOL_CALL_START this refers back to.
    related_event_index: Optional[int] = None


# The seven canonical AG-UI features (from the AG-UI Dojo).
CanonicalFeature = Literal[
    "agentic-chat",
    "backend-tool-rendering",
    "human-in-the-loop",
    "agentic-generative-ui",
    "tool-based-generative-ui",
    "shared-state",
    "predictive-state-updates",
]

CANONICAL_FEATURES: Tuple[CanonicalFeature, ...] = (
    "agentic-chat",
    "backend-tool-rendering",
    "human-in-the-loop",
    "agentic-generative-ui",
    "tool-based-generative-ui",
    "shared-state",
    "predictive-state-updates",
)

# Feature-matrix status. Capability discovery (getCapabilities()) is
# out-of-band and invisible to a passive stream observer, so this matrix is
# inferred from observed events; features whose exercise cannot be
# distinguished passively are "not-inferable". See docs/spec-questions.md SQ-13.
FeatureStatus = Literal["exercised", "not-exercised", "not-inferable"]

FeatureMatrix = Dict[str, str]


@dataclass
class Summary:
    errors: int = 0
    warnings: int = 0
    info: int = 0


@dataclass
class SkippedRule:
    rule: str
    reason: str


@dataclass
class Report:
    diagnostics: List[Diagnostic]
    summary: Summary
    features: FeatureMatrix
    # Rules that were not evaluated in this mode and why — e.g. transport
    # rules when validating recorded input. Skips are reported, never silent.
    skipped: List[SkippedRule]
    event_count: int
    # Unexpected internal validator errors. The validator never throws on any
    # input; if a check itself crashes, the message lands here instead.
    internal_errors: List[str]


ValidationLayer = Literal["core", "transport"]


@dataclass
class ValidatorOptions:
    # Pins the rule set to a spec version. Only "0.x" exists today.
    spec: Optional[str] = None
    # Declared features. Enables feature-conditional rules (e.g. AGUI305
    # fires only when "shared-state" is declared).
    features: Optional[List[str]] = None
    # Per-rule severity overrides; "off" disables a rule.
    severity_overrides: Optional[Dict[str, str]] = None
    # Which rule layers are being evaluated. "core" is always on. Wrapping
    # layers that check transport rules (via emit_external) declare
    # "transport" so those rules stop being reported as skipped. Default: ["core"].
    layers: Optional[List[str]] = None
