# StoryTuner project map

This repository is a Next.js App Router project. Preserve the folder structure when uploading it to GitHub.

## Main routes

- `app/page.tsx`: Home dashboard
- `app/activities/page.tsx`: full curriculum
- `app/activities/[unitId]/page.tsx`: unit overview
- `app/lesson/[lessonId]/page.tsx`: Learn, Practice, and Check player
- `app/arena/page.tsx`: open-story and guided-scenario recording Arena
- `app/arena/recordings/page.tsx`: private recordings archive and sharing controls
- `app/coach/page.tsx`: Ask Weaver AI coaching chat
- `app/community/page.tsx`: opt-in story sharing
- `app/profile/page.tsx`: profile dashboard
- `app/progress/page.tsx`: detailed progress and illustrated unit icons
- `app/shop/page.tsx`: XP-based Weaver color shop
- `app/settings/page.tsx`: settings and privacy controls
- `app/membership/page.tsx`: free and Plus comparison

## OpenAI routes

- `app/api/feedback/route.ts`: lesson grading and Arena scoring
- `app/api/transcribe/route.ts`: audio and video transcription
- `app/api/coach/route.ts`: contextual Ask Weaver responses
- `lib/openai-server.ts`: server-only OpenAI request helpers

## Core files

- `lib/curriculum.json`: all 14 units, the capstone, reading sections, drills, and 75 quiz questions
- `lib/curriculum.ts`: curriculum types and routing helpers
- `lib/app-state.tsx`: persistent progress, XP, streaks, recordings, coach quota, Community, settings, and membership state
- `lib/media-store.ts`: private recording storage in IndexedDB
- `components/arena/arena-client.tsx`: two-path Arena, scenario prompts, duration targets, pause-safe recording, automatic transcription, and scoring
- `components/arena/recordings-client.tsx`: recordings archive
- `components/coach/coach-client.tsx`: contextual Weaver chat with formatted responses and daily free-message tracking
- `components/lesson/course-lesson.tsx`: repeatable lesson experience
- `components/profile/progress-client.tsx`: detailed unit completion with custom icons
- `components/bottom-nav.tsx`: primary app navigation
- `app/globals.css`: visual tokens and blue accent system
- `public/weaver.png`: transparent mascot asset

## GitHub and Vercel

Do not combine these files into a single `index.html`. The repository root should contain `app`, `components`, `lib`, `public`, and the project configuration files. Vercel recognizes the Next.js structure automatically.
