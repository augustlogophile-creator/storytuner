import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("AI spend guard is durable, server-only and race-safe", () => {
  const migration = read("supabase/migrations/202608190001_ai_spend_events.sql")
  assert.match(migration, /create table if not exists public\.ai_spend_events/)
  assert.match(migration, /alter table public\.ai_spend_events enable row level security/)
  assert.match(migration, /revoke all on table public\.ai_spend_events from public, anon, authenticated/)
  assert.match(migration, /grant execute on function public\.reserve_tellwise_ai_spend[\s\S]*to service_role/)
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended/)
  assert.match(migration, /v_minute_count >= p_minute_limit/)
  assert.match(migration, /v_hour_count >= p_hour_limit/)
  assert.match(migration, /v_day_count >= p_day_limit/)
})

test("all previously in-memory-only AI generation branches reserve durable spend", () => {
  const feedback = read("app/api/feedback/route.ts")
  const planner = read("app/api/planner/route.ts")
  assert.match(feedback, /reserveAiSpend\(user\.id, "lesson_feedback"/)
  assert.match(feedback, /reserveAiSpend\(user\.id, "checkpoint_feedback"/)
  assert.match(feedback, /reserveAiSpend\(user\.id, "written_story_feedback"/)
  assert.match(planner, /reserveAiSpend\(auth\.user\.id, "story_planner"/)
  assert.match(feedback, /written_story_feedback", \{ minute: 3, hour: 10, day: 25 \}/)
})

test("same-origin mutation protection now fails closed and rejects same-site sibling origins", () => {
  const source = read("lib/request-protection.ts")
  assert.match(source, /if \(fetchSite !== "same-origin"\) return crossSiteResponse\(\)/)
  assert.doesNotMatch(source, /\["same-origin",\s*"same-site"/)
  assert.match(source, /new URL\(origin\)\.origin !== requestOrigin/)
})

test("production CSP uses per-request nonces instead of unsafe-inline scripts", () => {
  const proxy = read("proxy.ts")
  const config = read("next.config.mjs")
  assert.match(proxy, /nonce-\$\{nonce\}/)
  assert.match(proxy, /'strict-dynamic'/)
  const scriptLine = proxy.split("\n").find((line) => line.includes("script-src")) || ""
  assert.doesNotMatch(scriptLine, /unsafe-inline/)
  assert.match(proxy, /forwardedHeaders\.set\("Content-Security-Policy", csp\)/)
  assert.match(proxy, /response\.headers\.set\("Content-Security-Policy", csp\)/)
  assert.doesNotMatch(config, /script-src[^\n]*unsafe-inline/)
})

test("restricted accounts cannot self-delete to erase moderation state", () => {
  const source = read("app/api/account/delete/route.ts")
  assert.match(source, /getAccountRestriction\(authenticated\.id\)/)
  assert.match(source, /restriction\.lookupFailed/)
  assert.match(source, /restriction\.restricted/)
  assert.match(source, /RESTRICTED_ACCOUNT_DELETE_BLOCKED/)
})

test("transcription Edge Function fails closed on moderation and origin checks", () => {
  const edge = read("supabase/functions/transcribe-recording/index.ts")
  assert.match(edge, /transcription_restriction_lookup_failed/)
  assert.match(edge, /ACCOUNT_STATUS_UNAVAILABLE/)
  assert.match(edge, /return Boolean\(origin && allowedOrigins\(\)\.has\(origin\)\)/)
  assert.match(edge, /STORYTUNER_ALLOW_LOCALHOST_ORIGIN.*=== "true"/s)
  const defaultsStart = edge.indexOf("const DEFAULT_ALLOWED_ORIGINS")
  const defaultsEnd = edge.indexOf("]);", defaultsStart) + 3
  const defaults = edge.slice(defaultsStart, defaultsEnd)
  assert.doesNotMatch(defaults, /localhost/)
})

test("production IP rate keys do not use spoofable browser headers as identity", () => {
  const source = read("lib/security/ip-rate-limit.ts")
  assert.match(source, /x-vercel-forwarded-for/)
  assert.match(source, /process\.env\.NODE_ENV === "production"/)
  assert.match(source, /missing-vercel-client-ip/)
  assert.doesNotMatch(source, /headers\.get\("user-agent"\)/)
  assert.doesNotMatch(source, /headers\.get\("accept-language"\)/)
})
