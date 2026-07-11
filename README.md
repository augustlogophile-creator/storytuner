# StoryTuner

StoryTuner is a mobile-first storytelling course and practice app. This repository uses the visual system from the v0-generated interface throughout the full application.

## Included

- The complete 14-unit **Craft of True Storytelling** curriculum and capstone
- Three sequential steps per unit: Learn, Practice, and Check
- Persistent lesson progress, responses, quiz scores, XP, streaks, and session counts
- A private recording Arena with camera controls, pause/resume, transcript review, AI coaching, and on-device fallback feedback
- A private Story Reel stored in IndexedDB
- Opt-in Community sharing, hearts, comments, and post removal
- Profile, detailed progress, settings, privacy controls, membership demo, and Weaver XP shop
- Weaver used sparingly in onboarding, Profile, and the Shop

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

## AI feedback

The server route is `app/api/feedback/route.ts`. It uses the Vercel AI SDK with `openai/gpt-4o-mini` for lesson and Arena feedback.

Set `AI_GATEWAY_API_KEY` in `.env.local` for local development or in your Vercel project settings. When the route is unavailable, the app preserves the user's work and provides a limited local craft check.

Never commit `.env.local` or a real API key.

## Storage and privacy

This version is intentionally account-free:

- Progress and settings are stored in `localStorage`.
- recorded audio/video blobs are stored in IndexedDB.
- data remains on the same browser and does not sync across devices.
- recordings are private unless the user explicitly shares one to Community.

A production multi-user release should add authentication, a database, private object storage, authorization rules, moderation, and a real billing provider.

## Deploy to Vercel

1. Upload this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add `AI_GATEWAY_API_KEY` in Project Settings → Environment Variables.
4. Deploy. No custom build command is required.

## Important files

- `lib/curriculum.json`: full course text and all 75 quiz questions
- `lib/app-state.tsx`: persistent progress, XP, streaks, Shop, Community, and recording metadata
- `components/lesson/course-lesson.tsx`: complete lesson player
- `components/arena/arena-client.tsx`: recording and coaching flow
- `app/api/feedback/route.ts`: server-side AI calls
- `public/weaver.png`: Weaver mascot asset
- `PROJECT_MAP.md`: route and file guide for GitHub
