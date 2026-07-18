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
6. Deleting a saved recording also deletes its Supabase audio object and database row.

## Limits

- Maximum target length: 30 minutes.
- Application audio limit: 24 MB.
- Bucket file limit: 25 MB.
- Short recordings can fall back to the older Vercel transcription route if the cloud path is temporarily unavailable.

## Production test

1. Sign in with Google.
2. Record a story for at least 50 words.
3. On the review screen, confirm the status moves from private upload to transcription.
4. Confirm a transcript appears.
5. In Supabase, verify one object exists in the private bucket under the signed-in user ID.
6. Verify the matching `recording_uploads` row has status `ready`.
7. Delete the recording inside StoryTuner and confirm both the object and row are removed.
