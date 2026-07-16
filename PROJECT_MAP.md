# StoryTuner Project Map

## Authentication

- `proxy.ts`: refreshes Supabase Auth cookies on Next.js 16 requests.
- `lib/supabase/client.ts`: browser Supabase client.
- `lib/supabase/server.ts`: cookie-aware server Supabase client.
- `lib/supabase/proxy.ts`: secure session refresh logic.
- `lib/require-auth.ts`: server-side protection for private pages and APIs.
- `lib/auth/redirects.ts`: safe internal redirects and site URL helpers.
- `app/sign-up/page.tsx`: StoryTuner-styled Supabase signup.
- `app/sign-in/page.tsx`: StoryTuner-styled Supabase login.
- `app/forgot-password/page.tsx`: password recovery request.
- `app/reset-password/page.tsx`: authenticated recovery-session password update.
- `app/auth/callback/route.ts`: exchanges Supabase PKCE codes for cookie sessions.
- `app/onboarding/page.tsx`: public username, display name, and age confirmation after signup.
- `supabase/migrations/202607150001_create_profiles.sql`: minimal profile table and RLS policies.
- `SUPABASE_SETUP.md`: required dashboard, redirect, Google, and testing steps.

## Main routes

- `/`: public StoryTuner introduction.
- `/home`: private dashboard.
- `/activities` and `/activities/[unitId]`: private curriculum path and unit detail.
- `/lesson/[lessonId]`: private Learn, Practice, and Check stages.
- `/arena`: private recording studio.
- `/arena/recordings`: private recording history.
- `/coach`: private Ask Weaver chat.
- `/community`: private Membership community.
- `/profile`, `/progress`, `/settings`, `/shop`, `/membership`: private account and progress areas.

## AI routes

- `app/api/feedback/route.ts`: signed-in lesson and Arena grading.
- `app/api/transcribe/route.ts`: signed-in OpenAI transcription and cleanup.
- `app/api/coach/route.ts`: signed-in Ask Weaver chat.

## Existing local state

- `lib/app-state.tsx`: curriculum completion, XP, settings, local recordings metadata, Community demo state, Weaver ownership, and coach limits.
- `lib/media-store.ts`: browser media storage.

Authentication and the minimal profile are stored in Supabase. Other StoryTuner data remains local until a separate database migration is designed.
