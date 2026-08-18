# ag-ui-validate action (deprecated location)

> **This action has moved to
> [langport-dev/ag-ui-validate-action](https://github.com/langport-dev/ag-ui-validate-action).**
> Subdirectory actions can't be listed on GitHub Marketplace, so the action
> now lives in its own repo with `action.yml` at the root. Update your
> workflow:
>
> ```diff
> -- uses: langport-dev/ag-ui-validate/action@main
> +- uses: langport-dev/ag-ui-validate-action@v1
> ```
>
> This directory still works as-is (`langport-dev/ag-ui-validate/action@main`)
> and will keep working for one more release cycle, but takes no new
> features — the new repo has PR annotations, a category-grouped job
> summary, and a `fail-on` input this one doesn't. It will be removed after
> that cycle.

Validate an AG-UI agent endpoint or recorded event stream for protocol
conformance in CI. A thin wrapper around the
[`ag-ui-validate`](https://github.com/langport-dev/ag-ui-validate) CLI: the
step fails on error-severity findings (exit 1) or tool failure (exit 2), a
findings table lands in the job summary, and SARIF/JUnit/JSON reports can be
written for other tooling.

## Usage

```yaml
- uses: langport-dev/ag-ui-validate/action@main
  with:
    target: http://localhost:8000/agui   # or a recorded .jsonl file
```

With code scanning upload:

```yaml
- uses: langport-dev/ag-ui-validate/action@main
  with:
    target: recordings/run.jsonl
    sarif-file: agui.sarif
- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: agui.sarif
```

## Inputs

| Input | Description |
| --- | --- |
| `target` (required) | Endpoint URL, recorded stream file (JSONL/NDJSON or SSE capture), or `-` for stdin |
| `version` | Package version to run via npx (default `latest`); `local` uses the `dist/` build in this checkout |
| `max-warnings` | Fail when warnings exceed this number |
| `features` | Comma-separated declared features |
| `rules` | Severity overrides, e.g. `AGUI105=error AGUI902=off` |
| `headers` | Extra request headers for endpoint targets, one `Name: value` per line |
| `timeout` | Abort an endpoint request after this many seconds |
| `sarif-file` / `junit-file` / `json-file` | Also write these report formats to files |

## Outputs

`exit-code`, `errors`, `warnings`, `info`.
