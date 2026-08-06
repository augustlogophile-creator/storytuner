# Community Checkpoint 3

This checkpoint adds real member interaction to the Supabase Community feed.

## Added

- Like and unlike Community posts
- Load reply threads on demand
- Add replies to posts
- Reply to another reply while keeping two visual indentation levels
- Like and unlike replies
- Edit the signed-in user's own text posts
- Delete the signed-in user's own posts
- Edit the signed-in user's own replies
- Soft-delete replies so child-reply context remains intact
- Server-side membership, visibility, and ownership verification for every mutation
- Accurate post and reply counts after refresh
- Posting rate limits already established in Checkpoint 2, plus a reply rate limit

## API routes

- `PATCH /api/community/posts/[postId]`
- `DELETE /api/community/posts/[postId]`
- `POST /api/community/posts/[postId]/like`
- `DELETE /api/community/posts/[postId]/like`
- `GET /api/community/posts/[postId]/replies`
- `POST /api/community/posts/[postId]/replies`
- `PATCH /api/community/replies/[replyId]`
- `DELETE /api/community/replies/[replyId]`
- `POST /api/community/replies/[replyId]/like`
- `DELETE /api/community/replies/[replyId]/like`

## Database setup

No new SQL is required. All required tables, constraints, indexes, and RLS policies were created by `202608050001_community_foundation.sql`.
