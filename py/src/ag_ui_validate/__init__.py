"""ag-ui-validate: conformance validator for the AG-UI protocol.

Native Python port of https://github.com/langport-dev/ag-ui-validate, in
progress — see docs/PYTHON-PORT-PLAN.md in that repository for status. The
TypeScript implementation (``npm install ag-ui-validate``) is the more
complete one today.
"""

from .engine import Validator, create_validator
from .protocol.event_table import DRAFT_EVENT_TYPES, EVENT_TABLE, EVENT_TYPES, SDK_VERSION
from .protocol.jsonpatch import PatchErr, PatchOk, apply_patch, validate_patch_shape
from .rules.catalog import CATALOG, RULES, RuleDefinition, format_message, validate_catalog
from .types import (
    CANONICAL_FEATURES,
    CanonicalFeature,
    Diagnostic,
    FeatureMatrix,
    FeatureStatus,
    Report,
    Severity,
    SeverityOrOff,
    SkippedRule,
    Summary,
    ValidationLayer,
    ValidatorOptions,
)

__version__ = "0.0.1"

__all__ = [
    "Validator",
    "create_validator",
    "DRAFT_EVENT_TYPES",
    "EVENT_TABLE",
    "EVENT_TYPES",
    "SDK_VERSION",
    "PatchErr",
    "PatchOk",
    "apply_patch",
    "validate_patch_shape",
    "CATALOG",
    "RULES",
    "RuleDefinition",
    "format_message",
    "validate_catalog",
    "CANONICAL_FEATURES",
    "CanonicalFeature",
    "Diagnostic",
    "FeatureMatrix",
    "FeatureStatus",
    "Report",
    "Severity",
    "SeverityOrOff",
    "SkippedRule",
    "Summary",
    "ValidationLayer",
    "ValidatorOptions",
]
