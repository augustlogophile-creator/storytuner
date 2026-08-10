# Community recording sharing

This checkpoint connects private Arena recordings to the real Supabase Community.

## Sharing choices

Paid members can deliberately share a saved recording as:

- transcript only
- audio only
- audio plus transcript

Nothing is shared automatically.

## Privacy model

The original recording remains in the private `storytuner-recordings` bucket. Audio sharing creates a separate copy in the private `storytuner-community-audio` bucket. Deleting a Community post removes the Community copy without deleting the original recording. Deleting the original recording does not remove an already-shared Community copy.

## Safety

Every shared recording is screened using its transcript before it can become visible. Audio-only shares are screened using the trusted transcript stored with the source recording. Flagged shares are held for moderator review and remain inaccessible to ordinary Community members.

## Audio limits

Community audio is limited by the existing backend schema to 5 minutes and 12 MB. Longer recordings can still be shared as transcript-only posts.

## Playback

Community audio never uses a public bucket URL. The app requests a short-lived signed URL only after verifying that the viewer is signed in, has an active membership, and can access the active Community post.
