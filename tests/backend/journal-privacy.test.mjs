import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

test("Journal written entries are owner-scoped with RLS and no anonymous grants", () => {
  const sql = read("supabase/migrations/202608200001_journal_entries.sql")
  assert.match(sql, /alter table public\.journal_entries enable row level security/i)
  assert.match(sql, /revoke all on table public\.journal_entries from public, anon/i)
  assert.match(sql, /using \(\(select auth\.uid\(\)\) = user_id\)/i)
  assert.match(sql, /with check \([\s\S]*auth\.uid\(\)[\s\S]*= user_id/i)
})

test("Journal does not import Studio recording history", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.doesNotMatch(client, /listCloudRecordingHistory/)
  assert.doesNotMatch(client, /createSignedCloudRecordingUrl/)
  assert.doesNotMatch(client, /Your saved Studio recordings appear here automatically/)
})

test("Journal voice notes stay in Journal and use the hardened temporary recording pipeline", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.match(client, /uploadAndTranscribeRecording/)
  assert.match(client, /deleteCloudRecording/)
  assert.match(client, /Record a quick thought/)
  assert.doesNotMatch(client, /href="\/studio\?mode=free"/)
  assert.doesNotMatch(client, /\.storage\s*\.\s*from\(/)
})

test("Journal editor autosaves drafts and keeps a local recovery copy", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.match(client, /setTimeout\(\(\) => \{\s*void saveNow\(title, body\)\s*\}, 900\)/)
  assert.match(client, /localStorage\.setItem/)
  assert.match(client, /journal-save-status/)
})

test("Intro canvas always paints paper behind the standalone hardcover", () => {
  const css = read("app/globals.css")
  assert.match(css, /\.book-intro-canvas,\s*\.book-intro-canvas\.is-cover[\s\S]*background:\s*#fffefa\s*!important/i)
  assert.match(css, /\.book-standalone-cover[\s\S]*transition-duration:\s*780ms\s*!important/i)
})
