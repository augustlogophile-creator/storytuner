import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("Coach retries can replay a saved answer before calling OpenAI", () => {
  const source = read("app/api/coach/route.ts")
  const replay = source.indexOf('.from("coach_exchanges")')
  const ai = source.indexOf("openAIText(")
  assert.ok(replay >= 0 && ai > replay)
  assert.match(source, /replayed: true/)
})

test("Coach history loads the newest archive window", () => {
  const source = read("app/api/coach/history/route.ts")
  assert.match(source, /order\("created_at", \{ ascending: false \}\)/)
  assert.match(source, /\.limit\(30\)/)
})

test("Planner protects accidental duplicate generation", () => {
  const source = read("app/api/planner/route.ts")
  assert.match(source, /duplicateCutoff/)
  assert.match(source, /replayed: true/)
  assert.ok(source.indexOf("recentDuplicate") < source.indexOf("openAIJson<StoryPlanOutput>"))
})

test("Community feed groups replies instead of filtering the whole reply list per post", () => {
  const source = read("app/api/community/feed/route.ts")
  assert.match(source, /repliesByPost/)
  assert.doesNotMatch(source, /visibleReplyRows\.filter\(\(reply\) => reply\.post_id === postId\)/)
})

test("Community reply like counts do not fetch every liker user id", () => {
  const source = read("app/api/community/posts/[postId]/replies/route.ts")
  assert.doesNotMatch(source, /select\("reply_id, user_id"\)/)
  assert.match(source, /viewerLikesResult/)
})

test("deleted Community posts have a defined retention purge", () => {
  const source = read("lib/maintenance.ts")
  assert.match(source, /DELETED_COMMUNITY_RETENTION_MS = 30 \* DAY_MS/)
  assert.match(source, /deletedCommunityPostsPurged/)
})

test("JSON body protection checks actual bytes, not only Content-Length", () => {
  const source = read("lib/request-protection.ts")
  assert.match(source, /new TextEncoder\(\)\.encode\(text\)\.byteLength/)
  assert.match(source, /REQUEST_TOO_LARGE/)
})

test("Stripe failures are not echoed directly from upstream checkout errors", () => {
  const source = read("app/api/stripe/checkout/route.ts")
  assert.doesNotMatch(source, /error instanceof Error \? error\.message/)
  assert.match(source, /could not start checkout right now/i)
})

test("account data reset tolerates absent optional feature resources", async () => {
  const source = await read("app/api/account/data/route.ts")
  assert.match(source, /deleteOptionalRows\(admin, "coach_exchanges"/)
  assert.match(source, /deleteOptionalRows\(admin, "story_plans"/)
  assert.match(source, /isMissingResourceError/)
  assert.match(source, /isMissingBucketError/)
})

test("account data reset self-identifies the failing cleanup stage", () => {
  const source = read("app/api/account/data/route.ts")
  assert.match(source, /let failedStep = "starting"/)
  assert.match(source, /failedStep = "community_content"/)
  assert.match(source, /failedStep,\n\s*error:/)
  assert.match(source, /listUserStoragePaths\(admin, RECORDINGS_BUCKET, userId\)/)
  assert.doesNotMatch(source, /safeListUserStoragePaths/)
  assert.match(source, /account_data_profile_reset_skipped/)
})
