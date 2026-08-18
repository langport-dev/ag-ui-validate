"""Pure CLI argument parsing - no I/O, so it obeys the core purity rules and
tests without spawning processes. The I/O entry point lives in cli.py.
Mirrors src/cli-args.ts.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable, Dict, List, Literal, Optional, Union

if TYPE_CHECKING:
    from .types import Summary

CliFormat = str  # "pretty" | "json" | "sarif" | "junit"

_SEVERITIES = {"error", "warning", "info", "off"}
_RULE_ID = re.compile(r"^AGUI\d{3}$")


@dataclass
class CliConfig:
    # URL, file path, or "-" for stdin. Empty only with --help/--version.
    target: str = ""
    format: str = "pretty"
    # true/false forced; None = auto-detect from TTY.
    color: Optional[bool] = None
    max_warnings: Optional[int] = None
    timeout_ms: Optional[int] = None
    # Header names lowercased.
    headers: Dict[str, str] = field(default_factory=dict)
    features: Optional[List[str]] = None
    severity_overrides: Dict[str, str] = field(default_factory=dict)
    # Write these formats to files in the same run, whatever stdout shows.
    sarif_file: Optional[str] = None
    junit_file: Optional[str] = None
    json_file: Optional[str] = None
    # Pretty output only: one line per rule with a count, not one per finding.
    group: bool = False
    help: bool = False
    version: bool = False


@dataclass
class ParseOk:
    config: CliConfig
    ok: Literal[True] = field(default=True, init=False)


@dataclass
class ParseErr:
    error: str
    ok: Literal[False] = field(default=False, init=False)


ParseResult = Union[ParseOk, ParseErr]

USAGE = """ag-ui-validate — conformance validator for the AG-UI protocol

Usage:
  ag-ui-validate <url>            connect to a live endpoint and validate the stream
  ag-ui-validate <file>           validate a recorded stream (SSE capture or NDJSON/JSONL)
  ag-ui-validate -                read a recorded stream from stdin

Output (default: human-readable):
  --json                          machine-readable report on stdout
  --sarif                         SARIF 2.1.0 log on stdout (code scanning)
  --junit                         JUnit XML on stdout (CI test reports)
  --json-file <path>              additionally write the JSON report to a file
  --sarif-file <path>             additionally write a SARIF log to a file
  --junit-file <path>             additionally write JUnit XML to a file
  --group                         one line per rule with a count (large streams)
  --no-color                      disable ANSI colors

Rules:
  --rule AGUI###=<severity>       override a rule's severity (error|warning|info|off)
  --off AGUI###                   shorthand for --rule AGUI###=off
  --features <a,b,...>            declare exercised features (enables e.g. AGUI305)
  --max-warnings <n>              exit 1 when warnings exceed n

Endpoint options:
  --header "Name: value"          extra request header (repeatable)
  --timeout <seconds>             abort the request after this long

