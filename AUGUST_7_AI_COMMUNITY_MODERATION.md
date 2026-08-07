# StoryTuner AI Community moderation

This checkpoint screens every new or edited Community text post and reply with OpenAI's moderation endpoint before the content can remain visible.

## Behavior

- Uses `omni-moderation-latest` by default.
- Safe content publishes normally.
- Flagged content is stored with `status = removed`, so it is not visible in Community.
- An AI-sourced report is created in the existing owner moderation queue.
- The member sees a neutral "Held for review" message.
- The AI never suspends or bans an account automatically in this checkpoint.
- Severe categories can produce a 7-day Community-suspension recommendation for the owner to approve or change.
- Self-harm flags are held for manual review without an automatic punishment recommendation.
- If the OpenAI moderation check is unavailable, publishing fails closed with a retry message rather than posting unchecked content.
- Editing an existing post or reply runs the same safety check, so editing cannot bypass moderation.
- Dismissing an AI flag restores the auto-held content. The owner can also explicitly restore content from the moderation action menu.

## Database changes

Migration: `supabase/migrations/202608070001_ai_community_moderation.sql`

It extends `community_reports` so reports can come from either a signed-in user or StoryTuner AI moderation and stores the model, top category, score, and recommendation for AI flags.

## Environment

The existing `OPENAI_API_KEY` is reused. No new API key is required.

Optional override:

`OPENAI_MODERATION_MODEL=omni-moderation-latest`
