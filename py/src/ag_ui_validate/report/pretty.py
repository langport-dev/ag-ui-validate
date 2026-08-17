"""Human-readable output. Pure string formatting - the CLI decides where it
goes and whether a TTY wants color. Mirrors src/report/pretty.ts.
"""

from __future__ import annotations

from typing import Dict, List

from ..rules.catalog import RULES
from ..types import Diagnostic, Report

_SYMBOL: Dict[str, str] = {"error": "✖", "warning": "⚠", "info": "ℹ"}
_SGR: Dict[str, str] = {"error": "31", "warning": "33", "info": "36"}
_SEVERITY_RANK: Dict[str, int] = {"error": 0, "warning": 1, "info": 2}
_SAMPLE_INDEXES = 3


def _paint(code: str, s: str, on: bool) -> str:
    return f"\x1b[{code}m{s}\x1b[0m" if on else s


def format_diagnostic_line(d: Diagnostic, color: bool) -> str:
    where = f"event {d.event_index}" if d.event_index >= 0 else "—"
    head = _paint(_SGR[d.severity], f"{_SYMBOL[d.severity]} {d.rule}", color)
    meta = _paint("2", f"{d.severity.ljust(7)} {where.ljust(10)}", color)
    cite = _paint("2", f"  ↳ {d.spec_url}", color)
    return f"{head}  {meta} {d.message}\n{cite}"


def _count(n: int, noun: str) -> str:
    return f"{n} {noun}{'' if n == 1 else 's'}"


def format_grouped_diagnostics(diagnostics: List[Diagnostic], color: bool) -> str:
    """One line per rule instead of one per occurrence - for large streams
    where the same violation repeats. Totals stay honest in the summary;
    this only changes what is listed."""
    groups: Dict[str, List[Diagnostic]] = {}
    for d in diagnostics:
        groups.setdefault(d.rule, []).append(d)

    sorted_groups = sorted(
        groups.values(), key=lambda g: (_SEVERITY_RANK[g[0].severity], g[0].rule)
    )

    lines: List[str] = []
    for group in sorted_groups:
        first = group[0]
        catalog = RULES.get(first.rule)
        title = catalog.title if catalog is not None else first.message
        indexes = [d.event_index for d in group if d.event_index >= 0]
        if not indexes:
            where = "stream-level"
        else:
            sample = ", ".join(str(i) for i in indexes[:_SAMPLE_INDEXES])
            rest = len(indexes) - _SAMPLE_INDEXES
            where = f"events {sample}{f' (+{rest} more)' if rest > 0 else ''}"
        head = _paint(_SGR[first.severity], f"{_SYMBOL[first.severity]} {first.rule}", color)
        meta = _paint("2", f"{first.severity.ljust(7)} ×{len(group)}", color)
        cite = _paint("2", f"  ↳ {first.spec_url}", color)
        lines.append(f"{head}  {meta}  {title} — {where}")
        lines.append(cite)
    return "\n".join(lines)


def format_report_summary(report: Report, color: bool) -> str:
    errors, warnings, info = report.summary.errors, report.summary.warnings, report.summary.info
    lines: List[str] = []

    if errors + warnings + info == 0:
        lines.append(
            _paint("32", f"✔ no conformance violations across {_count(report.event_count, 'event')}", color)
        )
    else:
        lines.append(
            f"{_count(errors, 'error')}, {_count(warnings, 'warning')}, {info} info across "
            f"{_count(report.event_count, 'event')}"
        )

    features = list(report.features.items())
    exercised = [f for f, s in features if s == "exercised"]
    suffix = f": {', '.join(exercised)}" if exercised else ""
    lines.append(f"{len(exercised)} of {len(features)} AG-UI features exercised{suffix}")

    if report.skipped:
        lines.append(f"{_count(len(report.skipped), 'rule')} not evaluated:")
        for s in report.skipped:
            lines.append(_paint("2", f"  – {s.rule}: {s.reason}", color))

    for e in report.internal_errors:
        lines.append(_paint("31", f"! internal validator error: {e}", color))

    return "\n".join(lines)
