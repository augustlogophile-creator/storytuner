# StoryTuner moderation decision + response-count update

This checkpoint makes visible response counts come from active, viewer-visible replies instead of stale aggregate state. The Community feed refreshes when the tab regains focus and periodically while visible, and an open conversation refreshes when the visible reply count changes.

Resolved moderation decisions are now editable. The owner can keep or change the current restriction, clear all restrictions, set a new Community or full-account suspension for 1–3650 days, escalate to a permanent ban, and independently keep/remove/restore the reported content. Every revision is appended to the existing moderation action history.

No Supabase migration is required for this update.
