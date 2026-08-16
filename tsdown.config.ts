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
