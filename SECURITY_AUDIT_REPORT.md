# StoryTuner security audit report

Audit date: 2026-08-16

This audit reviewed the current Next.js application, API routes, Supabase migrations and storage policies, authentication flow, owner/moderator authorization, Stripe integration, OpenAI integration, GitHub backup workflow, and client-side state handling.

## Major hardening completed

- Added broad per-IP API and OAuth callback throttling with `429` responses, while retaining per-user and durable database-backed limits on expensive AI actions.
- Added same-origin checks and strict request schemas/body limits across browser mutation routes.
- Added a compatibility-first Content Security Policy plus HSTS, clickjacking, MIME-sniffing, referrer, permissions, and related security headers.
- Replaced request-host-derived production redirects with a configured canonical HTTPS application origin.
- Strengthened the single owner/admin identity from email-only matching to immutable Supabase user UUID + email + server-side moderator-role verification.
- Made account restriction checks fail closed when moderation state cannot be verified.
- Moved AI response reports and display-name mutations behind validated server routes instead of allowing direct browser table writes.
- Wrapped user-controlled AI reference material in explicit untrusted-data delimiters and told the model not to treat those reference blocks as instructions.
- Tightened transcription upload MIME/size/duration/body validation and Edge Function origin/path validation.
- Reasserted RLS on every application table, removed anonymous table access, reduced authenticated grants, and kept sensitive moderation/report/usage tables server-only.
- Kept recording and Community-audio storage buckets private and added anti-abuse checks around private recording object creation.
- Bounded the Community public-profile RPC to prevent unbounded UUID-array queries.
- Hardened Stripe return URLs and retained raw-body webhook signature verification.
- Changed maintenance-secret comparison to timing-safe comparison.
- Added Dependabot configuration and encrypted GitHub database backup artifacts.
- Added regression/security tests for the hardening controls.

## Secret review

- No real `.env` file is present in this archive. Only `.env.example` is present.
- `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`.
- Static scans found no obvious hard-coded OpenAI, Stripe, GitHub, Google OAuth, private-key, or JWT-like secret values in application source.
- The source archive contains no `.git` history, so it cannot prove whether a secret was committed historically. The real repository history and GitHub secret-scanning alerts still need to be checked.

## Authentication/session review

- Supabase browser authentication uses `@supabase/ssr`; no Supabase access/refresh token was found intentionally stored in StoryTuner `localStorage`.
- StoryTuner localStorage still contains ordinary application state/preferences and may therefore contain personal StoryTuner content on the device. It is not used as the authority for authentication, paid membership, admin rights, or moderation state.
- Google OAuth callbacks exchange/verify the Supabase session server-side and use internal-path validation plus the configured production origin.
- Mandatory username/account completion remains server-enforced for normal signed-in pages and important APIs.

## Residual items requiring infrastructure or architectural work

1. **Next.js patch:** the archive still pins Next.js 16.2.6. The July 2026 Next.js security release says 16.0.0 through 16.2.10 are affected by multiple vulnerabilities and recommends 16.2.11 for the 16.2 line. The audit environment could not access npm to regenerate the pnpm lockfile safely. Update to at least 16.2.11, regenerate the lockfile, test, and redeploy before treating production as fully hardened.
2. **Distributed rate limiting:** the new code-level IP limiter is per serverless instance. Keep it, but mirror important limits in Vercel WAF/Firewall for distributed abuse.
3. **Recording metadata integrity:** authenticated users still have direct own-row update/delete access to `recording_uploads` for the existing upload/transcription architecture. RLS prevents cross-user access, and new insert/storage creation is much tighter, but a determined user can still falsify metadata on their own recording row. Making media duration/status fully authoritative would require moving the remaining recording lifecycle writes server-side and/or validating the media server-side.
4. **CSP:** the CSP blocks third-party script origins but retains `unsafe-inline` for Next/React compatibility. A future nonce-based CSP would be stricter but requires a broader rendering change.
5. **Git history:** current files alone cannot establish whether old secrets were previously committed. Check the real Git history and GitHub secret scanning. Rotate any secret that was ever exposed.

## Validation performed

- 40/40 backend/security regression tests pass.
- TypeScript parser-level validation found 0 syntax/parser diagnostics across application, component, library, and Edge Function TS/TSX files. A full dependency-resolved Next.js build could not be run because this audit environment does not have the project's `node_modules` and cannot reach npm.
- Static scans found no `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write`, or `javascript:` usage in the audited application sources.
- The hardening migration explicitly enables RLS on all 20 application tables currently created by StoryTuner migrations.
