# StoryTuner server usage enforcement

This checkpoint moves the free-plan AI limits out of browser-owned state and into server-owned Supabase usage events.

## Enforced on the server

- Ask Weaver: 5 free messages total.
- Arena: 2 free spoken story reviews total.
- Arena transcription consumes the same review slot as grading, using one idempotent request key.
- Free Arena recording targets are capped at 5 minutes. Longer targets require Membership.
- Lessons 6-15 are checked on the server before their unit or lesson page is served.
- Lesson AI feedback also checks the unit number server-side.
- Story Planner remains paid-only and its 10-per-day limit remains server-owned through `story_plans`.

## Database

`user_usage_events` is not writable by normal authenticated clients. The service-role server reserves a usage slot through `reserve_storytuner_usage`, which serializes simultaneous requests per user and feature so concurrent requests cannot exceed the free limit.

The migration seeds existing free usage from `user_app_state` so current users do not receive a fresh allowance simply because the new server counter was added.

## Failure behavior

A newly reserved slot is released if the corresponding OpenAI request fails. Retrying the same request key does not consume another slot.
