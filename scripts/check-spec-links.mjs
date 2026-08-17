// Verifies every specUrl in the rule catalog and the canonical event table:
// the page must return HTTP 200 and the #anchor must exist in its HTML.
// Network-dependent, so it is a script rather than a vitest test.
// Run `npm run links:check`. Exits 1 on breakage.
//
// Reads spec/catalog.json + spec/event-categories.json directly — no
// dependency on either language's build output. The event-table specUrl is
// a deterministic function of the wire type and its category (verified
// against the generated event-table.ts when spec/event-categories.json was
// introduced), so this needs no SDK, zod, or pydantic introspection either.

import { readFileSync } from "node:fs"

const EVENTS_DOC = "https://docs.ag-ui.com/concepts/events"

const catalog = JSON.parse(readFileSync(new URL("../spec/catalog.json", import.meta.url), "utf8"))
const eventCategories = JSON.parse(
  readFileSync(new URL("../spec/event-categories.json", import.meta.url), "utf8"),
)

function eventSpecUrl(wireType, category) {
  if (category === "thinking") return `${EVENTS_DOC}#thinking-events-deprecated`
  const anchor = wireType.toLowerCase().replace(/_/g, "")
  return `${EVENTS_DOC}#${anchor}`
}

const urls = new Set(catalog.rules.map((r) => r.specUrl))
for (const [wireType, category] of Object.entries(eventCategories.eventCategory)) {
  urls.add(eventSpecUrl(wireType, category))
}
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
