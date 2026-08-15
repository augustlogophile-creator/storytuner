import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("AI response reports are stored in the authenticated user's Supabase report table", () => {
  const route = read("app/api/ai/report/route.ts")
  assert.match(route, /from\("ai_response_reports"\)/)
  assert.match(route, /reporter_id:\s*auth\.user\.id/)
  assert.match(route, /getActiveAuthenticatedUser\(\)/)
  assert.doesNotMatch(route, /body\.reporter(?:Id|_id)/)
})

test("AI report UI sends the response, reason, surface and optional context", () => {
  const component = read("components/ai/report-ai-output.tsx")
  assert.match(component, /surface:\s*source/)
  assert.match(component, /responseText:\s*content/)
  assert.match(component, /reason:\s*cleanReason/)
  assert.match(component, /recordingId:/)
  assert.match(component, /lessonId:/)
})

test("AI report administration is owner-protected", () => {
  const listRoute = read("app/api/admin/ai-reports/route.ts")
  const updateRoute = read("app/api/admin/ai-reports/[reportId]/route.ts")
  assert.match(listRoute, /getModeratorContext\(\)/)
  assert.match(updateRoute, /getModeratorContext\(\)/)
  assert.match(updateRoute, /requireSameOrigin\(request\)/)
})
