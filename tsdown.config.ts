import { defineConfig } from "tsdown"

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // The core is isomorphic: no platform globals, no Node built-ins.
  platform: "neutral",
})
