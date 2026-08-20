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
})

test("Journal media stays in a private size-bounded owner folder", () => {
  const sql = read("supabase/migrations/202608200002_journal_media.sql")
  assert.match(sql, /'tellwise-journal-media'[\s\S]*false[\s\S]*20971520/i)
  assert.match(sql, /bucket_id = 'tellwise-journal-media'/i)
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/i)
  assert.match(sql, /journal_entries j[\s\S]*j\.media_storage_path = name/i)
})

test("Journal media uses generated names and content sniffing before private upload", () => {
  const media = read("lib/journal-media.ts")
  assert.match(media, /crypto\.randomUUID\(\)/)
  assert.match(media, /blob\.slice\(0, 64\)\.arrayBuffer\(\)/)
  assert.match(media, /MAX_JOURNAL_MEDIA_BYTES = 20 \* 1024 \* 1024/)
  assert.match(media, /\.from\(JOURNAL_MEDIA_BUCKET\)[\s\S]*\.upload\(storagePath, blob/)
})

test("Journal does not import Studio recording history", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.doesNotMatch(client, /listCloudRecordingHistory/)
  assert.doesNotMatch(client, /createSignedCloudRecordingUrl/)
  assert.doesNotMatch(client, /Your saved Studio recordings appear here automatically/)
})

test("Journal groups notes like a notes app and supports text, audio, and video creation", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.match(client, /Previous 30 Days/)
  assert.match(client, /setCaptureKind\("audio"\)/)
  assert.match(client, /setCaptureKind\("video"\)/)
  assert.match(client, /startNewText\(\)/)
  assert.doesNotMatch(client, /href="\/studio\?mode=free"/)
})

test("Journal editor autosaves drafts and keeps a local recovery copy", () => {
  const client = read("components/journal/journal-client.tsx")
  assert.match(client, /setTimeout\(\(\) => void saveNow\(title, body\), 850\)/)
  assert.match(client, /localStorage\.setItem/)
  assert.match(client, /journal-save-status/)
})

test("Saved planner work lives on a dedicated page instead of inline on the builder", () => {
  const planner = read("components/planner/story-planner-client.tsx")
  const savedPage = read("app/planner/saved/page.tsx")
  assert.match(planner, /href="\/planner\/saved"/)
  assert.doesNotMatch(planner, /SavedPlansInline/)
  assert.match(savedPage, /SavedPlansClient/)
})

test("Intro canvas still paints paper behind the standalone hardcover", () => {
  const css = read("app/globals.css")
  assert.match(css, /\.book-intro-canvas[\s\S]*background:\s*#fffefa\s*!important/i)
  assert.match(css, /\.book-standalone-cover[\s\S]*780ms/i)
})
