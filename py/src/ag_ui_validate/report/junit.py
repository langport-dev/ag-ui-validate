"""JUnit XML output for CI systems. One testcase per finding: errors are
<failure>, warnings and info are <skipped> (visible but not build-breaking -
the exit code, not the XML, decides pass/fail). A clean report is a single
passing testcase so the suite is never empty. Mirrors src/report/junit.ts.
"""

from __future__ import annotations

from typing import List

from ..types import Report


def _esc(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def to_junit(report: Report, name: str) -> str:
    lines: List[str] = ['<?xml version="1.0" encoding="UTF-8"?>']
    suite = _esc(name)

    if not report.diagnostics:
        lines.append('<testsuites name="ag-ui-validate" tests="1" failures="0" errors="0" skipped="0">')
        lines.append(f'  <testsuite name="{suite}" tests="1" failures="0" errors="0" skipped="0">')
        lines.append(
            f'    <testcase name="AG-UI conformance: no violations across {report.event_count} events" '
            f'classname="{suite}"/>'
        )
        lines.append("  </testsuite>")
        lines.append("</testsuites>")
        return "\n".join(lines) + "\n"

    failures = sum(1 for d in report.diagnostics if d.severity == "error")
    skipped = len(report.diagnostics) - failures
    counts = f'tests="{len(report.diagnostics)}" failures="{failures}" errors="0" skipped="{skipped}"'
    lines.append(f'<testsuites name="ag-ui-validate" {counts}>')
    lines.append(f'  <testsuite name="{suite}" {counts}>')
    for d in report.diagnostics:
        where = f"event {d.event_index}" if d.event_index >= 0 else "stream"
        name_ = _esc(f"{d.rule} ({where})")
        lines.append(f'    <testcase name="{name_}" classname="{suite}">')
        body = f"{_esc(d.message)}\n{_esc(d.spec_url)}"
        if d.severity == "error":
            lines.append(f'      <failure message="{_esc(d.message)}">{body}</failure>')
        else:
            skip_message = _esc(f"{d.severity}: {d.message}")
            lines.append(f'      <skipped message="{skip_message}">{body}</skipped>')
        lines.append("    </testcase>")
    lines.append("  </testsuite>")
    lines.append("</testsuites>")
    return "\n".join(lines) + "\n"
