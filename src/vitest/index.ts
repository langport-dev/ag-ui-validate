import { expect } from "vitest"
import { toBeValidAGUI } from "./matcher.js"
import type { ToBeValidAGUIOptions } from "./matcher.js"

export { toBeValidAGUI } from "./matcher.js"
export type { MatcherResult, ToBeValidAGUIOptions } from "./matcher.js"

declare module "vitest" {
  // The type parameter must match vitest's own `interface Matchers<T = any>`.
  interface Matchers<T = any> {
    toBeValidAGUI(options?: ToBeValidAGUIOptions): T
  }
}

expect.extend({
  toBeValidAGUI(received: unknown, options?: ToBeValidAGUIOptions) {
    return toBeValidAGUI(received, options)
  },
})
