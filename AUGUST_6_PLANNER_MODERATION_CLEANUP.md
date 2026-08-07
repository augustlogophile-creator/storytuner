# Planner and moderation cleanup

## Story Planner
- `/planner` now requires an active StoryTuner Membership at both the page and API levels.
- Free accounts are redirected to Membership and cannot load saved plans or call the planning API directly.
- The page now uses the standard StoryTuner mobile width.
- The Arena entry point is a compact `Need help planning?` control.
- Membership copy now lists AI Story Planner as a paid feature.

## Community moderation
- `/admin/community` is available only when the signed-in Supabase email claim is exactly `storytunerapp@gmail.com`.
- The same email check protects both moderation API routes, not only the visible page.
- The dashboard now uses the standard StoryTuner page width and a condensed report workflow.
- The owner can remove their own reported content for testing, but the owner account cannot be suspended or banned.
- Moderation actions no longer depend on a separate `community_moderators` lookup, fixing the false `Moderator access required` response.
