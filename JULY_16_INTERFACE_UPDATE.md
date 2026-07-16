# StoryTuner interface, settings, and Arena update

## Included

- Restored the original StoryTuner introduction content, sequence, controls, and classic Weaver artwork.
- Removed the alternate Weaver emotion artwork from the introduction.
- Rebuilt the original introduction on the same 28rem-wide, full-height canvas used throughout StoryTuner.
- Updated introduction, account, and profile-setup containers to use exactly the same app width and height behavior.
- Expanded Weaver's positioning across the app from recording follow-up only to complete storytelling craft coaching.
- Added real private long-term coaching personalization from prior recording transcripts, scores, strengths, and revisions when the user explicitly opts in.
- Moved Account controls to the bottom of Settings, removed Change password, made Log out red, and added a designed confirmation dialog.
- Added a blue confirmation check for display-name changes plus a confirmation dialog before saving to Supabase.
- Removed streak repair from the interface and app-state API.
- Replaced native notification selects with polished menus that always open below their controls.
- Changed the two data-deletion controls to lightly filled red-outline buttons, with irreversible-action confirmation dialogs.
- Added Membership-only 10-minute and 20-minute Arena targets.
- Added a Membership-only custom Arena target from 1:00 through 30:00.

- Combined Sign up and Log in into one Google-only page that defaults to Sign up.
- Removed user-facing named storytelling ranks.
- Kept confirmation dialogs within the standard StoryTuner app width.

## Required Supabase step

If `202607150001_create_profiles.sql` was already run, also run:

```text
supabase/migrations/202607160001_add_ai_personalization.sql
```

New Supabase projects can run the updated original profiles migration, which already includes the new field.

## Privacy behavior

When personalization is enabled, the browser sends limited text summaries from up to five past recordings. The coach route verifies the user's Supabase opt-in before using that context. Raw video files are not included in the coaching prompt.
