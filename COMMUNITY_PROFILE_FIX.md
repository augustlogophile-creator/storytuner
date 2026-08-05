# Community profile verification fix

This patch:

- verifies the signed-in user's profile through their authenticated Supabase session
- keeps the service-role client for protected Community database operations
- makes the paid Membership requirement explicit for free users
- shows paid users a Membership active indicator
- switches to the paid Membership lock if an API request returns a Membership-related 403

No SQL changes are required.

Upload these files to the root of the StoryTuner repository and preserve their folders.

Suggested commit message:

Fix Community profile verification and membership gate
