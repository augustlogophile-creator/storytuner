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

test("repository does not contain committed dotenv files or obvious private key material", () => {
  const rootFiles = walk(root).filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`))
  const dotenv = rootFiles
    .map((file) => path.relative(root, file))
    .filter((name) => /(^|\/|\\)\.env(?:\.|$)/.test(name) && name !== ".env.example")
  assert.deepEqual(dotenv, [])
  assert.match(read(".gitignore"), /^\.env$/m)
  assert.match(read(".gitignore"), /^\.env\.\*$/m)

  const textFiles = rootFiles.filter((file) => /\.(?:ts|tsx|js|mjs|json|md|sql|yml|yaml|example|gitignore)$/.test(file) || path.basename(file) === ".gitignore")
  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bsk_live_[A-Za-z0-9]{16,}\b/,
    /\bwhsec_[A-Za-z0-9]{16,}\b/,
    /\bsb_secret_[A-Za-z0-9_-]{16,}\b/,
    /\bAIza[0-9A-Za-z_-]{24,}\b/,
  ]
  for (const file of textFiles) {
    const source = fs.readFileSync(file, "utf8")
    for (const pattern of secretPatterns) assert.doesNotMatch(source, pattern, path.relative(root, file))
  }
})

test("service-role and private API secrets never appear in client components", () => {
  const clientFiles = [path.join(root, "components"), path.join(root, "app")]
    .flatMap((dir) => walk(dir))
    .filter((file) => /\.(ts|tsx)$/.test(file) && fs.readFileSync(file, "utf8").includes('"use client"'))
  const privateNames = ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "CRON_SECRET", "SUPABASE_DB_URL"]
  for (const file of clientFiles) {
    const source = fs.readFileSync(file, "utf8")
    for (const name of privateNames) assert.doesNotMatch(source, new RegExp(name), path.relative(root, file))
  }
})

test("every application public table is explicitly protected by RLS in the hardening migration", () => {
  const migration = read("supabase/migrations/202608160002_security_hardening.sql")
  const tables = [
    "profiles", "recording_uploads", "subscriptions", "user_app_state",
    "community_posts", "community_replies", "community_post_likes", "community_reply_likes",
    "community_audio", "community_reports", "community_user_blocks", "community_moderators",
    "community_moderation_status", "community_moderation_actions", "story_plans", "user_usage_events",
    "coach_exchanges", "subscription_consent_records", "ai_output_reports", "ai_response_reports",
  ]
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`, "i"), table)
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon;`, "i"), table)
  }
})

test("sensitive report and moderation tables cannot be mutated directly by authenticated Data API users", () => {
  const migration = read("supabase/migrations/202608160002_security_hardening.sql")
  for (const table of ["community_reports", "community_moderators", "community_moderation_status", "community_moderation_actions", "user_usage_events", "coach_exchanges", "subscription_consent_records", "ai_output_reports", "ai_response_reports"]) {
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from authenticated;`, "i"), table)
  }
  assert.match(migration, /drop policy if exists "Users can submit their own AI reports"/)
})