Exit codes: 0 clean, 1 findings at error level (or warnings over --max-warnings), 2 tool failure.
"""


@dataclass
class _Flag:
    takes_value: bool
    apply: Callable[[CliConfig, str], Optional[str]]


def _set_format(c: CliConfig, format_: str) -> Optional[str]:
    if c.format != "pretty" and c.format != format_:
        return "pick at most one of --json, --sarif, --junit"
    c.format = format_
    return None


def _apply_off(c: CliConfig, v: str) -> Optional[str]:
    if not _RULE_ID.match(v):
        return f"--off expects a rule ID like AGUI203, got '{v}'"
    c.severity_overrides[v] = "off"
    return None


def _apply_rule(c: CliConfig, v: str) -> Optional[str]:
    eq = v.find("=")
    if eq == -1:
        return f"--rule expects ID=severity (e.g. AGUI105=warning), got '{v}'"
    rule_id = v[:eq]
    severity = v[eq + 1 :]
    if not _RULE_ID.match(rule_id):
        return f"--rule expects a rule ID like AGUI105, got '{rule_id}'"
    if severity not in _SEVERITIES:
        return f"'{severity}' is not a severity; use error, warning, info, or off"
    c.severity_overrides[rule_id] = severity
    return None


def _apply_max_warnings(c: CliConfig, v: str) -> Optional[str]:
    try:
        n = float(v)
    except ValueError:
        n = float("nan")
    if not n.is_integer() or n < 0:
        return f"--max-warnings expects a non-negative integer, got '{v}'"
    c.max_warnings = int(n)
    return None


def _apply_timeout(c: CliConfig, v: str) -> Optional[str]:
    try:
        n = float(v)
    except ValueError:
        n = float("nan")
    if not math.isfinite(n) or n <= 0:
        return f"--timeout expects a positive number of seconds, got '{v}'"
    c.timeout_ms = round(n * 1000)
    return None


def _apply_header(c: CliConfig, v: str) -> Optional[str]:
    colon = v.find(":")
    if colon <= 0:
        return f'--header expects "Name: value", got \'{v}\''
    c.headers[v[:colon].strip().lower()] = v[colon + 1 :].strip()
    return None


def _apply_features(c: CliConfig, v: str) -> Optional[str]:
    c.features = [f.strip() for f in v.split(",") if f.strip() != ""]
    return None


def _apply_help(c: CliConfig, v: str) -> Optional[str]:
    c.help = True
    return None


def _apply_version(c: CliConfig, v: str) -> Optional[str]:
    c.version = True
    return None


def _apply_no_color(c: CliConfig, v: str) -> Optional[str]:
    c.color = False
    return None


def _apply_group(c: CliConfig, v: str) -> Optional[str]:
    c.group = True
    return None


def _apply_sarif_file(c: CliConfig, v: str) -> Optional[str]:
    c.sarif_file = v
    return None


def _apply_junit_file(c: CliConfig, v: str) -> Optional[str]:
    c.junit_file = v
    return None


def _apply_json_file(c: CliConfig, v: str) -> Optional[str]:
    c.json_file = v
    return None


_FLAGS: Dict[str, _Flag] = {
    "--help": _Flag(False, _apply_help),
    "--version": _Flag(False, _apply_version),
    "--no-color": _Flag(False, _apply_no_color),
    "--group": _Flag(False, _apply_group),
    "--json": _Flag(False, lambda c, v: _set_format(c, "json")),
    "--sarif": _Flag(False, lambda c, v: _set_format(c, "sarif")),
    "--junit": _Flag(False, lambda c, v: _set_format(c, "junit")),
    "--off": _Flag(True, _apply_off),
    "--rule": _Flag(True, _apply_rule),
    "--max-warnings": _Flag(True, _apply_max_warnings),
    "--timeout": _Flag(True, _apply_timeout),
    "--header": _Flag(True, _apply_header),
    "--sarif-file": _Flag(True, _apply_sarif_file),
    "--junit-file": _Flag(True, _apply_junit_file),
    "--json-file": _Flag(True, _apply_json_file),
    "--features": _Flag(True, _apply_features),
}


def parse_cli_args(argv: List[str]) -> ParseResult:
    config = CliConfig()

    targets: List[str] = []
    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "-" or not arg.startswith("-"):
            targets.append(arg)
            i += 1
            continue
        name = arg
        inline_value: Optional[str] = None
        eq = arg.find("=")
        if eq != -1:
            name = arg[:eq]
            inline_value = arg[eq + 1 :]
        flag = _FLAGS.get(name)
        if flag is None:
            return ParseErr(f"unknown flag '{name}'")
        value = ""
        if flag.takes_value:
            if inline_value is not None:
                value = inline_value
            elif i + 1 < len(argv):
                i += 1
                value = argv[i]
            else:
                return ParseErr(f"{name} requires a value")
        elif inline_value is not None:
            return ParseErr(f"{name} does not take a value")
        error = flag.apply(config, value)
        if error is not None:
            return ParseErr(error)
        i += 1

    if config.group and config.format != "pretty":
        return ParseErr("--group only applies to the default pretty output, not --json/--sarif/--junit")
    if len(targets) > 1:
        return ParseErr(f"expected exactly one target, got {len(targets)}")
    if len(targets) == 1:
        config.target = targets[0]
    elif not config.help and not config.version:
        return ParseErr("missing target: a URL, a file path, or - for stdin")
    return ParseOk(config)


def decide_exit_code(summary: "Summary", max_warnings: Optional[int] = None) -> int:
    if summary.errors > 0:
        return 1
    if max_warnings is not None and summary.warnings > max_warnings:
        return 1
    return 0
