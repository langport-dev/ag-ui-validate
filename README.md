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
> `finalize` / `report`), the language-neutral fixture corpus, and the
> transport layer (`ag-ui-validate/transport`) are implemented; the CLI and
> the Vitest matcher are in progress.

## Validating a live endpoint

```ts
import { validateEndpoint } from "ag-ui-validate/transport"

const { report } = await validateEndpoint("http://localhost:8000/agui", {
  headers: { authorization: "Bearer …" },
  onDiagnostic: (d) => console.error(`${d.severity} ${d.rule} ${d.message}`),
})
```

The transport layer POSTs a minimal `RunAgentInput`, consumes the SSE or
NDJSON response, feeds every frame through the core validator, and evaluates
the transport-level rules (SSE framing, Content-Type, keepalive gaps,
buffering, mid-run disconnects) that recorded input cannot exercise.

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
