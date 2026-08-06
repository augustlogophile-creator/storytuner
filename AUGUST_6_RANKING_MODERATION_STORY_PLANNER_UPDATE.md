# StoryTuner Community ranking, moderation, and Story Planner update

## Included features

### Community

- Feed is ranked by total post likes, with newer posts breaking ties.
- Authors are displayed using their real public `@username` through a protected public-profile lookup.
- Replies to replies are collapsed by default behind `See N replies`.
- Nested replies open four at a time, with another four available per tap.
- The first four top-level conversations are shown before a `See more responses` control.
- The report-reason selector uses a custom, better-positioned arrow.

### Moderation

- Private moderator dashboard at `/admin/community`.
- Report queue with the reported content, reason, optional reporter context, target username, prior report count, and prior action count.
- Actions: dismiss, remove content, record an internal warning, suspend Community, suspend the full StoryTuner account, ban the account, restore content, and clear restrictions.
- Full-account restrictions are checked by protected pages and AI endpoints.
- The transcription Edge Function also checks full-account restrictions after it is redeployed.
- Moderation actions are recorded in an immutable history table.
- Reporters remain private from the person who was reported.

Use the least severe action that protects users:

1. Dismiss when there is no violation.
2. Remove content or record an internal warning for a low-severity first violation.
3. Temporarily suspend Community for repeated Community behavior.
4. Temporarily suspend the full account for serious misuse across StoryTuner.
5. Ban only for severe harm or repeated abuse.

### Public-name safety

- Usernames and display names are checked in both application code and the database.
- Common leetspeak, separators, and repeated-letter obfuscations are normalized.
- Existing unsafe names are replaced with neutral public names when the migration runs.
- Reports and moderation remain necessary because no automated language filter can anticipate every new phrase or context.

### Curriculum

- Wrong answers show an X rather than a check.
- Correct answers are distributed across A, B, C, and D.
- Correct options are no longer consistently the longest option.
- Distractors were revised to remain plausible and specific to each question.

### AI Story Planner

- Private planner at `/planner`.
- Inputs: audience or situation, intended takeaway, rough sequence, must-include facts, and nervousness or uncertainty.
- Weaver returns a throughline, opening direction, three to five beats, ending direction, details to keep, points to clarify, delivery tips, a rehearsal outline, and reassurance.
- Plans are saved privately to the signed-in account.
- Free accounts receive two plans total.
- Active members receive up to ten plans per day.
- A plan can be sent directly into Arena for rehearsal.
- Story Planner is linked from Home, Arena, and Profile.

## Required setup

1. Run `supabase/migrations/202608060002_community_ranking_moderation_planner.sql` in the Supabase SQL Editor.
2. Add the owner account to `community_moderators` as an `admin` using `StoryTuner-Grant-Yourself-Community-Admin.sql`.
3. Upload the changed files to GitHub and wait for Vercel to deploy.
4. Redeploy `supabase/functions/transcribe-recording/index.ts` in the existing `transcribe-recording` Supabase Edge Function so direct transcription requests also respect full-account restrictions.

Do not test a full-account suspension or ban on the primary owner account. Use a separate test account.
