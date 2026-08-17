import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

function routeFiles(dir = path.join(root, "app/api")) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name === "route.ts" ? [full] : []
  })
}

test("all browser mutation routes have same-origin protection", () => {
  const exceptions = new Set([
    path.join(root, "app/api/stripe/webhook/route.ts"),
    path.join(root, "app/api/cron/maintenance/route.ts"),
  ])
  for (const file of routeFiles()) {
    const source = fs.readFileSync(file, "utf8")
    if (!/export async function (POST|PATCH|DELETE)\b/.test(source) || exceptions.has(file)) continue
    assert.match(source, /requireSameOrigin\(/, path.relative(root, file))
  }
})

test("privileged Supabase client is server-only and never imported by components", () => {
  assert.match(read("lib/supabase/admin.ts"), /^import "server-only"/)
  const componentRoot = path.join(root, "components")
  const stack = [componentRoot]
  while (stack.length) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = fs.readFileSync(full, "utf8")
        assert.doesNotMatch(source, /createAdminClient|SUPABASE_SERVICE_ROLE_KEY/, path.relative(root, full))
      }
    }
  }
})

test("maintenance cron requires CRON_SECRET bearer authentication", () => {
  const source = read("app/api/cron/maintenance/route.ts")
  assert.match(source, /process\.env\.CRON_SECRET/)
  assert.match(source, /timingSafeEqual\(secret, supplied\)/)
  assert.doesNotMatch(source, /user-agent.*vercel-cron/i)
})

test("configured Stripe price gates membership", () => {
  const source = read("lib/membership-server.ts")
  assert.match(source, /process\.env\.STRIPE_PRICE_ID/)
  assert.match(source, /row\.stripe_price_id !== expectedPriceId/)
})

test("security headers are configured globally", () => {
  const source = read("next.config.mjs")
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "X-Frame-Options", "Permissions-Policy"]) {
    assert.match(source, new RegExp(header))
  }
})

test("Stripe webhook verifies its signature before parsing the event", () => {
  const source = read("app/api/stripe/webhook/route.ts")
  const verifyIndex = source.indexOf("verifyStripeSignature")
  const parseIndex = source.indexOf("JSON.parse(rawBody)")
  assert.ok(verifyIndex >= 0 && parseIndex > verifyIndex)
})

test("account data reset preserves billing, usage-limit and safety records", () => {
  const source = read("app/api/account/data/route.ts")
  assert.doesNotMatch(source, /from\("subscriptions"\)\.delete/)
  assert.doesNotMatch(source, /from\("user_usage_events"\)\.delete/)
  assert.doesNotMatch(source, /from\("community_moderation_actions"\)\.delete/)
  assert.doesNotMatch(source, /from\("community_moderation_status"\)\.delete/)
})
