#!/usr/bin/env node
// The ag-ui-validate executable — the one deliberately Node-only file in src/.
// Everything it does is delegated: parsing to cli-args.ts, validation to the
// core + transport layers, output to the pure reporters. This file only wires
// process.argv/stdin/stdout/exit codes to those pieces.
import { createReadStream, readFileSync } from "node:fs"
import process from "node:process"
import { decideExitCode, parseCliArgs, USAGE } from "./cli-args.js"
import type { CliConfig } from "./cli-args.js"
import { formatDiagnosticLine, formatReportSummary, toJsonReport, toJUnit, toSarif } from "./report/index.js"
import { TransportError, validateBody, validateEndpoint } from "./transport/index.js"
import type { TransportOptions, TransportResult } from "./transport/index.js"
import type { Diagnostic, ValidatorOptions } from "./types.js"

const TOOL_NAME = "ag-ui-validate"

function toolVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version?: string
    }
    return pkg.version ?? "0.0.0"
  } catch {
    return "0.0.0"
  }
}

function transportOptions(
  config: CliConfig,
  onDiagnostic: ((d: Diagnostic) => void) | undefined,
): TransportOptions {
  const validator: ValidatorOptions = {}
  if (config.features !== undefined) validator.features = config.features
  if (Object.keys(config.severityOverrides).length > 0) {
    validator.severityOverrides = config.severityOverrides
  }
  const opts: TransportOptions = { validator }
  if (onDiagnostic !== undefined) opts.onDiagnostic = onDiagnostic
  return opts
}

async function main(): Promise<number> {
  const parsed = parseCliArgs(process.argv.slice(2))
  if (!parsed.ok) {
    process.stderr.write(`error: ${parsed.error}\n\n${USAGE}`)
    return 2
  }
  const config = parsed.config
  if (config.help) {
    process.stdout.write(USAGE)
    return 0
  }
  const version = toolVersion()
  if (config.version) {
    process.stdout.write(`${TOOL_NAME} ${version}\n`)
    return 0
  }

  const color =
    config.color ?? (process.stdout.isTTY === true && process.env.NO_COLOR === undefined)
  const pretty = config.format === "pretty"

  // Pretty mode streams findings as they are detected; machine formats emit
  // one document at the end, so nothing else may touch stdout before it.
  let printed = 0
  const onDiagnostic = pretty
    ? (d: Diagnostic): void => {
        printed += 1
        process.stdout.write(`${formatDiagnosticLine(d, { color })}\n`)
      }
    : undefined

  const isUrl = /^https?:\/\//i.test(config.target)
  let result: TransportResult
  let targetLabel: string
  if (isUrl) {
    targetLabel = config.target
    const opts = transportOptions(config, onDiagnostic)
    if (Object.keys(config.headers).length > 0) opts.headers = config.headers
    if (config.timeoutMs !== undefined) opts.timeoutMs = config.timeoutMs
    result = await validateEndpoint(config.target, opts)
  } else if (config.target === "-") {
    targetLabel = "stdin"
    if (process.stdin.isTTY === true) {
      process.stderr.write("error: stdin is a terminal — pipe a recording in, or pass a file path\n")
      return 2
    }
    result = await validateBody(process.stdin, null, {
      ...transportOptions(config, onDiagnostic),
      recorded: true,
    })
  } else {
    targetLabel = config.target
    result = await validateBody(createReadStream(config.target), null, {
      ...transportOptions(config, onDiagnostic),
      recorded: true,
    })
  }

  const report = result.report
  if (pretty) {
    if (printed > 0) process.stdout.write("\n")
    process.stdout.write(`${formatReportSummary(report, { color })}\n`)
  } else if (config.format === "json") {
    const doc = toJsonReport(report, { tool: { name: TOOL_NAME, version }, target: targetLabel })
    process.stdout.write(`${JSON.stringify(doc, null, 2)}\n`)
  } else if (config.format === "sarif") {
    // Line-based locations only make sense when events map 1:1 to lines.
    const lineOriented = !isUrl && config.target !== "-" && /\.(jsonl|ndjson)$/i.test(config.target)
    const opts = lineOriented
      ? { toolVersion: version, artifactUri: config.target }
      : { toolVersion: version }
    process.stdout.write(`${JSON.stringify(toSarif(report, opts), null, 2)}\n`)
  } else {
    process.stdout.write(toJUnit(report, { name: targetLabel }))
  }

  return decideExitCode(report.summary, config.maxWarnings)
}

main().then(
  (code) => {
    process.exitCode = code
  },
  (e: unknown) => {
    const message =
      e instanceof TransportError
        ? e.message
        : e instanceof Error
          ? (e.stack ?? e.message)
          : String(e)
    process.stderr.write(`error: ${message}\n`)
    process.exitCode = 2
  },
)
