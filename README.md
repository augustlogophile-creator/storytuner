# StoryTuner

StoryTuner is a Next.js 16 App Router application for learning and practicing true storytelling. It includes a complete curriculum, AI-guided practice, private video and audio recording, Weaver coaching, progress tracking, Community, Membership gating, and a collectible Weaver shop.

## Technology

- Next.js 16.2.6 and React 19
- TypeScript and Tailwind CSS 4
- Supabase Auth using `@supabase/ssr` cookie sessions
- OpenAI for transcription, lesson feedback, Arena grading, and Ask Weaver
- IndexedDB and localStorage for the current device-based StoryTuner data
- pnpm and `pnpm-lock.yaml`

## Authentication

Supabase handles:

- Email and password signup
- Email confirmation
- Email and password login
- Google OAuth
- Forgot password and password reset
- Secure cookie sessions and refresh
- Logout

The public introduction ends with Sign up and Log in. Authenticated users complete a minimal profile with a public username, display name, and 13-plus confirmation.

Private StoryTuner pages are protected with server-side Supabase JWT validation. The OpenAI route handlers also require an authenticated Supabase user.

## Environment variables

Copy `.env.example` to `.env.local` and add real values locally. Never commit `.env.local`.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY
```

Optional:

```text
OPENAI_MODEL
OPENAI_TRANSCRIPTION_MODEL
```

No Supabase service-role key is required.

## Setup

Read `SUPABASE_SETUP.md` before deployment. Apply the SQL migration first, then configure Supabase URL settings, email authentication, and Google OAuth.

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

## Data model scope

This authentication migration creates only the `profiles` table. It does not add database tables for curriculum progress, XP, streaks, recordings, media, Community, Membership, payments, or Weaver purchases.

Those features keep their existing local browser behavior. Authentication and public profile data persist across devices, but StoryTuner progress and recordings do not yet sync across devices.

## Security

- Passwords are processed only by Supabase Auth.
- Auth tokens use Supabase SSR cookies, not application-managed localStorage.
- The profile table has Row Level Security and self-only policies.
- No service-role key is used.
- Return paths are restricted to safe internal routes.
- OpenAI API endpoints validate the signed-in Supabase session.
