# StoryTuner backend security and reliability pass

This pass is intentionally code-only. It does not move Stripe to live mode or require a database migration.

## Security

- Added same-origin checks to authenticated browser mutations.
- Added true JSON byte-size validation in addition to Content-Length checks.
- Changed protected API restriction checks to fail closed when moderation status cannot be verified.
- Added global security headers.
- Marked privileged server modules as server-only.
- Secured scheduled maintenance with `CRON_SECRET` bearer authentication.
- Membership only accepts the configured Stripe price when `STRIPE_PRICE_ID` is set.
- Stripe API calls now time out and checkout no longer exposes raw upstream errors.
- Stripe return URLs prefer the configured canonical app origin.
- Stripe webhook malformed JSON is handled without crashing.

## Reliability and cost control

- Coach retries with the same request key reuse a persisted answer before another OpenAI call.
- Planner retries/double-clicks reuse an identical plan created within two minutes.
- Membership lookup failures return controlled 503 states for paid/limited actions.
- Coach history now asks for the newest 30 archived exchanges, then restores chronological order.

## Performance

- Community feed reply counting groups rows once instead of repeatedly scanning the full reply list per post.
- Reply-like counts no longer fetch every liker user ID through the service-role client.
- A single Community conversation is capped at 500 reply rows per request as a safety ceiling.

## Privacy and retention

- Settings data deletion now has a server-owned implementation.
- “Delete all recordings” removes private recording objects and recording-derived Community posts.
- “Delete all app data” removes user content, plans, Coach history, progress, XP/settings state and Community activity while deliberately preserving the login, billing connection, lifetime free-usage limits, and safety/moderation records.
- User-deleted Community posts are hard-purged after 30 days by maintenance. Deleted reply placeholders remain so nested conversations do not break.

## Regression tests

Run:

```bash
npm run test:backend
```

The tests verify security boundaries and important backend contracts without needing live credentials.

## Optional off-site database backup

`.github/workflows/supabase-backup.yml` is included but stays disabled unless the repository is private and the GitHub Actions secret `SUPABASE_DB_URL` is configured. Backup data is uploaded only as a short-retention Actions artifact, not committed to the repository.
