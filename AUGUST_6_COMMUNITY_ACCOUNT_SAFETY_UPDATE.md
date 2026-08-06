# Community and account safety update

This update adds:

- StoryTuner confirmation dialogs for Community post and reply deletion.
- A simplified Community layout with compact action menus and response threads.
- Private reports for posts and replies, stored in `community_reports`.
- A confirmation step before spending XP on a Weaver, followed by automatic equipping.
- Server-rendered membership status on the billing page to remove the free-plan flash.
- Account-scoped app-state caches so XP, streaks, recordings, and Weaver purchases do not leak between Google accounts.
- A cloud-state ownership marker and a legacy mismatch check.
- Email-based username suggestions instead of a fixed example.
- Client and database checks that reject vulgar, sexual, hateful, or harassing public names.

## Required SQL

Run `supabase/migrations/202608060001_public_name_safety_and_report_deduplication.sql` once in the Supabase SQL Editor before deploying the code.

## Existing test accounts

The new code prevents future cross-account state mixing and automatically discards most mismatched legacy state. If a test account was already contaminated and used the same display name as the original account, use Settings > Delete all app data once on that affected test account.
