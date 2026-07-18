# StoryTuner progress sync

StoryTuner now keeps the app usable offline while syncing signed-in user progress to `public.user_app_state` in Supabase.

Synced data includes lesson completion, responses, quiz scores, XP, streaks, Weaver ownership, app preferences, coaching history, free-use counters, onboarding/profile progress, and recording metadata such as scores, feedback, revisions, and private cloud references.

Membership remains controlled by the Stripe-backed `subscriptions` table and is never trusted from synced JSON.

Raw recording media is not stored inside this JSON. Private compressed audio and transcripts remain in the dedicated recording backend, while the metadata needed to rebuild the Recordings page follows the account. Community posts are still separate and should receive their own shared backend.

Behavior:

- Existing local progress becomes the first cloud state when no cloud row exists.
- Existing cloud and local progress are merged when a user signs in on another device.
- Changes save automatically after a short debounce.
- Offline changes remain local and sync when connectivity returns.
- Returning focus to the app pulls and merges newer cloud progress.
- Deleting all app data removes the cloud row and resets local app state.
