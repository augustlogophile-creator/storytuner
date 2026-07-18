# Recording history and curriculum update

## Recording history across devices

- Signed-in users load authoritative ready recordings from `recording_uploads`.
- Scores, feedback, revisions, prompts, and display metadata sync through `user_app_state`.
- Private audio playback uses a one-hour signed Storage URL.
- Full video stays on the device where it was recorded.
- Deleting a recording removes local media, the private Storage object, the database row, and the synced archive entry.
- Failed or interrupted uploads older than 24 hours are cleaned up when the app next syncs.

No new Supabase migration is required for this update.

## Curriculum order

Every unit now uses this sequence:

1. Learn
2. Check
3. Practice

The check unlocks after Learn, and Practice unlocks only after the check is complete. Existing lesson IDs and saved completion data remain compatible.
