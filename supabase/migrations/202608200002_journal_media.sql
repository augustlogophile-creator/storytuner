-- Tellwise Journal media support. Journal media is private, owner-scoped, and
-- stored in a non-public bucket separate from Studio recordings.

alter table public.journal_entries
  add column if not exists entry_type text not null default 'text',
  add column if not exists media_storage_path text,
  add column if not exists media_content_type text,
  add column if not exists media_size_bytes bigint,
  add column if not exists media_duration_seconds integer;

alter table public.journal_entries
  drop constraint if exists journal_entries_entry_type_check;
alter table public.journal_entries
  add constraint journal_entries_entry_type_check
  check (entry_type in ('text', 'audio', 'video'));

alter table public.journal_entries
  drop constraint if exists journal_entries_media_size_check;
alter table public.journal_entries
  add constraint journal_entries_media_size_check
  check (media_size_bytes is null or media_size_bytes between 1 and 20971520);

alter table public.journal_entries
  drop constraint if exists journal_entries_media_duration_check;
alter table public.journal_entries
  add constraint journal_entries_media_duration_check
  check (media_duration_seconds is null or media_duration_seconds between 1 and 600);

create unique index if not exists journal_entries_media_storage_path_idx
  on public.journal_entries (media_storage_path)
  where media_storage_path is not null;


create or replace function private.current_user_can_create_journal_media()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*)
    from public.journal_entries j
    where j.user_id = (select auth.uid())
      and j.entry_type in ('audio','video')
      and j.created_at > now() - interval '1 hour'
  ) < 12;
$$;

revoke all on function private.current_user_can_create_journal_media() from public;
grant execute on function private.current_user_can_create_journal_media() to authenticated, service_role;

-- Keep the insert/update policy strict now that media metadata exists.
drop policy if exists "Users can create their journal entries" on public.journal_entries;
create policy "Users can create their journal entries"
on public.journal_entries for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and char_length(btrim(title)) between 1 and 120
  and char_length(btrim(body)) between 1 and 20000
  and entry_type in ('text', 'audio', 'video')
  and (
    (entry_type = 'text' and media_storage_path is null and media_content_type is null and media_size_bytes is null and media_duration_seconds is null)
    or (
      entry_type in ('audio', 'video')
      and media_storage_path like ((select auth.uid())::text || '/' || id::text || '.%')
      and media_size_bytes between 1 and 20971520
      and media_duration_seconds between 1 and 600
      and (select private.current_user_can_create_journal_media())
      and (
        (entry_type = 'audio' and media_content_type in ('audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav'))
        or (entry_type = 'video' and media_content_type in ('video/webm','video/mp4'))
      )
    )
  )
);

drop policy if exists "Users can update their journal entries" on public.journal_entries;
create policy "Users can update their journal entries"
on public.journal_entries for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and char_length(btrim(title)) between 1 and 120
  and char_length(btrim(body)) between 1 and 20000
  and entry_type in ('text', 'audio', 'video')
  and (media_size_bytes is null or media_size_bytes between 1 and 20971520)
  and (media_duration_seconds is null or media_duration_seconds between 1 and 600)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tellwise-journal-media',
  'tellwise-journal-media',
  false,
  20971520,
  array[
    'audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav',
    'video/webm','video/mp4'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their own Journal media" on storage.objects;
create policy "Users can upload their own Journal media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'tellwise-journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.journal_entries j
    where j.user_id = (select auth.uid())
      and j.media_storage_path = name
      and j.entry_type in ('audio','video')
      and j.media_size_bytes between 1 and 20971520
  )
);

drop policy if exists "Users can read their own Journal media" on storage.objects;
create policy "Users can read their own Journal media"
on storage.objects for select
to authenticated
using (
  bucket_id = 'tellwise-journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their own Journal media" on storage.objects;
create policy "Users can delete their own Journal media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'tellwise-journal-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Browser clients may edit the note text, but media identity/path/type/size are immutable.
revoke update on table public.journal_entries from authenticated;
grant update (title, body) on table public.journal_entries to authenticated;
