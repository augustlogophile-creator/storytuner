# Long recording backend

StoryTuner now sends the separate low-bitrate audio track directly from the browser to the private Supabase Storage bucket. The full video remains in IndexedDB on the current device. This avoids sending large media through Vercel.

## Required Supabase pieces

1. Run `supabase/migrations/202607170001_recording_storage.sql`.
2. Add the `OPENAI_API_KEY` Edge Function secret.
3. Deploy `supabase/functions/transcribe-recording/index.ts` as `transcribe-recording`.
4. Keep **Verify JWT with legacy secret** off because the function validates the caller with `auth.getUser()` and relies on Row Level Security.

## Flow

1. The browser records the normal media file and a separate 48 kbps audio-only track.
2. The audio-only track is uploaded to `storytuner-recordings/<user-id>/...`.
3. A self-only `recording_uploads` row tracks upload and transcription status.
4. The Edge Function downloads the private audio and sends it to OpenAI transcription.
5. The transcript is saved to the row and returned to the Arena.
6. Recording metadata, scores, feedback, and revisions sync through `user_app_state`.
7. The Recordings page reconciles synced metadata with authoritative `recording_uploads` rows on sign-in, focus, and reconnect.
8. Playback on another device uses a short-lived signed URL for the private audio object.
9. Deleting a saved recording removes its Supabase audio object, database row, local media, and synced archive entry.

## Limits

- Maximum target length: 30 minutes.
- Application audio limit: 24 MB.
- Bucket file limit: 25 MB.
- Full video stays only on the original device; compressed private audio is available across devices.
- Failed or interrupted uploads older than 24 hours are cleaned up when the signed-in app next syncs.

## Production test

1. Sign in with Google.
2. Record a story for at least 50 words.
3. On the review screen, confirm the status moves from private upload to transcription.
4. Confirm a transcript appears.
5. In Supabase, verify one object exists in the private bucket under the signed-in user ID.
6. Verify the matching `recording_uploads` row has status `ready`.
7. Delete the recording inside StoryTuner and confirm both the object and row are removed.
