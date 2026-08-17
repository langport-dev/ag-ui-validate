// Plain .mjs (not .ts): the config must load on Node 20, which cannot strip
// TypeScript types natively and tsdown's optional TS-config loader is not a
// dependency we want.
import { defineConfig } from "tsdown"

export default defineConfig([
  {
    entry: { index: "src/index.ts", transport: "src/transport/index.ts", report: "src/report/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2022",
    // The library is isomorphic: no platform globals, no Node built-ins.
    platform: "neutral",
  },
  {
    // The vitest matcher is ESM-only because vitest itself is: a CJS build
    // would require("vitest") and break at runtime.
    entry: { vitest: "src/vitest/index.ts" },
    format: ["esm"],
    fixedExtension: false,
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2022",
    platform: "neutral",
  },
  {
    // The CLI executable is the one Node-only artifact (bin entry, ESM-only).
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    // The package is type:module, so .js is ESM — keep the bin at dist/cli.js.
    fixedExtension: false,
    dts: false,
    sourcemap: true,
    clean: false,
    target: "es2022",
    platform: "node",
  },
])
