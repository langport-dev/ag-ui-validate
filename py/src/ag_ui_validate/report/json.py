"""Machine-readable report: the core Report plus tool identification, so a
stored document is self-describing. Mirrors src/report/json.ts.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..rules.catalog import RULES
from ..types import Diagnostic, Report


def _diagnostic_to_dict(d: Diagnostic) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "rule": d.rule,
        "severity": d.severity,
        "message": d.message,
        "eventIndex": d.event_index,
    }
    if d.event_type is not None:
        out["eventType"] = d.event_type
    if d.pointer is not None:
        out["pointer"] = d.pointer
    if d.related_event_index is not None:
        out["relatedEventIndex"] = d.related_event_index
    out["specUrl"] = d.spec_url
    catalog = RULES.get(d.rule)
    if catalog is not None:
        out["category"] = catalog.category
    return out


def report_to_dict(report: Report) -> Dict[str, Any]:
    return {
        "diagnostics": [_diagnostic_to_dict(d) for d in report.diagnostics],
        "summary": {
            "errors": report.summary.errors,
            "warnings": report.summary.warnings,
            "info": report.summary.info,
        },
        "features": dict(report.features),
        "skipped": [{"rule": s.rule, "reason": s.reason} for s in report.skipped],
        "eventCount": report.event_count,
        "internalErrors": list(report.internal_errors),
    }


def to_json_report(report: Report, tool: Dict[str, str], target: Optional[str] = None) -> Dict[str, Any]:
    doc: Dict[str, Any] = {"tool": tool, **report_to_dict(report)}
    if target is not None:
        doc["target"] = target
    return doc