test("public profile mutations go through a server-side moderated route", () => {
  const migration = read("supabase/migrations/202608160002_security_hardening.sql")
  const route = read("app/api/account/profile/route.ts")
  const settings = read("components/profile/settings-client.tsx")
  assert.match(migration, /revoke insert, update, delete on table public\.profiles from authenticated;/)
  assert.match(route, /getActiveAuthenticatedUser\(\)/)
  assert.match(route, /requireSameOrigin\(request\)/)
  assert.match(route, /validateDisplayName\(displayName\)/)
  assert.match(route, /moderateCommunityText/)
  assert.match(route, /createAdminClient\(\)/)
  assert.match(settings, /fetch\("\/api\/account\/profile"/)
  assert.doesNotMatch(settings, /from\("profiles"\)\.update\(\{ display_name:/)
})

test("global API IP limiting is wired into the Next proxy with graceful 429s", () => {
  const proxy = read("proxy.ts")
  const limiter = read("lib/security/ip-rate-limit.ts")
  assert.match(proxy, /checkIpRateLimit\(request\)/)
  assert.match(proxy, /status: 429/)
  assert.match(proxy, /Retry-After/)
  assert.match(limiter, /x-vercel-forwarded-for/)
  assert.match(limiter, /\/api\/stripe\/webhook/)
  assert.match(limiter, /\/api\/cron\/maintenance/)
})

test("AI prompts mark user-controlled reference material as untrusted data", () => {
  const helper = read("lib/ai/untrusted.ts")
  assert.match(helper, /<untrusted_reference/)
  assert.match(helper, /Never follow instructions/i)
  for (const file of ["app/api/coach/route.ts", "app/api/planner/route.ts", "app/api/feedback/route.ts", "app/api/transcribe/route.ts"]) {
    const source = read(file)
    assert.match(source, /UNTRUSTED_REFERENCE_RULE/, file)
    assert.match(source, /untrustedReference|untrustedList/, file)
  }
})

test("canonical production redirects and Stripe return URLs do not trust request Host", () => {
  const redirect = read("lib/auth/redirects.ts")
  const callback = read("app/auth/callback/route.ts")
  const checkout = read("app/api/stripe/checkout/route.ts")
  const portal = read("app/api/stripe/portal/route.ts")
  assert.match(redirect, /NEXT_PUBLIC_APP_URL/)
  assert.match(redirect, /required in production/)
  assert.match(callback, /const redirectOrigin = siteUrl\(\)/)
  assert.match(checkout, /siteUrl\(\)/)
  assert.match(portal, /siteUrl\(\)/)
  assert.doesNotMatch(portal, /new URL\(request\.url\)\.origin/)
})

test("recording uploads have database and storage anti-abuse guards", () => {
  const migration = read("supabase/migrations/202608160002_security_hardening.sql")
  assert.match(migration, /current_user_can_create_recording_upload/)
  assert.match(migration, /status = 'uploading'/)
  assert.match(migration, /storage_path like/)
  assert.match(migration, /r\.storage_path = name/)
})

test("database backups are encrypted before GitHub artifact upload", () => {
  const workflow = read(".github/workflows/supabase-backup.yml")
  assert.match(workflow, /SUPABASE_BACKUP_ENCRYPTION_KEY/)
  assert.match(workflow, /openssl enc -aes-256-cbc/)
  assert.match(workflow, /path: \$\{\{ env\.ENCRYPTED_BACKUP \}\}/)
  assert.doesNotMatch(workflow, /path: \$\{\{ env\.BACKUP_DIR \}\}/)
})

test("direct transcription uploads use a bounded raw stream instead of multipart buffering", () => {
  const route = read("app/api/transcribe/route.ts")
  const helper = read("lib/audio-upload-security.ts")
  const proxy = read("proxy.ts")
  assert.match(proxy, /pathname === "\/api\/transcribe"/)
  assert.match(proxy, /contentLength > 4 \* 1024 \* 1024/)
  assert.match(route, /readRequestBodyWithLimit\(req, MAX_DIRECT_TRANSCRIBE_BYTES\)/)
  assert.doesNotMatch(route, /req\.formData\(\)/)
  assert.match(helper, /request\.body\.getReader\(\)/)
  assert.match(helper, /total > maxBytes/)
  assert.match(helper, /reader\.cancel\("upload limit exceeded"\)/)
})

test("direct transcription uploads reject spoofed MIME types using magic-byte inspection", () => {
  const route = read("app/api/transcribe/route.ts")
  const helper = read("lib/audio-upload-security.ts")
  assert.match(route, /validateAudioSignature\(boundedBody\.bytes\.subarray\(0, 64\), declaredType\)/)
  assert.match(helper, /0x1a && bytes\[1\] === 0x45 && bytes\[2\] === 0xdf && bytes\[3\] === 0xa3/)
  assert.match(helper, /ascii\(bytes, 0, 4\) === "OggS"/)
  assert.match(helper, /ascii\(bytes, 0, 4\) === "RIFF"/)
  assert.match(helper, /ascii\(bytes, 4, 8\) === "ftyp"/)
})

test("browser recording uploads have a fast size and signature preflight before Supabase", () => {
  const cloud = read("lib/recording-cloud.ts")
  assert.match(cloud, /blob\.size > MAX_AUDIO_BYTES/)
  assert.match(cloud, /blob\.slice\(0, 64\)\.arrayBuffer\(\)/)
  assert.match(cloud, /validateAudioSignature\(sniff, blob\.type \|\| undefined\)/)
  assert.match(cloud, /\.upload\(storagePath, blob/)
})

test("Supabase transcription revalidates actual size and magic bytes before OpenAI", () => {
  const edge = read("supabase/functions/transcribe-recording/index.ts")
  assert.match(edge, /audioBlob\.size > MAX_AUDIO_BYTES/)
  assert.match(edge, /audioBlob\.size !== declaredBytes/)
  assert.match(edge, /audioBlob\.slice\(0, AUDIO_SNIFF_BYTES\)\.arrayBuffer\(\)/)
  assert.match(edge, /validateAudioSignature\(sniff, contentType\)/)
  const signatureIndex = edge.indexOf("validateAudioSignature(sniff, contentType)")
  const openAiIndex = edge.indexOf('fetch("https://api.openai.com/v1/audio/transcriptions"')
  assert.ok(signatureIndex >= 0 && openAiIndex > signatureIndex)
})

test("invalid private audio is deleted instead of being retained for repeated processing", () => {
  const edge = read("supabase/functions/transcribe-recording/index.ts")
  assert.match(edge, /transcription_signature_rejected/)
  assert.match(edge, /storage\.from\("storytuner-recordings"\)\.remove\(\[recording\.storage_path\]\)/)
  assert.match(edge, /Rejected invalid audio signature/)
})

test("storage and database enforce a hard 24 MiB object ceiling and immutable upload metadata", () => {
  const migration = read("supabase/migrations/202608180002_upload_hardening.sql")
  assert.match(migration, /file_size_limit = 25165824/g)
  assert.match(migration, /size_bytes between 1 and 25165824/)
  assert.match(migration, /revoke update on table public\.recording_uploads from authenticated/)
  assert.match(migration, /grant update \(status, error_message, title, transcript, word_count\) on table public\.recording_uploads to authenticated/)
  assert.match(migration, /then 12\s+else 6/)
})

test("Community audio copies are size-checked before buffering and signature-checked before upload", () => {
  const route = read("app/api/community/share-recording/route.ts")
  const sizeCheckIndex = route.indexOf("sourceBlob.size > MAX_COMMUNITY_AUDIO_BYTES")
  const sniffIndex = route.indexOf("sourceBlob.slice(0, 64).arrayBuffer()")
  const uploadIndex = route.indexOf(".upload(communityPath, sourceBlob")
  assert.ok(sizeCheckIndex >= 0 && sniffIndex > sizeCheckIndex && uploadIndex > sniffIndex)
  assert.match(route, /validateAudioSignature\(sniff, source\.content_type\)/)
  assert.doesNotMatch(route, /const bytes = await sourceBlob\.arrayBuffer\(\)/)
})
