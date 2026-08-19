-- Tellwise upload hardening.
-- Keeps recording objects private, caps each object at exactly 24 MiB, tightens
-- recording metadata mutations, and reduces object-spam capacity.

update storage.buckets
set
  public = false,
  file_size_limit = 25165824,
  allowed_mime_types = array[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
where id = 'storytuner-recordings';

update storage.buckets
set
  public = false,
  file_size_limit = 25165824,
  allowed_mime_types = array[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
where id = 'storytuner-community-audio';

alter table public.recording_uploads
  drop constraint if exists recording_uploads_size_bytes_check;

alter table public.recording_uploads
  add constraint recording_uploads_size_bytes_check
  check (size_bytes between 1 and 25165824);

-- Browser clients no longer get blanket UPDATE rights over immutable upload
-- identity/path/type/size/duration metadata. Existing transcript/title editing stays
-- available because Studio intentionally lets users correct their saved transcript.
revoke update on table public.recording_uploads from authenticated;
grant update (status, error_message, title, transcript, word_count) on table public.recording_uploads to authenticated;

create or replace function private.current_user_can_create_recording_upload()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from public.recording_uploads r
    where r.user_id = (select auth.uid())
      and r.created_at > now() - interval '1 hour'
  ) < case
    when exists (
      select 1 from public.subscriptions s
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    ) then 12
    else 6
  end;
$$;

revoke all on function private.current_user_can_create_recording_upload() from public;
grant execute on function private.current_user_can_create_recording_upload() to authenticated, service_role;

drop policy if exists "Users can create their recording uploads" on public.recording_uploads;
create policy "Users can create their recording uploads"
on public.recording_uploads for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'uploading'
  and transcript is null
  and title is null
  and word_count is null
  and error_message is null
  and size_bytes between 1 and 25165824
  and duration_seconds between 1 and 1800
  and storage_path like ((select auth.uid())::text || '/' || id::text || '.%')
  and (
    (content_type = 'audio/webm' and storage_path like '%.webm')
    or (content_type = 'audio/ogg' and storage_path like '%.ogg')
    or (content_type = 'audio/mpeg' and storage_path like '%.mp3')
    or (content_type = 'audio/mp4' and storage_path like '%.m4a')
    or (content_type in ('audio/wav', 'audio/x-wav') and storage_path like '%.wav')
  )
  and (select private.current_user_can_create_recording_upload())
);

drop policy if exists "Users can upload their own recording audio" on storage.objects;
create policy "Users can upload their own recording audio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.recording_uploads r
    where r.user_id = (select auth.uid())
      and r.storage_path = name
      and r.status = 'uploading'
      and r.size_bytes between 1 and 25165824
  )
);
