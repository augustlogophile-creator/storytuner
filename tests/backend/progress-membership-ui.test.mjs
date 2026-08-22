import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8")

test("Progress focuses on course, XP, stories, average Studio score, and recalculated streaks", () => {
  const source = read("components/profile/progress-client.tsx")
  assert.match(source, /label="Average story score"/)
  assert.match(source, /recording\.overall > 0/)
  assert.match(source, /calculateStreaks\(state\.activityDates\)/)
  assert.doesNotMatch(source, /label="App sessions"/)
  assert.doesNotMatch(source, /label="Units complete"/)
  assert.doesNotMatch(source, /label="Stories shared"/)
  assert.doesNotMatch(source, />This week</)
})

test("Membership limit surfaces use the shared premium upgrade screen", () => {
  const arena = read("components/arena/arena-client.tsx")
  const community = read("components/community/community-client.tsx")
  const membership = read("components/profile/membership-client.tsx")
  const pricing = read("components/ui/pricing-interaction.tsx")
  assert.match(arena, /UpgradeScreen reason="studio"/)
  assert.match(community, /UpgradeScreen reason="community"/)
  assert.match(membership, /<UpgradeScreen reason=\{reason\}/)
  assert.match(pricing, /\$60/)
  assert.match(pricing, /\$5\.99/)
})

test("New pricing selection fails closed until Stripe price IDs are updated", () => {
  const upgrade = read("components/membership/upgrade-screen.tsx")
  const checkout = read("app/api/stripe/checkout/route.ts")
  assert.match(upgrade, /JSON\.stringify\(\{ renewalConsent: true, plan: selectedPlan \}\)/)
  assert.match(upgrade, /not connected to checkout yet/)
  assert.match(checkout, /checkoutSchema = z\.object\(\{ renewalConsent: z\.literal\(true\) \}\)\.strict\(\)/)
  assert.doesNotMatch(checkout, /plan:\s*z\./)
})

test("Saved planner history is server-rendered to avoid a loading flash", () => {
  const page = read("app/planner/saved/page.tsx")
  const client = read("components/planner/saved-plans-client.tsx")
  assert.match(page, /\.from\("story_plans"\)/)
  assert.match(page, /initialPlans=\{/)
  assert.doesNotMatch(client, /useEffect\(\(\) => \{\s*void loadPlans\(\)/)
})
