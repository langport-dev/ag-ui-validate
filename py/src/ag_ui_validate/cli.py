"""The ag-ui-validate executable. Everything it does is delegated: parsing to
cli_args.py, validation to the core + transport layers, output to the pure
reporters. This module only wires argv/stdin/stdout/exit codes to those
pieces. Mirrors src/cli.ts.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import traceback
from importlib.metadata import PackageNotFoundError, version as _pkg_version
from typing import AsyncGenerator, Callable, List, Optional

from .cli_args import USAGE, CliConfig, decide_exit_code, parse_cli_args
from .report import (
    format_diagnostic_line,
    format_grouped_diagnostics,
    format_report_summary,
    to_json_report,
    to_junit,
    to_sarif,
)
from .transport import TransportError, TransportOptions, validate_body, validate_endpoint
from .types import Diagnostic, ValidatorOptions

TOOL_NAME = "ag-ui-validate"
_CHUNK_SIZE = 65536


def _tool_version() -> str:
    try:
        return _pkg_version("ag-ui-validate")
    except PackageNotFoundError:
        return "0.0.0"


def _transport_options(config: CliConfig, on_diagnostic: Optional[Callable[[Diagnostic], None]]) -> TransportOptions:
    validator = ValidatorOptions()
    if config.features is not None:
        validator.features = config.features
    if config.severity_overrides:
        validator.severity_overrides = config.severity_overrides
    opts = TransportOptions(validator=validator)
    if on_diagnostic is not None:
        opts.on_diagnostic = on_diagnostic
    return opts


async def _stdin_chunks() -> AsyncGenerator[bytes, None]:
    loop = asyncio.get_event_loop()
    while True:
        chunk = await loop.run_in_executor(None, sys.stdin.buffer.read, _CHUNK_SIZE)
        if not chunk:
            return
        yield chunk


async def _file_chunks(path: str) -> AsyncGenerator[bytes, None]:
    loop = asyncio.get_event_loop()
    with open(path, "rb") as f:
        while True:
            chunk = await loop.run_in_executor(None, f.read, _CHUNK_SIZE)
            if not chunk:
                return
            yield chunk


async def _run(argv: List[str]) -> int:
    parsed = parse_cli_args(argv)
    if not parsed.ok:
        sys.stderr.write(f"error: {parsed.error}\n\n{USAGE}")
        return 2
    config = parsed.config
    if config.help:
        sys.stdout.write(USAGE)
        return 0
    version = _tool_version()
    if config.version:
        sys.stdout.write(f"{TOOL_NAME} {version}\n")
        return 0

    color = config.color if config.color is not None else (sys.stdout.isatty() and "NO_COLOR" not in os.environ)
    pretty = config.format == "pretty"

    # Pretty mode streams findings as they are detected; machine formats emit
    # one document at the end, so nothing else may touch stdout before it.
    # --group defers everything to one collapsed block after the run.
    printed = 0
    on_diagnostic: Optional[Callable[[Diagnostic], None]] = None
    if pretty and not config.group:

        def on_diagnostic(d: Diagnostic) -> None:
            nonlocal printed
            printed += 1
            sys.stdout.write(f"{format_diagnostic_line(d, color)}\n")

    is_url = bool(re.match(r"^https?://", config.target, re.I))
    if is_url:
        target_label = config.target
        opts = _transport_options(config, on_diagnostic)
        if config.headers:
            opts.headers = config.headers
        if config.timeout_ms is not None:
            opts.timeout_ms = config.timeout_ms
        result = await validate_endpoint(config.target, opts)
    elif config.target == "-":
        target_label = "stdin"
        if sys.stdin.isatty():
            sys.stderr.write("error: stdin is a terminal — pipe a recording in, or pass a file path\n")
            return 2
        opts = _transport_options(config, on_diagnostic)
        opts.recorded = True
        result = await validate_body(_stdin_chunks(), None, opts)
    else:
        target_label = config.target
        opts = _transport_options(config, on_diagnostic)
        opts.recorded = True
        result = await validate_body(_file_chunks(config.target), None, opts)

    report = result.report
    # Line-based SARIF locations only make sense when events map 1:1 to lines.
    line_oriented = not is_url and config.target != "-" and bool(re.search(r"\.(jsonl|ndjson)$", config.target, re.I))
    artifact_uri = config.target if line_oriented else None

    if config.json_file is not None:
        doc = to_json_report(report, tool={"name": TOOL_NAME, "version": version}, target=target_label)
        with open(config.json_file, "w") as f:
            f.write(f"{json.dumps(doc, indent=2, ensure_ascii=False)}\n")
    if config.sarif_file is not None:
        sarif_doc = to_sarif(report, tool_version=version, artifact_uri=artifact_uri)
        with open(config.sarif_file, "w") as f:
            f.write(f"{json.dumps(sarif_doc, indent=2, ensure_ascii=False)}\n")
    if config.junit_file is not None:
        with open(config.junit_file, "w") as f:
            f.write(to_junit(report, name=target_label))

    if pretty:
        if config.group and report.diagnostics:
            sys.stdout.write(f"{format_grouped_diagnostics(report.diagnostics, color)}\n\n")
        elif printed > 0:
            sys.stdout.write("\n")
        sys.stdout.write(f"{format_report_summary(report, color)}\n")
    elif config.format == "json":
        doc = to_json_report(report, tool={"name": TOOL_NAME, "version": version}, target=target_label)
        sys.stdout.write(f"{json.dumps(doc, indent=2, ensure_ascii=False)}\n")
    elif config.format == "sarif":
        sarif_doc = to_sarif(report, tool_version=version, artifact_uri=artifact_uri)
        sys.stdout.write(f"{json.dumps(sarif_doc, indent=2, ensure_ascii=False)}\n")
    else:
        sys.stdout.write(to_junit(report, name=target_label))

    return decide_exit_code(report.summary, config.max_warnings)


def main() -> None:
    try:
        code = asyncio.run(_run(sys.argv[1:]))
    except TransportError as e:
        sys.stderr.write(f"error: {e}\n")
        code = 2
    except Exception:
        sys.stderr.write(f"error: {traceback.format_exc()}")
        code = 2
    sys.exit(code)


if __name__ == "__main__":
    main()
