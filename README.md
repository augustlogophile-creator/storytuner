# StoryTuner

StoryTuner is a mobile-first storytelling course and practice app. The full product uses the visual system from the supplied v0 interface.

## Included

- The complete 14-unit **Craft of True Storytelling** curriculum and capstone
- A launch free plan with five full lessons, two total spoken story reviews, five total Ask Weaver messages, and member-only Community access
- A founding waitlist membership offer of $11.99/year, with a later public price shown as $24.99/year
- Three clear steps per unit: Learn, Practice, and Check
- A three-part reading navigator inside Learn: Concept, Breakdown, and Example
- Repeatable readings, activities, and quizzes, with XP awarded only on first completion
- Clerk authentication with Google and email/password sign-up, verification, recovery, secure sessions, account management, and logout
- Persistent lesson progress, responses, quiz scores, XP, streaks, and session counts on the current device
- An Arena with two clear paths: tell any story or choose a real-life storytelling scenario
- Selectable 1:00, 1:30, 2:00, and 5:00 targets, with an optional 45-second extension near the end
- Automatic Weaver transcription that removes empty filler, adds punctuation, creates a title, and preserves the speaker's voice
- Structured scoring with three strengths, three improvements, one immediate revision, and a voice-preserving revised story
- A dedicated private recordings page with playback, review, deletion, Weaver coaching, and opt-in Community sharing
- Ask Weaver, a story-aware coaching chat with formatted answers and story and score context
- Profile, detailed progress, settings, privacy controls, membership demo, and Weaver XP shop
- Blue interface accents, with green and red reserved for feedback meaning
- A transparent Weaver mascot asset with no baked-in square background

## Run locally

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

Before deployment, run:

```bash
pnpm typecheck
pnpm build
```

## OpenAI configuration

The server routes call OpenAI directly:

- `app/api/feedback/route.ts` grades lesson work and Arena stories
- `app/api/transcribe/route.ts` transcribes audio or video recordings
- `app/api/coach/route.ts` powers Ask Weaver

Set `OPENAI_API_KEY` in `.env.local` for local development or in Vercel Project Settings. The key stays server-side and is never included in browser code.

Optional overrides:

```text
OPENAI_MODEL=gpt-4o-mini
OPENAI_TRANSCRIPTION_MODEL=whisper-1
```

When OpenAI is unavailable, the app preserves the user’s work and displays an honest error rather than presenting fallback scoring as AI feedback.

## Storage and privacy

Clerk now provides secure user authentication and session management. StoryTuner progress, settings, chat history, and media are still stored locally in the current browser until a database and private object storage are added in a later phase.

- Clerk stores account credentials and sessions. StoryTuner never stores passwords.
- Progress, settings, and AI chat history remain in `localStorage`.
- Recorded audio and video blobs remain in IndexedDB.
- Recordings are private unless a member explicitly shares one to Community.
- The configured AI service receives a story only when the user requests transcription, grading, or coaching.
- Signing into the same Clerk account on another device does not yet sync local StoryTuner progress.

## Deploy to Vercel

1. Upload this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add the Clerk and OpenAI environment variables listed below in **Project Settings → Environment Variables**.
4. Leave the Framework Preset as **Next.js** and keep Build, Install, and Output Directory overrides off.
5. In Clerk, enable Google and email/password authentication.
6. Deploy.

## Important files

- `lib/curriculum.json`: full course text and all 75 quiz questions
- `lib/app-state.tsx`: progress, XP, streaks, recordings, chat usage, Shop, and Community state
- `components/lesson/course-lesson.tsx`: repeatable lesson player and three-part Learn navigator
- `components/arena/arena-client.tsx`: open stories, scenarios, recording, transcription, and scoring
- `components/arena/recordings-client.tsx`: dedicated recordings archive
- `components/coach/coach-client.tsx`: Ask Weaver chat interface
- `public/weaver.png`: transparent Weaver mascot asset
- `proxy.ts`: Clerk middleware integration for Next.js 16
- `app/sign-in/[[...sign-in]]/page.tsx`: styled Clerk login
- `app/sign-up/[[...sign-up]]/page.tsx`: styled Clerk signup
- `PROJECT_MAP.md`: route and file guide

## Clerk authentication

StoryTuner uses Clerk for Google and email/password authentication, verification, password recovery, sessions, account management, and logout.

Required Vercel environment variables:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/home
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/onboarding
```

In the Clerk Dashboard, enable Google and email/password sign-in methods. Authentication is connected, but StoryTuner progress is still stored locally on the device until a database layer is added later.
