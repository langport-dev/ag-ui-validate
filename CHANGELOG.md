# ag-ui-validate

## 0.1.0

### Minor Changes

- Initial release: conformance validator for the AG-UI protocol.
  
  - Pure, zero-dependency core: `createValidator` with 40 spec-grounded rules (lifecycle, text messages, tool calls, state, reasoning, transport, hygiene), every diagnostic carrying a rule ID, severity, and spec link
  - `ag-ui-validate/transport`: SSE + NDJSON clients (`validateEndpoint`, `validateBody`) with transport-level checks and recorded-input mode
  - `ag-ui-validate/vitest`: `expect(events).toBeValidAGUI()` matcher
  - `ag-ui-validate/report`: pretty, JSON, SARIF 2.1.0, and JUnit reporters
  - `npx ag-ui-validate <url|file|->` CLI with severity overrides, feature declarations, and CI-friendly exit codes
  - GitHub Action (`langport-dev/ag-ui-validate/action`)
  - Language-neutral fixture corpus and per-rule documentation
