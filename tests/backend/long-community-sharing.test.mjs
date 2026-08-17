import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const route = await readFile(new URL("../../app/api/community/share-recording/route.ts", import.meta.url), "utf8")
const dialog = await readFile(new URL("../../components/community/share-recording-dialog.tsx", import.meta.url), "utf8")
const migration = await readFile(new URL("../../supabase/migrations/202608150007_long_community_recording_shares.sql", import.meta.url), "utf8")

test("Community audio sharing supports StoryTuner's 30-minute recording limit", () => {
  assert.match(route, /MAX_COMMUNITY_AUDIO_SECONDS = 1800/)
  assert.match(dialog, /recording\.duration <= 1800/)
  assert.match(migration, /duration_seconds between 1 and 1800/)
})

test("Community audio sharing preserves the private 24 MB app limit", () => {
  assert.match(route, /MAX_COMMUNITY_AUDIO_BYTES = 24 \* 1024 \* 1024/)
  assert.match(migration, /size_bytes between 1 and 25165824/)
  assert.match(migration, /file_size_limit = 26214400/)
})

test("Cloud recording shares rely on the authoritative server transcript", () => {
  assert.match(dialog, /activeRecording\.cloudRecordingId \? "" : activeRecording\.transcript/)
  assert.match(route, /trustedSourceTranscript = source\?\.transcript/)
})
