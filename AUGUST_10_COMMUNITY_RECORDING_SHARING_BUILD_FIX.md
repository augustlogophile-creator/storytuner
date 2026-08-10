# Community recording sharing build fix

Fixes the Vercel TypeScript error in `components/community/share-recording-dialog.tsx` where `recording` was still considered possibly `null` inside the async `share()` closure.

The component now captures the already-validated recording as `activeRecording` before the async callback and uses that stable non-null reference inside the callback and rendered title.

No database, Supabase, or Edge Function changes are required.
