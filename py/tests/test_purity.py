"""Static purity guard, the Python analogue of js/test/purity.test.ts. The
core (everything under src/ag_ui_validate/ except transport/ and cli.py)
must stay a pure, deterministic computation: no network, no clocks, no
randomness, no subprocess/env access, no file I/O. transport/ and cli.py
are the two modules allowed I/O by construction — see docs/TESTING.md's
"What must never regress".

One documented exception: rules/catalog.py reads catalog.json from disk
once at import time. The TS side avoids this via a build-time JSON import
(`import catalogJson from "../../../spec/catalog.json"`, inlined by tsc);
Python has no equivalent without a build step, so this one file is allowed
its one resource read — everything else, including catalog.py itself for
every *other* banned pattern, stays banned.

Patterns require actual usage syntax (import/call/attribute-access), not
bare word matches, so prose in comments and docstrings can still name the
APIs without tripping the guard — same approach as the TS test.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List

import pytest

SRC = Path(__file__).resolve().parents[1] / "src" / "ag_ui_validate"

CLI_ONLY = SRC / "cli.py"
RESOURCE_LOAD_EXCEPTION = SRC / "rules" / "catalog.py"

CORE_BANNED = [
    (
        re.compile(
            r"\bimport\s+httpx\b|\bhttpx\.\w|\bimport\s+requests\b|\brequests\.\w"
            r"|\bimport\s+urllib|\burllib\.\w|\bsocket\.\w"
        ),
        "network",
    ),
    (
        re.compile(r"\btime\.(time|monotonic|sleep)\s*\(|\bdatetime\.(now|utcnow)\s*\("),
        "clock",
    ),
    (re.compile(r"\brandom\.\w|\bsecrets\.\w"), "nondeterminism"),
    (re.compile(r"\bimport\s+subprocess\b|\bsubprocess\.\w"), "subprocess"),
    (re.compile(r"os\.environ|os\.getenv\s*\("), "env access"),
    (
        re.compile(
            r"\bopen\s*\(|\.read_text\s*\(|\.write_text\s*\(|\.read_bytes\s*\(|\.write_bytes\s*\("
        ),
        "file I/O",
    ),
]

CLI_IMPORT = re.compile(
    r"from\s+\.cli\s+import|from\s+\.\.cli\s+import|from\s+ag_ui_validate\.cli\s+import"
    r"|import\s+ag_ui_validate\.cli\b"
)


def _all_files() -> List[Path]:
    return sorted(SRC.rglob("*.py"))


def _core_files() -> List[Path]:
    return [
        f
        for f in _all_files()
        if f != CLI_ONLY and f.parent.name != "transport" and f != RESOURCE_LOAD_EXCEPTION
    ]


@pytest.mark.parametrize(
    "file", _core_files(), ids=lambda f: str(f.relative_to(SRC))
)
def test_core_file_is_pure(file):
    source = file.read_text()
    for pattern, label in CORE_BANNED:
        match = pattern.search(source)
        assert match is None, f"{label} ({match and match.group(0)!r}) found in core file {file}"


def test_catalog_loader_has_no_undocumented_impurity():
    source = RESOURCE_LOAD_EXCEPTION.read_text()
    for pattern, label in CORE_BANNED:
        if label == "file I/O":
            continue  # the one documented exception — see module docstring
        match = pattern.search(source)
        assert match is None, f"{label} ({match and match.group(0)!r}) found in catalog.py"


def test_no_library_file_imports_cli():
    for file in _all_files():
        if file == CLI_ONLY:
            continue
        source = file.read_text()
        assert CLI_IMPORT.search(source) is None, f"{file} imports cli.py"
