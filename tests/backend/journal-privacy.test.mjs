import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
const root=process.cwd();const read=p=>fs.readFileSync(path.join(root,p),"utf8")
test("Journal written entries are owner-scoped with RLS and no anonymous grants",()=>{const sql=read("supabase/migrations/202608200001_journal_entries.sql");assert.match(sql,/alter table public\.journal_entries enable row level security/i);assert.match(sql,/revoke all on table public\.journal_entries from public, anon/i);assert.match(sql,/using \(\(select auth\.uid\(\)\) = user_id\)/i)})
test("Journal reuses private recording history instead of introducing a weaker upload path",()=>{const client=read("components/journal/journal-client.tsx");assert.match(client,/listCloudRecordingHistory/);assert.match(client,/createSignedCloudRecordingUrl/);assert.doesNotMatch(client,/\.storage\s*\.\s*from\(/)})
test("Intro canvas always paints paper behind the hardcover",()=>{const css=read("app/globals.css");assert.match(css,/\.book-intro-canvas,\s*\.book-intro-canvas\.is-cover[\s\S]*background-color:\s*#fffefa\s*!important/i)})
