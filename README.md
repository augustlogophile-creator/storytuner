# StoryTuner

StoryTuner is a Next.js 16 App Router application for learning and practicing true storytelling. It includes a complete curriculum, AI-guided practice, private video and audio recording, Weaver coaching, progress tracking, Community, Membership gating, and a collectible Weaver shop.

## Technology

- Next.js 16.2.6 and React 19
- TypeScript and Tailwind CSS 4
- Supabase Auth using `@supabase/ssr` cookie sessions
- OpenAI for transcription, lesson feedback, Arena grading, and Ask Weaver
- Supabase database and private Storage for synced progress, recording audio, transcripts, and membership state
- IndexedDB for full-resolution media that remains on the recording device
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

Stripe membership routes require `SUPABASE_SERVICE_ROLE_KEY` on the server. Never expose it to browser code.

## Setup

Read `SUPABASE_SETUP.md` before deployment. Apply the SQL migration first, then configure Supabase URL settings, email authentication, and Google OAuth.

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

## Data model scope

StoryTuner uses dedicated Supabase tables for profiles, synced app progress, private recording uploads, and Stripe-backed subscriptions. Lesson progress, XP, streaks, Weaver ownership, settings, coaching history, and recording metadata sync through `user_app_state`. Private compressed audio and transcripts live in `recording_uploads` and the `storytuner-recordings` bucket.

Full video remains in IndexedDB on the device where it was recorded. Community content is still browser-based and should move to its own shared backend before public launch.

## Security

- Passwords are processed only by Supabase Auth.
- Auth tokens use Supabase SSR cookies, not application-managed localStorage.
- The profile table has Row Level Security and self-only policies.
- No service-role key is used.
- Return paths are restricted to safe internal routes.
- OpenAI API endpoints validate the signed-in Supabase session.

## Latest interface and coaching update

The introduction now uses a guided Weaver-led layout with transparent emotion artwork. Settings includes confirmed display-name changes, designed logout and deletion confirmations, improved notification controls, and a real opt-in for private long-term Weaver coaching context. Run `supabase/migrations/202607160001_add_ai_personalization.sql` on projects that already applied the original profile migration.

## Long recording storage and transcription

Arena recordings upload their separate compressed audio track directly to a private Supabase Storage bucket and use the `transcribe-recording` Edge Function. Recording metadata, transcripts, scores, feedback, and revisions now follow the signed-in account across devices, while full video remains on the original device. Playback uses short-lived private signed URLs. See `LONG_RECORDING_BACKEND.md`.


## Curriculum sequence

Every curriculum unit now follows **Learn → Check → Practice**. The check must be completed before the practice step unlocks. Existing completion IDs remain compatible.
