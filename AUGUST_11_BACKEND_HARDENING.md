# August 11 backend hardening

This checkpoint completes the five remaining code-side backend jobs requested for StoryTuner.

## 1. Permanent account deletion

- New authenticated endpoint: `POST /api/account/delete`.
- Requires the literal confirmation `DELETE`.
- The StoryTuner owner account cannot be deleted from inside the app.
- Removes the linked Stripe customer first when one exists.
- Removes private recording and Community-audio objects, including user-folder objects not referenced by a current database row.
- Deletes the Supabase Auth user after external/storage cleanup succeeds. Existing `ON DELETE CASCADE` relationships then remove user-owned StoryTuner rows.
- Adds a permanent-delete control to Settings and to the restricted-account screen.

## 2. Automatic abandoned-recording cleanup

- New maintenance runner removes stale failed/incomplete recording uploads older than 24 hours.
- Removes failed/deleting Community-audio objects older than 24 hours.
- Clears expired account and Community suspensions and records the restoration in moderation history.
- `vercel.json` schedules `/api/cron/maintenance` daily.
- Owner System Health can also run maintenance manually.

## 3. API abuse and cost protection

- Adds request-size checks, sliding-window rate limits, duplicate-request protection, and no-store responses where appropriate.
- Expensive Coach and Arena AI calls additionally use the existing `user_usage_events` table for durable hourly/daily limits across server instances.
- Planner retains its existing database daily limit and gains burst protection/idempotency.
- Community posts, replies, reports, shares, likes, audio signing, Stripe checkout, Stripe portal, and account deletion receive abuse limits.
- OpenAI calls use timeouts and structured failure logs.
- The checked-in Supabase `transcribe-recording` Edge Function source is hardened too. Deploying an existing Edge Function still requires updating it in Supabase.

## 4. Central backend logging and owner visibility

- New structured logger emits `storytuner-backend` JSON events without logging user message/story content.
- New owner-only `/admin/system` page shows backend health and recent operational counts.
- It shows recording failures, stale uploads, reports, moderation actions, AI usage events, plans/posts/replies, membership counts, active restrictions, and whether required backend secrets are present.
- Includes manual maintenance.

## 5. Moderation reliability

- Moderation status writes are written, read back, verified, and retried once on mismatch.
- Report status and content-status writes are also verified.
- Clearing/switching restrictions resets incompatible fields so stale suspension state cannot linger.
- Expired temporary suspensions are normalized during normal auth/restriction checks, not only by the daily cleanup job.
- Audit-log insertion failure no longer falsely reports the entire moderation decision as failed after the authoritative state already changed.
- Reopening/revising decisions returns uncached state.
- User-deleted content cannot be restored by moderation.

## Deployment

No new Supabase SQL migration is required for this checkpoint.

Upload the changed-files package to the repository root and deploy through Vercel. The Vercel deployment activates all Next.js changes and the scheduled maintenance route.

To activate the additional direct-transcription hardening in production, also update and redeploy the existing Supabase `transcribe-recording` Edge Function with the included source file.
