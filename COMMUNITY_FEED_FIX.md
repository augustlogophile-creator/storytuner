# Community feed reliability and hierarchy fix

This patch:

- reads the main feed through the signed-in Supabase client so paid-member and block RLS policies remain the source of truth
- prevents optional author, like-count, or reply-count lookups from taking down the feed
- keeps a newly published post visible even when an earlier feed refresh failed
- clears the stale feed error after a successful publish
- keeps already loaded posts visible if a later refresh fails
- restructures the page into a clear introduction, composer, and separate Community feed section

No Supabase SQL changes are required.
