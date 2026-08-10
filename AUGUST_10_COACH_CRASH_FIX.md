# August 10 Coach crash fix

This update hardens Ask Weaver after the server-side usage-limit rollout.

- Sanitizes legacy/synced Coach messages before rendering or merging.
- Adds fallback IDs and timestamps for older Coach history.
- Prevents malformed saved Coach messages from crashing cloud-state merge.
- Validates `/api/coach` response fields before adding them to client state.
- Clamps server-reported free-message counts to safe numeric values.
- Makes RichText tolerate an invalid/non-string value instead of throwing.

No Supabase migration is required.
