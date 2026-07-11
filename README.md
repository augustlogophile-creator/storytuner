# StoryTuner

StoryTuner is a mobile-first storytelling course and practice app. The full product uses the visual system from the supplied v0 interface.

## Included

- The complete 14-unit **Craft of True Storytelling** curriculum and capstone
- Three clear steps per unit: Learn, Practice, and Check
- A three-part reading navigator inside Learn: Concept, Breakdown, and Example
- Repeatable readings, activities, and quizzes, with XP awarded only on first completion
- Persistent lesson progress, responses, quiz scores, XP, streaks, and session counts
- An Arena with an open, prompt-free story mode plus guided scenario collections
- OpenAI transcription and structured scoring for recorded stories
- A dedicated private recordings page with playback, review, deletion, AI coaching, and opt-in Community sharing
- Ask Weaver, an OpenAI-powered story chat with story and score context
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

This version is intentionally account-free:

- Progress, settings, and AI chat history are stored in `localStorage`.
- Recorded audio and video blobs are stored in IndexedDB.
- Data remains on the same browser and does not sync across devices.
- Recordings are private unless the user explicitly shares one to Community.
- OpenAI receives a story only when the user requests transcription, grading, or coaching.

A production multi-user release should add authentication, a database, private object storage, authorization rules, moderation, and a real billing provider.

## Deploy to Vercel

1. Upload this folder to a GitHub repository.
2. Import the repository into Vercel.
3. Add `OPENAI_API_KEY` in **Project Settings → Environment Variables**.
4. Leave the Framework Preset as **Next.js** and keep Build, Install, and Output Directory overrides off.
5. Deploy.

## Important files

- `lib/curriculum.json`: full course text and all 75 quiz questions
- `lib/app-state.tsx`: progress, XP, streaks, recordings, chat usage, Shop, and Community state
- `components/lesson/course-lesson.tsx`: repeatable lesson player and three-part Learn navigator
- `components/arena/arena-client.tsx`: open stories, scenarios, recording, transcription, and scoring
- `components/arena/recordings-client.tsx`: dedicated recordings archive
- `components/coach/coach-client.tsx`: Ask Weaver chat interface
- `public/weaver.png`: transparent Weaver mascot asset
- `PROJECT_MAP.md`: route and file guide
