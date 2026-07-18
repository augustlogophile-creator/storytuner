-- Private long-recording audio storage and transcription metadata.
create extension if not exists pgcrypto;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'storytuner-recordings',
  'storytuner-recordings',
  false,
  26214400,
  array[
    'audio/webm',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.recording_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null default 'audio/webm',
  size_bytes bigint not null default 0
    check (size_bytes >= 0 and size_bytes <= 26214400),
  duration_seconds integer not null
    check (duration_seconds between 1 and 1800),
  status text not null default 'uploading'
    check (status in ('uploading', 'uploaded', 'transcribing', 'ready', 'failed')),
  transcript text,
  title text,
  word_count integer,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.recording_uploads enable row level security;
revoke all on table public.recording_uploads from anon;
grant select, insert, update, delete on table public.recording_uploads to authenticated;

create index if not exists recording_uploads_user_created_idx
  on public.recording_uploads (user_id, created_at desc);

drop policy if exists "Users can read their recording uploads" on public.recording_uploads;
create policy "Users can read their recording uploads"
on public.recording_uploads for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their recording uploads" on public.recording_uploads;
create policy "Users can create their recording uploads"
on public.recording_uploads for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their recording uploads" on public.recording_uploads;
create policy "Users can update their recording uploads"
on public.recording_uploads for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their recording uploads" on public.recording_uploads;
create policy "Users can delete their recording uploads"
on public.recording_uploads for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can upload their own recording audio" on storage.objects;
create policy "Users can upload their own recording audio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can read their own recording audio" on storage.objects;
create policy "Users can read their own recording audio"
on storage.objects for select
to authenticated
using (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their own recording audio" on storage.objects;
create policy "Users can update their own recording audio"
on storage.objects for update
to authenticated
using (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own recording audio" on storage.objects;
create policy "Users can delete their own recording audio"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'storytuner-recordings'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.update_recording_upload_timestamp()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recording_uploads_updated_at on public.recording_uploads;
create trigger recording_uploads_updated_at
before update on public.recording_uploads
for each row execute function public.update_recording_upload_timestamp();
