# StoryTuner security deployment checklist

This file contains deployment actions that cannot be enforced by application code alone.

## Required deployment order

1. In Vercel, set `NEXT_PUBLIC_APP_URL` to the exact production HTTPS origin, for example `https://storytuner.vercel.app` or your custom domain.
2. In Vercel, set both owner bindings:
   - `STORYTUNER_OWNER_USER_ID` = the owner's immutable Supabase Auth UUID.
   - `STORYTUNER_OWNER_EMAIL` = the owner's Google account email.
3. Make sure the same owner UUID has `role = 'admin'` in `public.community_moderators`. The existing `StoryTuner-Grant-Yourself-Community-Admin.sql` file can be used once with the correct UUID.
4. Deploy the new application code.
5. Immediately run `supabase/migrations/202608160002_security_hardening.sql` in the Supabase SQL Editor (or deploy migrations normally). Deploying the code first avoids a short window where the older client still expects direct profile writes that the migration intentionally revokes.
6. Keep `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, and database credentials server-side only. Never prefix them with `NEXT_PUBLIC_`.
7. **Urgent dependency patch:** this archive still has Next.js `16.2.6`. Before treating production as hardened, update Next.js to at least `16.2.11` (the July 2026 security-patched 16.2 release), regenerate `pnpm-lock.yaml`, run tests/build, and redeploy. The audit environment could not reach the npm registry, so the lockfile could not be regenerated safely here.

## Supabase checks

- Open Database > Advisors / Security Advisor and resolve any remaining RLS or security warnings.
- In Authentication > URL Configuration, set the Site URL to your exact production HTTPS origin and keep the production OAuth callback redirect exact. Remove broad production wildcards you do not need.
- In Authentication > Sessions, keep JWT expiry around the default 1 hour and consider an inactivity timeout if you want dormant sessions to expire automatically.
- Confirm the recording and Community audio buckets are private.
- If StoryTuner is now Google-only and no legacy password users need access, disable Email/password signups in Authentication > Providers. Do not do this until legacy users are migrated.
- If you use a custom production domain for direct Edge Function calls, set the Supabase Edge Function secret `STORYTUNER_ALLOWED_ORIGINS` to a comma-separated allowlist of exact HTTPS origins.

## Infrastructure MFA

Enable MFA/passkeys on every account that can change production or secrets:

- Google account used as the StoryTuner owner
- Supabase dashboard account
- GitHub account/organization
- Vercel account/team
- Stripe account
- OpenAI account
- domain registrar / DNS provider

Normal StoryTuner users authenticate with Google. App-level TOTP can be added later, but owner/infrastructure MFA is the priority.

## GitHub / secret history

This source archive contains no `.git` history, so it cannot prove whether a real `.env` was committed in the past. In the actual repository run:

```bash
git log --all --full-history -- .env .env.local .env.production .env.development
```

Also use GitHub secret scanning / push protection. If a real secret was ever committed, deleting the file is not enough. Rotate the exposed credential.

Rotate, as applicable:

- Supabase service-role/secret key
- OpenAI API key
- Stripe secret key and webhook secret
- Google OAuth client secret
- `CRON_SECRET`
- database password / `SUPABASE_DB_URL`

## Global rate limiting

StoryTuner now has application-level IP limits plus user-level and durable database-backed limits on expensive AI usage. Serverless in-memory IP buckets are best-effort per instance. For distributed abuse/DDoS protection, mirror the important limits in Vercel Firewall / WAF rate-limiting rules.

Suggested starting points:

- `/auth/callback`: 40 requests per 10 minutes per IP
- `/api/account/setup`: 30 requests per 10 minutes per IP
- `/api/coach`, `/api/feedback`, `/api/planner`, `/api/transcribe`: 120 requests per 5 minutes per IP
- general `/api/*`: 180 requests per minute per IP
- exclude `/api/stripe/webhook` and `/api/cron/maintenance`; they use provider signatures/secrets

## Encrypted database backups

The GitHub backup workflow no longer uploads plaintext SQL artifacts. Add a repository Actions secret named `SUPABASE_BACKUP_ENCRYPTION_KEY` containing a long random value (at least 32 characters) and store the value in a password manager. Without it, the backup workflow intentionally skips export rather than uploading plaintext database contents.
