import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const read = async (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8")

test("Community moderation stacks duplicate reports and prioritizes report count then recency", async () => {
  const route = await read("app/api/admin/community/reports/route.ts")
  const client = await read("components/admin/community-moderation-client.tsx")
  const action = await read("app/api/admin/community/reports/[reportId]/route.ts")
  assert.match(route, /const groupedRows = new Map<string, ReportRow\[]>\(\)/)
  assert.match(route, /if \(b\.reportCount !== a\.reportCount\) return b\.reportCount - a\.reportCount/)
  assert.match(route, /new Date\(b\.createdAt\)\.getTime\(\) - new Date\(a\.createdAt\)\.getTime\(\)/)
  assert.match(client, /×\{report\.reportCount\}/)
  assert.match(action, /closeSiblingOpenReports/)
})

test("official Tellwise Community account gets a server-authenticated verified badge", async () => {
  const helper = await read("lib/community/verified.ts")
  const feed = await read("app/api/community/feed/route.ts")
  const client = await read("components/community/community-client.tsx")
  assert.match(helper, /STORYTUNER_OWNER_USER_ID/)
  assert.match(feed, /verified: isVerifiedTellwiseUser\(post\.author_id\)/)
  assert.match(client, /Verified Tellwise account/)
})

test("Parch accepts normal larger history envelopes but clamps model context server-side", async () => {
  const route = await read("app/api/coach/route.ts")
  const client = await read("components/coach/coach-client.tsx")
  assert.match(route, /\.strict\(\)\)\.max\(40\)/)
  assert.match(route, /\.slice\(-12\)/)
  assert.match(route, /content: item\.content\.slice\(0, 5000\)/)
  assert.match(client, /safeMessages\s*\.slice\(-10\)/)
})

test("dialogs also blur the fixed bottom navigation", async () => {
  const css = await read("app/globals.css")
  assert.match(css, /body:has\(\.app-dialog-overlay\) \.book-bottom-nav/)
  assert.match(css, /filter: blur\(3px\)/)
})
