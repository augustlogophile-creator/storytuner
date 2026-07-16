# Clerk to Supabase Auth migration

StoryTuner now uses Supabase Auth with cookie-based server-side rendering. The existing design, curriculum, recording Arena, OpenAI routes, Weaver shop, navigation, and local progress system remain intact.

## Added

- `SUPABASE_SETUP.md`
- `AUTH_MIGRATION_SUMMARY.md`
- `app/auth/callback/route.ts`
- `app/forgot-password/page.tsx`
- `app/reset-password/page.tsx`
- `app/sign-in/page.tsx`
- `app/sign-up/page.tsx`
- `components/auth/auth-form.tsx`
- `components/auth/forgot-password-form.tsx`
- `components/auth/reset-password-form.tsx`
- `lib/auth/redirects.ts`
- `lib/supabase/client.ts`
- `lib/supabase/proxy.ts`
- `lib/supabase/server.ts`
- `supabase/migrations/202607150001_create_profiles.sql`

## Updated

- `.env.example`
- `PROJECT_MAP.md`
- `README.md`
- `app/api/coach/route.ts`
- `app/api/feedback/route.ts`
- `app/api/transcribe/route.ts`
- `app/globals.css`
- `app/layout.tsx`
- `app/onboarding/page.tsx`
- `app/page.tsx`
- `components/auth/account-setup.tsx`
- `components/auth/auth-shell.tsx`
- `components/onboarding.tsx`
- `components/profile/settings-client.tsx`
- `lib/require-auth.ts`
- `package.json`
- `pnpm-lock.yaml`
- `proxy.ts`

## Removed

- `@clerk/nextjs`
- `app/sign-in/[[...sign-in]]/page.tsx`
- `app/sign-up/[[...sign-up]]/page.tsx`
- `components/auth/clerk-appearance.ts`
- Clerk provider, proxy, redirects, server helpers, imports, components, and environment-variable references

## Storage boundary

Supabase currently stores authentication and the minimal user profile. Curriculum progress, XP, recordings, Weaver purchases, coach history, and Community activity continue to use the existing browser storage. No unrelated database tables were added.

See `SUPABASE_SETUP.md` for the required dashboard, redirect, Google OAuth, migration, and testing steps.

## Follow-up: private Weaver personalization

The settings page now contains an explicit opt-in for using private text summaries from past recordings as coaching context. Existing Supabase projects must run `supabase/migrations/202607160001_add_ai_personalization.sql`. The coach API checks this profile flag server-side before including the supplied history context.
