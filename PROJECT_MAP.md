# StoryTuner project map

This repository is a Next.js App Router project. The interface is separated into routes, components, state, and curriculum data so it can be maintained normally in GitHub.

## Main routes

- `app/page.tsx`: Today / Home
- `app/activities/page.tsx`: full curriculum
- `app/activities/[unitId]/page.tsx`: unit overview
- `app/lesson/[lessonId]/page.tsx`: reading, drill, and quiz player
- `app/arena/page.tsx`: recording Arena and Story Reel
- `app/community/page.tsx`: opt-in story sharing
- `app/profile/page.tsx`: profile dashboard
- `app/progress/page.tsx`: detailed progress
- `app/shop/page.tsx`: XP-based Weaver color shop
- `app/settings/page.tsx`: settings and privacy controls
- `app/membership/page.tsx`: free and Plus comparison
- `app/api/feedback/route.ts`: server-side AI feedback

## Core files

- `lib/curriculum.json`: all 14 units, the capstone, 47 reading sections, 15 drills, and 75 quiz questions
- `lib/curriculum.ts`: curriculum types and routing helpers
- `lib/app-state.tsx`: persistent progress, XP, streaks, recordings, Community, settings, and membership state
- `lib/media-store.ts`: private audio/video storage in IndexedDB
- `components/arena/arena-client.tsx`: recording, transcription, feedback, saving, and sharing flow
- `components/lesson/course-lesson.tsx`: complete lesson experience
- `components/bottom-nav.tsx`: primary app navigation
- `app/globals.css`: visual tokens and styles from the supplied interface
- `public/weaver.png`: Weaver mascot asset

## Uploading to GitHub

Upload the entire repository, preserving this folder structure. Do not combine these files into a single `index.html`. Vercel recognizes the Next.js structure automatically.
