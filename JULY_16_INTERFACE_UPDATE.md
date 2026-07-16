# StoryTuner interface and Weaver update

## Included

- Rebuilt the public introduction as a full-height Weaver-led flow inspired by the clarity and pacing of top mobile onboarding experiences while preserving StoryTuner's existing visual system.
- Added five isolated, transparent Weaver emotion assets for the introduction.
- Expanded Weaver's positioning across the app from recording follow-up only to complete storytelling craft coaching.
- Added real private long-term coaching personalization from prior recording transcripts, scores, strengths, and revisions when the user explicitly opts in.
- Moved Account controls to the bottom of Settings, removed Change password, made Log out red, and added a designed confirmation dialog.
- Added a blue confirmation check for display-name changes plus a confirmation dialog before saving to Supabase.
- Removed streak repair from the interface and app-state API.
- Redesigned notification selects.
- Added red destructive actions and irreversible-action confirmation dialogs for deleting recordings and local app data.

## Required Supabase step

If `202607150001_create_profiles.sql` was already run, also run:

```text
supabase/migrations/202607160001_add_ai_personalization.sql
```

New Supabase projects can run the updated original profiles migration, which already includes the new field.

## Privacy behavior

When personalization is enabled, the browser sends limited text summaries from up to five past recordings. The coach route verifies the user's Supabase opt-in before using that context. Raw video files are not included in the coaching prompt.
