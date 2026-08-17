"""End-to-end CLI tests: spawn the real installed console script against
real fixture files. Mirrors js/test/cli/integration.test.ts (which spawns
dist/cli.js; here we spawn the `ag-ui-validate` console script directly,
since Python has no separate build step to gate on).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "spec" / "fixtures"

_BIN = shutil.which("ag-ui-validate") or str(Path(sys.executable).parent / "ag-ui-validate")


def cli(args, stdin: str = None):
    result = subprocess.run(
        [_BIN, *args],
        input=stdin,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, result.stdout, result.stderr


@pytest.mark.skipif(not Path(_BIN).exists(), reason="ag-ui-validate console script not installed")
class TestCliIntegration:
    def test_invalid_fixture_exits_1_and_names_the_rule(self):
        code, out, err = cli([str(FIXTURES / "invalid/AGUI203-unterminated-tool-call/stream.jsonl")])
        assert code == 1
        assert "AGUI203" in out

    def test_valid_fixture_exits_0(self):
        code, out, err = cli([str(FIXTURES / "valid/agentic-chat.jsonl")])
        assert code == 0
        assert "no conformance violations" in out

    def test_reads_from_stdin_with_dash(self):
        body = (FIXTURES / "valid/agentic-chat.jsonl").read_text()
        code, out, err = cli(["-"], stdin=body)
        assert code == 0

    def test_json_prints_a_parseable_report_document(self):
        code, out, err = cli([str(FIXTURES / "invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--json"])
        assert code == 1
        doc = json.loads(out)
        assert doc["tool"]["name"] == "ag-ui-validate"
        assert any(d["rule"] == "AGUI203" for d in doc["diagnostics"])

    def test_sarif_prints_a_parseable_sarif_log(self):
        code, out, err = cli([str(FIXTURES / "invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--sarif"])
        doc = json.loads(out)
        assert doc["version"] == "2.1.0"

    def test_off_silences_the_only_finding_and_exits_0(self):
        code, out, err = cli(
            [str(FIXTURES / "invalid/AGUI203-unterminated-tool-call/stream.jsonl"), "--off", "AGUI203"]
        )
        assert code == 0

    def test_a_missing_file_is_a_tool_failure_exit_2(self):
        code, out, err = cli([str(FIXTURES / "does-not-exist.jsonl")])
        assert code == 2
        assert "no such file" in err.lower() or "cannot read" in err.lower() or "enoent" in err.lower()

    def test_bad_flags_exit_2_with_usage_on_stderr(self):
        code, out, err = cli(["--frobnicate"])
        assert code == 2
        assert "unknown" in err.lower()

    def test_help_exits_0_and_prints_usage(self):
        code, out, err = cli(["--help"])
        assert code == 0
        assert "ag-ui-validate" in out
        assert "--max-warnings" in out

    def test_group_collapses_repeated_findings_but_keeps_totals_correct(self):
        events = [
            {"type": "RUN_STARTED", "threadId": "t", "runId": "r", "timestamp": 1},
            {"type": "TEXT_MESSAGE_START", "messageId": "m1", "role": "assistant", "timestamp": 2},
            {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "", "timestamp": 3},
            {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "", "timestamp": 4},
            {"type": "TEXT_MESSAGE_CONTENT", "messageId": "m1", "delta": "", "timestamp": 5},
            {"type": "TEXT_MESSAGE_END", "messageId": "m1", "timestamp": 6},
            {"type": "RUN_FINISHED", "threadId": "t", "runId": "r", "timestamp": 7},
        ]
        with tempfile.TemporaryDirectory(prefix="agui-group-") as d:
            file = Path(d) / "dups.jsonl"
            file.write_text("\n".join(json.dumps(e) for e in events) + "\n")
            code, out, err = cli([str(file), "--group"])
            assert code == 0
            assert out.count("AGUI105") == 1  # one grouped line, not three
            assert "×3" in out
            assert "3 warnings" in out  # summary totals unchanged

    def test_file_output_flags_write_all_requested_formats_in_a_single_run(self):
        with tempfile.TemporaryDirectory(prefix="agui-cli-") as d:
            sarif = Path(d) / "out.sarif"
            junit = Path(d) / "out.xml"
            json_path = Path(d) / "report.json"
            code, out, err = cli(
                [
                    str(FIXTURES / "invalid/AGUI203-unterminated-tool-call/stream.jsonl"),
                    "--sarif-file", str(sarif),
                    "--junit-file", str(junit),
                    "--json-file", str(json_path),
                ]
            )
            assert code == 1
            assert "AGUI203" in out  # stdout still pretty
            sarif_doc = json.loads(sarif.read_text())
            assert sarif_doc["version"] == "2.1.0"
            assert "<testsuites" in junit.read_text()
            json_doc = json.loads(json_path.read_text())
            assert json_doc["summary"]["errors"] == 1
