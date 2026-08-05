# StoryTuner Community, Checkpoint 2

This update replaces the local demo Community feed with real Supabase text posts.

## Included

- Server-side membership check before rendering Community access
- Authenticated `GET /api/community/feed`
- Authenticated `POST /api/community/posts`
- Chronological feed, 20 posts per page
- Safe author display names only
- Block filtering
- Server-side post validation
- Five-post-per-ten-minute publishing limit
- Real text composer
- Empty, loading, retry, publishing, and load-more states
- Community migration tracked in the repository

## Not included yet

These are intentionally reserved for the next checkpoints:

- Liking and unliking
- Replies and replies to replies
- Editing and deleting posts
- Reports and blocking controls
- Transcript sharing
- Audio sharing and signed playback
- Realtime updates

## Production test

1. Commit and deploy the changed files.
2. Sign in with an account whose `subscriptions` row is active or trialing.
3. Open `/community`.
4. Publish a text post.
5. Refresh the page and confirm the post remains.
6. Open another signed-in paid account and confirm the same post appears.
7. Sign in with a free account and confirm the membership lock appears.
