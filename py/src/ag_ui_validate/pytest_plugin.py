"""pytest plugin: AG-UI conformance assertions for pytest test suites.
Registers via a standard pytest11 entry point so the plugin activates on
install with no explicit setup-file import needed (unlike the vitest
subpath, which requires an explicit `import "ag-ui-validate/vitest"`).

`assert_valid_agui` is the priority surface (see docs/PYTHON-PORT-PLAN.md
§6) and stays dependency-free. `validate_agui_endpoint`/
`assert_valid_agui_endpoint` build on `ag_ui_validate.transport` and only
pull in httpx at call time, when actually validating a live endpoint.

Mirrors src/vitest/matcher.ts's `toBeValidAGUI`, adapted from a boolean
matcher (with vitest's `.not` support) to pytest's assert-raises idiom: a
function that raises `AssertionError` with a rich message on failure and
returns `None` on success.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Union

from .cli_args import decide_exit_code
from .engine import create_validator
from .report.pretty import format_diagnostic_line
from .transport import TransportOptions, validate_endpoint
from .types import Report, ValidatorOptions

__all__ = [
    "validate_agui",
    "assert_valid_agui",
    "validate_agui_endpoint",
    "assert_valid_agui_endpoint",
]

_LINE_SPLIT = re.compile(r"\r?\n")


def _events_from(received: Union[str, List[Any]]) -> List[Any]:
    if isinstance(received, str):
        # A JSONL/NDJSON capture: one event per non-empty line.
        return [line for line in _LINE_SPLIT.split(received) if line.strip() != ""]
    if isinstance(received, list):
        return received
    raise TypeError(
        "assert_valid_agui expects an array of events (objects or JSON strings) or a JSONL "
        f"string; received {type(received).__name__}. Wrap a single event in a list."
    )


def validate_agui(
    received: Union[str, List[Any]],
    *,
    features: Optional[List[str]] = None,
    severity_overrides: Optional[Dict[str, str]] = None,
) -> Report:
    """Run the core validator over `received` (a list of event dicts/JSON
    strings, or a JSONL string) and return the full Report."""
    events = _events_from(received)
    validator_options = ValidatorOptions()
    if features is not None:
        validator_options.features = features
    if severity_overrides is not None:
        validator_options.severity_overrides = severity_overrides
    v = create_validator(validator_options)
    for e in events:
        v.feed(e)
    v.finalize()
    return v.report()


def _format_failure_message(report: Report, max_warnings: Optional[int]) -> str:
    errors, warnings = report.summary.errors, report.summary.warnings
    lines: List[str] = []
    if errors > 0:
        lines.append(
            f"expected a valid AG-UI stream, but found {errors} "
            f"error-severity finding{'' if errors == 1 else 's'}:"
        )
    else:
        lines.append(
            f"expected a valid AG-UI stream, but {warnings} "
            f"warning{'' if warnings == 1 else 's'} exceed max_warnings: {max_warnings}:"
        )
    for d in report.diagnostics:
        if d.severity == "info":
            continue
        lines.append(format_diagnostic_line(d, color=False))
    return "\n".join(lines)


def assert_valid_agui(
    received: Union[str, List[Any]],
    *,
    features: Optional[List[str]] = None,
    severity_overrides: Optional[Dict[str, str]] = None,
    max_warnings: Optional[int] = None,
) -> None:
    """Assert that `received` is a conformant AG-UI event stream. Raises
    AssertionError with the joined per-diagnostic lines (rule, severity,
    spec URL) when invalid."""
    report = validate_agui(received, features=features, severity_overrides=severity_overrides)
    if decide_exit_code(report.summary, max_warnings) == 0:
        return
    raise AssertionError(_format_failure_message(report, max_warnings))


async def validate_agui_endpoint(
    url: str,
    *,
    features: Optional[List[str]] = None,
    severity_overrides: Optional[Dict[str, str]] = None,
    **transport_kwargs: Any,
) -> Report:
    """Validate a live AG-UI endpoint and return the full Report. Requires
    httpx (`pip install ag-ui-validate[transport]`) unless a custom
    fetch_impl is passed via transport_kwargs."""
    validator_options = ValidatorOptions()
    if features is not None:
        validator_options.features = features
    if severity_overrides is not None:
        validator_options.severity_overrides = severity_overrides
    opts = TransportOptions(validator=validator_options, **transport_kwargs)
    result = await validate_endpoint(url, opts)
    return result.report


async def assert_valid_agui_endpoint(
    url: str,
    *,
    features: Optional[List[str]] = None,
    severity_overrides: Optional[Dict[str, str]] = None,
    max_warnings: Optional[int] = None,
    **transport_kwargs: Any,
) -> None:
    """Assert that a live AG-UI endpoint's stream is conformant. Raises
    AssertionError on failure, mirroring assert_valid_agui."""
    report = await validate_agui_endpoint(
        url, features=features, severity_overrides=severity_overrides, **transport_kwargs
    )
    if decide_exit_code(report.summary, max_warnings) == 0:
        return
    raise AssertionError(_format_failure_message(report, max_warnings))
