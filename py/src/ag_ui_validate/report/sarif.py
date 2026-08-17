"""SARIF 2.1.0 output for code-scanning integrations (e.g. GitHub).
Level mapping: error->error, warning->warning, info->note. When the input was
a line-oriented file (JSONL/captured SSE fed line-per-event is not
guaranteed, so only the caller knows), event N is reported at line N+1 via
artifact_uri. Mirrors src/report/sarif.ts.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..rules.catalog import RULES
from ..types import Report

_LEVEL: Dict[str, str] = {"error": "error", "warning": "warning", "info": "note"}


def to_sarif(report: Report, tool_version: str, artifact_uri: Optional[str] = None) -> Dict[str, Any]:
    rules: Dict[str, Dict[str, Any]] = {}
    for d in report.diagnostics:
        if d.rule in rules:
            continue
        entry: Dict[str, Any] = {"id": d.rule, "helpUri": d.spec_url}
        catalog = RULES.get(d.rule)
        if catalog is not None:
            entry["shortDescription"] = {"text": catalog.title}
            entry["defaultConfiguration"] = {"level": _LEVEL[catalog.severity]}
        rules[d.rule] = entry

    results = []
    for d in report.diagnostics:
        locations = []
        if artifact_uri is not None and d.event_index >= 0:
            locations.append(
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": artifact_uri},
                        "region": {"startLine": d.event_index + 1},
                    }
                }
            )
        results.append(
            {
                "ruleId": d.rule,
                "level": _LEVEL[d.severity],
                "message": {"text": d.message},
                "locations": locations,
            }
        )

    return {
        "$schema": "https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "ag-ui-validate",
                        "version": tool_version,
                        "informationUri": "https://github.com/langport-dev/ag-ui-validate",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
            }
        ],
    }
