-- StoryTuner security hardening
-- Defense in depth for the public Data API, report submission, and future tables.

-- Every application table exposed through the public schema must have RLS on.
alter table public.profiles enable row level security;
alter table public.recording_uploads enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_app_state enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_replies enable row level security;
alter table public.community_post_likes enable row level security;
alter table public.community_reply_likes enable row level security;
alter table public.community_audio enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_user_blocks enable row level security;
alter table public.community_moderators enable row level security;
alter table public.community_moderation_status enable row level security;
alter table public.community_moderation_actions enable row level security;
alter table public.story_plans enable row level security;
alter table public.user_usage_events enable row level security;
alter table public.coach_exchanges enable row level security;
alter table public.subscription_consent_records enable row level security;
alter table public.ai_output_reports enable row level security;
alter table public.ai_response_reports enable row level security;

-- Anonymous visitors do not need direct access to any application data table.
revoke all on table public.profiles from anon;
revoke all on table public.recording_uploads from anon;
revoke all on table public.subscriptions from anon;
revoke all on table public.user_app_state from anon;
revoke all on table public.community_posts from anon;
revoke all on table public.community_replies from anon;
revoke all on table public.community_post_likes from anon;
revoke all on table public.community_reply_likes from anon;
revoke all on table public.community_audio from anon;
revoke all on table public.community_reports from anon;
revoke all on table public.community_user_blocks from anon;
revoke all on table public.community_moderators from anon;
revoke all on table public.community_moderation_status from anon;
revoke all on table public.community_moderation_actions from anon;
revoke all on table public.story_plans from anon;
revoke all on table public.user_usage_events from anon;
revoke all on table public.coach_exchanges from anon;
revoke all on table public.subscription_consent_records from anon;
revoke all on table public.ai_output_reports from anon;
revoke all on table public.ai_response_reports from anon;

-- Sensitive/server-owned tables must not be writable through a normal user's
-- Supabase Data API session. Next.js routes validate/authenticate and then use
-- the service role for these writes.
revoke all on table public.community_reports from authenticated;
revoke all on table public.community_moderators from authenticated;
revoke all on table public.community_moderation_status from authenticated;
revoke all on table public.community_moderation_actions from authenticated;
revoke all on table public.user_usage_events from authenticated;
revoke all on table public.coach_exchanges from authenticated;
revoke all on table public.subscription_consent_records from authenticated;
revoke all on table public.ai_output_reports from authenticated;
revoke all on table public.ai_response_reports from authenticated;

-- AI response reports are now server-written only. This prevents direct Data API
-- inserts from bypassing StoryTuner validation and rate limits.
drop policy if exists "Users can submit their own AI reports" on public.ai_response_reports;
grant select, insert, update, delete on table public.ai_response_reports to service_role;

-- Re-assert only the direct grants the browser actually needs.
grant select on table public.profiles to authenticated;
-- Profile mutations now go through validated server routes. This prevents direct
-- Data API calls from bypassing display-name/username moderation.
revoke insert, update, delete on table public.profiles from authenticated;
grant select, insert, update, delete on table public.recording_uploads to authenticated;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.user_app_state to authenticated;
grant select on table public.community_posts to authenticated;
grant select on table public.community_replies to authenticated;
grant select on table public.community_audio to authenticated;
grant select on table public.community_post_likes to authenticated;
grant select on table public.community_reply_likes to authenticated;
grant select on table public.community_user_blocks to authenticated;
grant select, delete on table public.story_plans to authenticated;

-- Ensure server-side service operations retain access.
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.recording_uploads to service_role;
grant select, insert, update, delete on table public.subscriptions to service_role;
grant select, insert, update, delete on table public.user_app_state to service_role;
grant select, insert, update, delete on table public.community_posts to service_role;
grant select, insert, update, delete on table public.community_replies to service_role;
grant select, insert, update, delete on table public.community_post_likes to service_role;
grant select, insert, update, delete on table public.community_reply_likes to service_role;
grant select, insert, update, delete on table public.community_audio to service_role;
grant select, insert, update, delete on table public.community_reports to service_role;
grant select, insert, update, delete on table public.community_user_blocks to service_role;
grant select, insert, update, delete on table public.community_moderators to service_role;
grant select, insert, update, delete on table public.community_moderation_status to service_role;
grant select, insert, update, delete on table public.community_moderation_actions to service_role;
grant select, insert, update, delete on table public.story_plans to service_role;
grant select, insert, update, delete on table public.user_usage_events to service_role;
grant select, insert, update, delete on table public.coach_exchanges to service_role;
grant select, insert, update, delete on table public.subscription_consent_records to service_role;
grant select, insert, update, delete on table public.ai_output_reports to service_role;

-- Trigger functions are implementation details, not public RPC endpoints.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.update_subscription_timestamp() from public, anon, authenticated;
revoke execute on function public.update_user_app_state_timestamp() from public, anon, authenticated;
revoke execute on function public.update_recording_upload_timestamp() from public, anon, authenticated;
revoke execute on function public.update_community_timestamp() from public, anon, authenticated;
revoke execute on function public.validate_community_reply_parent() from public, anon, authenticated;
revoke execute on function public.update_community_moderation_timestamp() from public, anon, authenticated;

-- Future public-schema tables/functions start closed. Explicit grants should be
-- added by the migration that intentionally exposes them.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Keep both recording buckets private. Access remains policy/signed-URL based.
update storage.buckets
set public = false
where id in ('storytuner-recordings', 'storytuner-community-audio');

-- Direct recording uploads remain available for the browser, but creation is
-- constrained so a client cannot freely mint arbitrary metadata or storage rows.
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
    ) then 30
    else 8
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
  and storage_path like ((select auth.uid())::text || '/' || id::text || '.%')
  and content_type in ('audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav')
  and (select private.current_user_can_create_recording_upload())
);

-- A private recording object can only be uploaded when its matching, owned
-- metadata row already exists. This blocks arbitrary object spam outside the
-- normal recording flow.
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
  )
);

-- Bound the public Community profile RPC so a paid user cannot submit an
-- unbounded UUID array directly to PostgREST and force an expensive query.
create or replace function public.community_public_profiles(requested_user_ids uuid[])
returns table (
  id uuid,
  username text,
  display_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if cardinality(coalesce(requested_user_ids, array[]::uuid[])) > 100 then
    raise exception 'Too many profile ids requested.';
  end if;

  if not private.current_user_has_active_membership() then
    return;
  end if;

  return query
  select p.id, p.username, p.display_name
  from public.profiles p
  where p.id = any(coalesce(requested_user_ids, array[]::uuid[]))
    and not exists (
      select 1
      from public.community_user_blocks b
      where
        (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id)
        or
        (b.blocked_id = (select auth.uid()) and b.blocker_id = p.id)
    );
end;
$$;

revoke all on function public.community_public_profiles(uuid[]) from public;
grant execute on function public.community_public_profiles(uuid[]) to authenticated, service_role;

