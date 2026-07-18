# StoryTuner progress sync

StoryTuner now keeps the app usable offline while syncing signed-in user progress to `public.user_app_state` in Supabase.

Synced data includes lesson completion, responses, quiz scores, XP, streaks, Weaver ownership, app preferences, coaching history, free-use counters, and onboarding/profile progress.

Membership remains controlled by the Stripe-backed `subscriptions` table and is never trusted from synced JSON.

Recording media and Community posts are not part of this JSON sync. Recording audio/transcripts continue to use the dedicated private recording backend, and a shared Community backend should be implemented separately.

Behavior:

- Existing local progress becomes the first cloud state when no cloud row exists.
- Existing cloud and local progress are merged when a user signs in on another device.
- Changes save automatically after a short debounce.
- Offline changes remain local and sync when connectivity returns.
- Returning focus to the app pulls and merges newer cloud progress.
- Deleting all app data removes the cloud row and resets local app state.
