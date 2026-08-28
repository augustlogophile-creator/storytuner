import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

test("deleted emails have a server-only 14-day re-registration cooldown", () => {
  const migration = read("supabase/migrations/202608270001_account_deletion_cooldown.sql")
  const deleteRoute = read("app/api/account/delete/route.ts")
  const callback = read("app/auth/callback/route.ts")
  const helper = read("lib/account-deletion-cooldown.ts")

  assert.match(migration, /create table if not exists public\.account_deletion_cooldowns/)
  assert.match(migration, /revoke all on table public\.account_deletion_cooldowns from public, anon, authenticated/)
  assert.match(migration, /grant select, insert, update, delete on table public\.account_deletion_cooldowns to service_role/)
  assert.match(helper, /ACCOUNT_DELETION_COOLDOWN_DAYS = 14/)
  assert.match(helper, /createHmac\("sha256"/)
  assert.match(helper, /googlemail\.com/)
  assert.match(deleteRoute, /createAccountDeletionCooldown\(admin, verifiedEmail\)/)
  assert.match(callback, /getAccountDeletionCooldown\(admin, userData\.user\.email/)
  assert.match(callback, /admin\.auth\.admin\.deleteUser\(userData\.user\.id\)/)
})

test("new public identity requires both an immutable username and moderated display name", () => {
  const client = read("components/auth/choose-username.tsx")
  const setup = read("app/api/account/setup/route.ts")
  const profile = read("app/profile/page.tsx")

  assert.match(client, /Choose a permanent username and a display name you can change later/)
  assert.match(client, /cannot be changed later/)
  assert.match(client, /can change this later in Settings/)
  assert.match(client, /JSON\.stringify\(\{ username, displayName, confirmedAge13Plus: true \}\)/)
  assert.match(setup, /validateDisplayName\(displayName\)/)
  assert.match(setup, /moderateCommunityText\(`Public display name:/)
  assert.match(setup, /checkUsernameSafety\(username/)
  assert.doesNotMatch(profile, /user_metadata/)
  assert.doesNotMatch(profile, /createAdminClient/)
})

test("hateful usernames have explicit safety rejection rather than availability wording", () => {
  const names = read("lib/profile/public-name.ts")
  const moderation = read("lib/profile/username-moderation.ts")

  assert.match(names, /"fascist"/)
  assert.match(names, /hateful, racist, sexual, vulgar, threatening, or harassing content/)
  assert.match(moderation, /hateful, racist, sexual, vulgar, threatening, or harassing content/)
})

test("logout and deletion do not replay the introduction by default", () => {
  const rootPage = read("app/page.tsx")
  const settings = read("components/profile/settings-client.tsx")
  const history = read("lib/intro-history.ts")
  const authShell = read("components/auth/auth-shell.tsx")

  assert.match(rootPage, /INTRO_SEEN_COOKIE/)
  assert.match(rootPage, /redirect\("\/sign-up\?mode=sign-in"\)/)
  assert.match(settings, /router\.replace\(`\/sign-up\?mode=sign-in&accountDeleted=1/)
  assert.match(settings, /markIntroSeen\(\)/)
  assert.match(history, /tellwise_intro_seen/)
  assert.match(authShell, /replay=1/)
})

test("failed login intent cannot leave behind an OAuth-created auth-only account", () => {
  const callback = read("app/auth/callback/route.ts")
  assert.match(callback, /auth_signin_orphan_cleanup_failed/)
  assert.match(callback, /admin\.auth\.admin\.deleteUser\(userData\.user\.id\)/)
})

test("username immutability is enforced by both the setup route and database trigger", () => {
  const setup = read("app/api/account/setup/route.ts")
  const migration = read("supabase/migrations/202608270003_username_immutability.sql")

  assert.match(setup, /USERNAME_IMMUTABLE/)
  assert.match(setup, /username is permanent and cannot be changed/)
  assert.match(migration, /before update of username on public\.profiles/)
  assert.match(migration, /old\.username is distinct from new\.username/)
})

test("free Story Planner usage survives content deletion and is server-owned", () => {
  const planner = read("app/api/planner/route.ts")
  const usage = read("lib/usage-server.ts")
  const migration = read("supabase/migrations/202608270002_planner_usage_hardening.sql")
  const dataDelete = read("app/api/account/data/route.ts")

  assert.match(usage, /story_planner: 1/)
  assert.match(planner, /getUsageStatus\(auth\.user\.id, "story_planner"\)/)
  assert.match(planner, /reserveUsage\(auth\.user\.id, "story_planner"/)
  assert.match(planner, /releaseUsage\(auth\.user\.id, "story_planner"/)
  assert.doesNotMatch(planner, /freePlanCountError/)
  assert.match(migration, /feature in \('coach_message', 'arena_review', 'story_planner'\)/)
  assert.match(migration, /p_feature = 'story_planner'/)
  assert.doesNotMatch(dataDelete, /deleteRequiredRows\(admin, "user_usage_events"/)
  assert.doesNotMatch(dataDelete, /deleteOptionalRows\(admin, "user_usage_events"/)
})

test("account data deletion fails closed if storage enumeration fails", () => {
  const dataDelete = read("app/api/account/data/route.ts")
  assert.match(dataDelete, /listUserStoragePaths\(admin, RECORDINGS_BUCKET, userId\)/)
  assert.match(dataDelete, /listUserStoragePaths\(admin, COMMUNITY_AUDIO_BUCKET, userId\)/)
  assert.doesNotMatch(dataDelete, /safeListUserStoragePaths/)
  assert.match(dataDelete, /if \(error\) \{[\s\S]*throw error/)
})
