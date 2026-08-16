import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("new Google accounts are forced through username setup", () => {
  const callback = read("app/auth/callback/route.ts")
  assert.match(callback, /\/choose-username/)
  assert.match(callback, /hasUsername/)
  assert.match(callback, /profile\?\.onboarding_completed && hasUsername/)
})

test("signed-in pages redirect username-less accounts before normal onboarding", () => {
  const auth = read("lib/require-auth.ts")
  const usernameGate = auth.indexOf("!profile?.username?.trim()")
  const onboardingGate = auth.indexOf("!profile?.onboarding_completed", usernameGate)
  assert.ok(usernameGate >= 0)
  assert.ok(onboardingGate > usernameGate)
  assert.match(auth, /redirect\(`\/choose-username\?next=/)
})

test("important authenticated APIs reject accounts that have not completed username setup", () => {
  const auth = read("lib/require-auth.ts")
  assert.match(auth, /USERNAME_SETUP_REQUIRED/)
  assert.match(auth, /ACCOUNT_SETUP_REQUIRED/)

  for (const file of [
    "app/api/coach/route.ts",
    "app/api/transcribe/route.ts",
    "app/api/feedback/route.ts",
    "app/api/usage/route.ts",
    "app/api/planner/route.ts",
    "app/api/stripe/checkout/route.ts",
    "app/api/ai/report/route.ts",
  ]) {
    const source = read(file)
    assert.match(source, /getActiveAuthenticatedUser/)
  }
})

test("username claims are server-side, same-origin protected, moderated and user-bound", () => {
  const route = read("app/api/account/setup/route.ts")
  assert.match(route, /requireSameOrigin\(request\)/)
  assert.match(route, /getAuthenticatedUser\(\)/)
  assert.match(route, /checkUsernameSafety\(username\)/)
  assert.match(route, /id:\s*auth\.id/)
  assert.doesNotMatch(route, /body\.(?:userId|user_id)/)
  assert.match(route, /createAdminClient\(\)/)
})

test("database migration prevents browser clients from bypassing username claiming", () => {
  const migration = read("supabase/migrations/202608160001_mandatory_google_usernames.sql")
  assert.match(migration, /revoke insert, update on table public\.profiles from authenticated/i)
  assert.match(migration, /grant update \(display_name, ai_personalization_enabled\)/i)
  assert.match(migration, /char_length\(username\) between 3 and 20/i)
  assert.match(migration, /profiles_username_reserved/)
})

test("public Community identity prefers usernames and never falls back to display name", () => {
  const community = read("components/community/community-client.tsx")
  const label = community.slice(community.indexOf("function publicAuthorLabel"), community.indexOf("function rankPosts"))
  assert.match(label, /return `@\$\{username\}`/)
  assert.doesNotMatch(label, /author\.displayName/)
})
