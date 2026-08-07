# August 7 moderation and account recovery update

This update:

- synchronizes visible Community response counts with active replies whenever a conversation opens,
- excludes removed nested replies from the visible nested-reply count,
- shows the reported post/reply and moderator note on suspended or banned account screens,
- replaces the looping "Return to sign in" link with a real "Use another account" action that signs out first,
- reorganizes moderation into New, Decisions, and Dismissed,
- lets the StoryTuner owner reopen dismissed reports,
- lets the StoryTuner owner undo a resolved decision and return the report to New for revision,
- safely restores content or clears a restriction only when that report is still the latest moderation action responsible for it.

No new Supabase migration is required.
