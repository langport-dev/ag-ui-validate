# ag-ui-validate

Conformance validator for the [AG-UI protocol](https://docs.ag-ui.com). Feed it an
AG-UI event stream — live from an endpoint, or from a recorded file — and it reports
every way the stream violates the protocol, with a rule ID, a severity, a location,
and a link to the governing spec section.

```bash
npx ag-ui-validate http://localhost:8000/agui
cat run.jsonl | npx ag-ui-validate -
```

> **Status: pre-release.** The core validator (`createValidator` / `feed` /
> `finalize` / `report`) is implemented; transport, CLI, and the Vitest matcher
> are in progress.

## Core API

```ts
import { createValidator } from "ag-ui-validate"

const v = createValidator()
for (const event of events) {
  const diags = v.feed(event) // Diagnostic[] — emitted as soon as detectable
}
const final = v.finalize()    // end-of-stream checks (unterminated calls, missing RUN_FINISHED, …)
const report = v.report()     // { diagnostics, summary, features }
```

Every diagnostic cites the spec section it enforces via `specUrl`. The rule catalog
lives in [`src/rules/catalog.json`](src/rules/catalog.json) as data, so other
implementations can share it.

## License

MIT — maintained by [Faraz](https://langport.dev).
