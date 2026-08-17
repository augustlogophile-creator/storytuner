-- Allow Community sharing for long StoryTuner recordings.
-- Private recordings already support up to 30 minutes and 24 MB of audio.
-- This migration brings the separate Community copy in line with those limits.

alter table public.community_audio
  drop constraint if exists community_audio_size_bytes_check;

alter table public.community_audio
  add constraint community_audio_size_bytes_check
  check (size_bytes between 1 and 25165824);

alter table public.community_audio
  drop constraint if exists community_audio_duration_seconds_check;

alter table public.community_audio
  add constraint community_audio_duration_seconds_check
  check (duration_seconds between 1 and 1800);

alter table public.community_posts
  drop constraint if exists community_posts_transcript_length;

alter table public.community_posts
  add constraint community_posts_transcript_length
  check (shared_transcript is null or char_length(shared_transcript) between 1 and 30000);

update storage.buckets
set file_size_limit = 26214400
where id = 'storytuner-community-audio';
