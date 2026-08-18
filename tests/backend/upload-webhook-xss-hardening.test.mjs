import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

test("recording uploads use magic-byte checks and generated object names", () => {
  const direct = read("app/api/transcribe/route.ts")
  const cloud = read("lib/recording-cloud.ts")
  const edge = read("supabase/functions/transcribe-recording/index.ts")
  const share = read("app/api/community/share-recording/route.ts")

  assert.match(direct, /blobHasValidAudioSignature/)
  assert.match(direct, /Content-Length header is required/)
  assert.match(cloud, /blobHasValidAudioSignature/)
  assert.match(cloud, /crypto\.randomUUID\(\)/)
  assert.match(cloud, /storagePath = `\$\{user\.id\}\/\$\{id\}\./)
  assert.match(edge, /audioSignatureMatches/)
  assert.match(edge, /recording\.size_bytes/)
  assert.match(edge, /`recording-\$\{recordingId\}\./)
  assert.match(share, /audioSignatureMatches/)
  assert.match(share, /communityPath = `\$\{context\.userId\}\/\$\{post\.id\}\./)
})

test("recording storage remains private, size-bounded, and MIME-restricted", () => {
  const migration = read("supabase/migrations/202607170001_recording_storage.sql")
  const hardening = read("supabase/migrations/202608160002_security_hardening.sql")
  assert.match(migration, /false,\s*26214400,/s)
  assert.match(migration, /allowed_mime_types/)
  assert.match(hardening, /set public = false/)
  assert.match(hardening, /storytuner-recordings/)
  assert.match(hardening, /storytuner-community-audio/)
})

test("Stripe webhook uses env secret, timestamp tolerance, and verifies before JSON parsing", () => {
  const route = read("app/api/stripe/webhook/route.ts")
  const stripe = read("lib/stripe-rest.ts")
  assert.match(route, /process\.env\.STRIPE_WEBHOOK_SECRET/)
  assert.doesNotMatch(route, /whsec_[A-Za-z0-9]+/)
  const verifyIndex = route.indexOf("verifyStripeSignature")
  const parseIndex = route.indexOf("JSON.parse(rawBody)")
  assert.ok(verifyIndex >= 0 && parseIndex > verifyIndex)
  assert.match(stripe, /age > 300/)
  assert.match(stripe, /timingSafeEqual/)
})

test("client code cannot directly grant an active subscription", () => {
  const clientRoots = [path.join(root, "components"), path.join(root, "app")]
  for (const file of clientRoots.flatMap((dir) => walk(dir)).filter((file) => /\.(?:ts|tsx)$/.test(file))) {
    const source = fs.readFileSync(file, "utf8")
    if (!source.includes('"use client"')) continue
    assert.doesNotMatch(source, /from\(["']subscriptions["']\)\s*\.\s*(?:insert|update|upsert|delete)/, path.relative(root, file))
  }
})

test("user-facing React code has no raw HTML execution sinks", () => {
  for (const file of [path.join(root, "app"), path.join(root, "components"), path.join(root, "lib")]
    .flatMap((dir) => walk(dir))
    .filter((file) => /\.(?:ts|tsx)$/.test(file))) {
    const source = fs.readFileSync(file, "utf8")
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(/, path.relative(root, file))
  }
})

test("publicly rendered user text gets a server-side plain-text sanitation layer", () => {
  for (const file of [
    "app/api/community/posts/route.ts",
    "app/api/community/posts/[postId]/replies/route.ts",
    "app/api/community/posts/[postId]/route.ts",
    "app/api/community/replies/[replyId]/route.ts",
    "app/api/community/share-recording/route.ts",
    "app/api/community/reports/route.ts",
    "app/api/account/profile/route.ts",
    "app/api/account/setup/route.ts",
    "app/api/ai/report/route.ts",
    "app/api/coach/route.ts",
    "app/api/planner/route.ts",
  ]) {
    assert.match(read(file), /sanitizePlainText/, file)
  }
})

test("CSP blocks inline script attributes as an additional XSS layer", () => {
  assert.match(read("next.config.mjs"), /script-src-attr 'none'/)
})
