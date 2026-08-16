// Verifies every specUrl in the rule catalog and the generated event table:
// the page must return HTTP 200 and the #anchor must exist in its HTML.
// Network-dependent, so it is a script rather than a vitest test.
// Run `npm run build` first, then `npm run links:check`. Exits 1 on breakage.

import { readFileSync } from "node:fs"

let EVENT_TABLE
try {
  ;({ EVENT_TABLE } = await import("../dist/index.js"))
} catch {
  console.error("dist/ not found — run `npm run build` first")
  process.exit(2)
}

const catalog = JSON.parse(readFileSync(new URL("../src/rules/catalog.json", import.meta.url), "utf8"))

const urls = new Set(catalog.rules.map((r) => r.specUrl))
for (const spec of Object.values(EVENT_TABLE)) urls.add(spec.specUrl)
urls.add("https://docs.ag-ui.com/drafts/meta-events") // AGUI503's draft carve-out

const byPage = new Map()
for (const u of urls) {
  const [page, anchor] = u.split("#")
  if (!byPage.has(page)) byPage.set(page, new Set())
  if (anchor) byPage.get(page).add(anchor)
}

let broken = 0
for (const [page, anchors] of byPage) {
  let res
  try {
    res = await fetch(page, { redirect: "follow" })
  } catch (e) {
    console.error("FETCH FAILED", page, "-", e instanceof Error ? e.message : e)
    broken++
    continue
  }
  if (!res.ok) {
    console.error("HTTP", res.status, page)
    broken++
    continue
  }
  const html = await res.text()
  for (const anchor of anchors) {
    // Anchor ids may be quoted or unquoted (WHATWG emits id=foo without quotes).
    const pattern = new RegExp(`id=["']?${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["' >]`)
    if (!pattern.test(html)) {
      console.error(`MISSING ANCHOR #${anchor} on ${page}`)
      broken++
    }
  }
}

console.log(`spec links: ${urls.size} unique urls across ${byPage.size} pages — ${broken} broken`)
if (broken > 0) process.exit(1)
