# ag-ui-validate (Python)

Native Python port of
[ag-ui-validate](https://github.com/langport-dev/ag-ui-validate), a
conformance validator for the [AG-UI protocol](https://docs.ag-ui.com).
Same rule catalog, same fixture corpus, byte-identical CLI flags and
JSON/SARIF/JUnit output as the TypeScript implementation — checked against
it on every PR by Parity CI.

**Not yet published as a functional PyPI release** — only a
name-reservation placeholder (`0.0.1`) is live today. Install from source
until a real release ships:

```bash
git clone https://github.com/langport-dev/ag-ui-validate
cd ag-ui-validate/py
pip install -e ".[dev]"   # or ".[transport]" for just the endpoint-validating extras
```

## CLI

```bash
ag-ui-validate http://localhost:8000/agui   # live endpoint (POSTs a RunAgentInput)
ag-ui-validate run.jsonl                    # recorded stream (NDJSON/JSONL or SSE capture)
cat run.jsonl | ag-ui-validate -            # stdin
```

Exit codes: `0` clean, `1` findings at error level (or warnings over
`--max-warnings`), `2` tool failure. See `ag-ui-validate --help` for the
full flag list.

## pytest plugin

```python
from ag_ui_validate.pytest_plugin import assert_valid_agui

def test_my_agent_stream(captured_events):
    assert_valid_agui(captured_events, features=["shared-state"], max_warnings=0)
```

Registers automatically as a pytest plugin on install — no `conftest.py`
setup needed. An async counterpart, `assert_valid_agui_endpoint`, validates
a live endpoint directly from a test.

## More

See the
[main README](https://github.com/langport-dev/ag-ui-validate#readme) for
the full rule catalog and design commitments, and
[docs/PYTHON-PORT-PLAN.md](https://github.com/langport-dev/ag-ui-validate/blob/main/docs/PYTHON-PORT-PLAN.md)
for the port's milestone history.
