-- StoryTuner Community foundation
-- Creates the paid-member community schema, reply threads, likes, reports,
-- blocking, moderation records, and a private bucket for explicitly shared audio.

create extension if not exists pgcrypto;
create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- A Community post may be ordinary text, a shared transcript, shared audio,
-- or shared audio plus a transcript snapshot.
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null default 'text'
    check (post_type in ('text', 'transcript', 'audio', 'audio_transcript')),
  title text,
  body text not null default '',
  shared_transcript text,
  status text not null default 'active'
    check (status in ('active', 'deleted', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint community_posts_title_length
    check (title is null or char_length(title) between 1 and 120),
  constraint community_posts_body_length
    check (char_length(body) <= 5000),
  constraint community_posts_transcript_length
    check (shared_transcript is null or char_length(shared_transcript) between 1 and 12000),
  constraint community_posts_type_content
    check (
      (post_type = 'text' and char_length(btrim(body)) between 1 and 5000 and shared_transcript is null)
      or (post_type = 'transcript' and shared_transcript is not null)
      or (post_type = 'audio' and shared_transcript is null)
      or (post_type = 'audio_transcript' and shared_transcript is not null)
    )
);

-- Replies can point to another reply. The application will show no more than
-- two visual indentation levels even though the database preserves the parent.
create table if not exists public.community_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_reply_id uuid references public.community_replies(id) on delete set null,
  body text not null,
  status text not null default 'active'
    check (status in ('active', 'deleted', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint community_replies_body_length
    check (char_length(btrim(body)) between 1 and 2000),
  constraint community_replies_not_self_parent
    check (parent_reply_id is null or parent_reply_id <> id)
);

create table if not exists public.community_post_likes (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.community_reply_likes (
  reply_id uuid not null references public.community_replies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- A separate Community copy protects the user's private Story Reel recording.
-- Deleting a Community post never deletes the original private recording.
create table if not exists public.community_audio (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.community_posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_recording_id uuid references public.recording_uploads(id) on delete set null,
  storage_path text not null unique,
  content_type text not null,
  size_bytes bigint not null
    check (size_bytes between 1 and 12582912),
  duration_seconds integer not null
    check (duration_seconds between 1 and 300),
  status text not null default 'ready'
    check (status in ('ready', 'deleting', 'failed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.community_posts(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  reason text not null
    check (reason in ('harassment', 'hate', 'sexual_content', 'violence', 'self_harm', 'personal_information', 'spam', 'other')),
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  resolution_note text,
  constraint community_reports_one_target
    check ((post_id is not null)::integer + (reply_id is not null)::integer = 1),
  constraint community_reports_details_length
    check (details is null or char_length(details) <= 1000),
  constraint community_reports_resolution_length
    check (resolution_note is null or char_length(resolution_note) <= 2000)
);

create table if not exists public.community_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_user_blocks_not_self
    check (blocker_id <> blocked_id)
);

-- This table is service-role managed. It does not make profile metadata public.
create table if not exists public.community_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'moderator'
    check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now()
);

-- Indexes used by chronological feeds, threads, moderation, and block filtering.
create index if not exists community_posts_feed_idx
  on public.community_posts (created_at desc)
  where status = 'active';
create index if not exists community_posts_author_idx
  on public.community_posts (author_id, created_at desc);
create index if not exists community_replies_post_idx
  on public.community_replies (post_id, created_at asc);
create index if not exists community_replies_author_idx
  on public.community_replies (author_id, created_at desc);
create index if not exists community_replies_parent_idx
  on public.community_replies (parent_reply_id)
  where parent_reply_id is not null;
create index if not exists community_post_likes_user_idx
  on public.community_post_likes (user_id, created_at desc);
create index if not exists community_reply_likes_user_idx
  on public.community_reply_likes (user_id, created_at desc);
create index if not exists community_reports_status_idx
  on public.community_reports (status, created_at asc);
create index if not exists community_reports_reporter_idx
  on public.community_reports (reporter_id, created_at desc);
create index if not exists community_user_blocks_blocked_idx
  on public.community_user_blocks (blocked_id, blocker_id);

-- Shared updated_at trigger used by posts and replies.
create or replace function public.update_community_timestamp()
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

drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at
before update on public.community_posts
for each row execute function public.update_community_timestamp();

drop trigger if exists community_replies_updated_at on public.community_replies;
create trigger community_replies_updated_at
before update on public.community_replies
for each row execute function public.update_community_timestamp();

-- A child reply must belong to the same post as its parent.
create or replace function public.validate_community_reply_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_reply_id is null then
    return new;
  end if;

  select post_id
  into parent_post_id
  from public.community_replies
  where id = new.parent_reply_id;

  if parent_post_id is null then
    raise exception 'Parent reply does not exist.';
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Parent reply must belong to the same post.';
  end if;

  return new;
end;
$$;

drop trigger if exists community_replies_validate_parent on public.community_replies;
create trigger community_replies_validate_parent
before insert or update of post_id, parent_reply_id on public.community_replies
for each row execute function public.validate_community_reply_parent();

-- RLS helper. Authorization is based on the trusted subscriptions table,
-- never browser state or user-editable profile metadata.
create or replace function private.current_user_has_active_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = (select auth.uid())
      and s.status in ('active', 'trialing')
      and (s.current_period_end is null or s.current_period_end > now())
  );
$$;

revoke all on function private.current_user_has_active_membership() from public;
grant execute on function private.current_user_has_active_membership() to authenticated, service_role;

-- Blocks work in both directions. Neither person sees or interacts with the
-- other person's content after either side creates a block.
create or replace function private.community_relationship_is_blocked(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_user_blocks b
    where
      (b.blocker_id = (select auth.uid()) and b.blocked_id = other_user_id)
      or
      (b.blocked_id = (select auth.uid()) and b.blocker_id = other_user_id)
  );
$$;

revoke all on function private.community_relationship_is_blocked(uuid) from public;
grant execute on function private.community_relationship_is_blocked(uuid) to authenticated, service_role;

-- Enable RLS on every Community table.
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_reply_likes enable row level security;
alter table public.community_audio enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_user_blocks enable row level security;
alter table public.community_moderators enable row level security;

-- Do not allow direct browser mutations. All writes go through authenticated
-- Next.js route handlers, which validate content and use the service role.
revoke all on table public.community_posts from anon, authenticated;
revoke all on table public.community_replies from anon, authenticated;
revoke all on table public.community_post_likes from anon, authenticated;
revoke all on table public.community_reply_likes from anon, authenticated;
revoke all on table public.community_audio from anon, authenticated;
revoke all on table public.community_reports from anon, authenticated;
revoke all on table public.community_user_blocks from anon, authenticated;
revoke all on table public.community_moderators from anon, authenticated;

grant select on table public.community_posts to authenticated;
grant select on table public.community_replies to authenticated;
grant select on table public.community_audio to authenticated;
grant select on table public.community_post_likes to authenticated;
grant select on table public.community_reply_likes to authenticated;
grant select on table public.community_user_blocks to authenticated;

grant select, insert, update, delete on table public.community_posts to service_role;
grant select, insert, update, delete on table public.community_replies to service_role;
grant select, insert, update, delete on table public.community_post_likes to service_role;
grant select, insert, update, delete on table public.community_reply_likes to service_role;
grant select, insert, update, delete on table public.community_audio to service_role;
grant select, insert, update, delete on table public.community_reports to service_role;
grant select, insert, update, delete on table public.community_user_blocks to service_role;
grant select, insert, update, delete on table public.community_moderators to service_role;

-- Paid members can read active feed posts unless a block exists in either direction.
drop policy if exists "Paid members can read active Community posts" on public.community_posts;
create policy "Paid members can read active Community posts"
on public.community_posts for select
to authenticated
using (
  (select private.current_user_has_active_membership())
  and status = 'active'
  and not (select private.community_relationship_is_blocked(author_id))
);

-- Deleted replies may remain visible as placeholders so child replies retain context.
drop policy if exists "Paid members can read Community replies" on public.community_replies;
create policy "Paid members can read Community replies"
on public.community_replies for select
to authenticated
using (
  (select private.current_user_has_active_membership())
  and status in ('active', 'deleted')
  and not (select private.community_relationship_is_blocked(author_id))
  and exists (
    select 1
    from public.community_posts p
    where p.id = community_replies.post_id
      and p.status = 'active'
  )
);

-- Members can see their own like rows. Aggregate counts come from the server API.
drop policy if exists "Members can read their own post likes" on public.community_post_likes;
create policy "Members can read their own post likes"
on public.community_post_likes for select
to authenticated
using (
  (select private.current_user_has_active_membership())
  and user_id = (select auth.uid())
);

drop policy if exists "Members can read their own reply likes" on public.community_reply_likes;
create policy "Members can read their own reply likes"
on public.community_reply_likes for select
to authenticated
using (
  (select private.current_user_has_active_membership())
  and user_id = (select auth.uid())
);

-- Audio metadata is readable only when its active post is visible to the member.
drop policy if exists "Paid members can read shared Community audio metadata" on public.community_audio;
create policy "Paid members can read shared Community audio metadata"
on public.community_audio for select
to authenticated
using (
  (select private.current_user_has_active_membership())
  and not (select private.community_relationship_is_blocked(owner_id))
  and exists (
    select 1
    from public.community_posts p
    where p.id = community_audio.post_id
      and p.status = 'active'
  )
);

-- Users may inspect only block relationships they created. Creation and deletion
-- still occur through validated server routes.
drop policy if exists "Users can read blocks they created" on public.community_user_blocks;
create policy "Users can read blocks they created"
on public.community_user_blocks for select
to authenticated
using (blocker_id = (select auth.uid()));

-- Reports and moderator membership are service-role only.
-- No authenticated SELECT policy is intentionally defined for either table.

-- Private bucket used only for copies that a user explicitly shares.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'storytuner-community-audio',
  'storytuner-community-audio',
  false,
  12582912,
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

-- No authenticated storage.objects policies are created for this bucket.
-- The Next.js server copies, signs, and deletes Community audio with the
-- service-role client after verifying membership, ownership, and post status.
