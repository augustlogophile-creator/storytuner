-- Server-owned free-plan usage counters for StoryTuner.
-- Users cannot insert/update/delete these rows directly. Only service-role server code can reserve usage.

create extension if not exists pgcrypto;

create table if not exists public.user_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('coach_message', 'arena_review')),
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, feature, request_key)
);

create index if not exists user_usage_events_user_feature_idx
  on public.user_usage_events (user_id, feature, created_at desc);

alter table public.user_usage_events enable row level security;

revoke all on table public.user_usage_events from anon, authenticated;
grant select, insert, update, delete on table public.user_usage_events to service_role;

-- Preserve already-used free allowances from the existing synced state on first migration.
insert into public.user_usage_events (user_id, feature, request_key, created_at)
select
  s.user_id,
  'coach_message',
  gen_random_uuid(),
  coalesce(s.updated_at, now())
from public.user_app_state s
cross join lateral generate_series(
  1,
  least(
    5,
    greatest(
      0,
      case
        when (s.state #>> '{coach,sent}') ~ '^[0-9]+$' then (s.state #>> '{coach,sent}')::integer
        else 0
      end
    )
  )
) as n
where not exists (
  select 1 from public.user_usage_events e
  where e.user_id = s.user_id and e.feature = 'coach_message'
);

insert into public.user_usage_events (user_id, feature, request_key, created_at)
select
  s.user_id,
  'arena_review',
  gen_random_uuid(),
  coalesce(s.updated_at, now())
from public.user_app_state s
cross join lateral generate_series(
  1,
  least(
    2,
    greatest(
      0,
      case
        when (s.state ->> 'arenaTotal') ~ '^[0-9]+$' then (s.state ->> 'arenaTotal')::integer
        else 0
      end
    )
  )
) as n
where not exists (
  select 1 from public.user_usage_events e
  where e.user_id = s.user_id and e.feature = 'arena_review'
);

create or replace function public.reserve_storytuner_usage(
  p_user_id uuid,
  p_feature text,
  p_request_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_limit integer;
  v_used integer;
  v_existing boolean;
begin
  if p_feature = 'coach_message' then
    v_limit := 5;
  elsif p_feature = 'arena_review' then
    v_limit := 2;
  else
    raise exception 'Unknown StoryTuner usage feature';
  end if;

  -- Serialize reservations per user + feature so simultaneous requests cannot exceed the limit.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_feature)::bigint);

  select exists(
    select 1
    from public.user_usage_events
    where user_id = p_user_id
      and feature = p_feature
      and request_key = p_request_key
  ) into v_existing;

  select count(*)::integer
  into v_used
  from public.user_usage_events
  where user_id = p_user_id
    and feature = p_feature;

  if v_existing then
    return jsonb_build_object(
      'allowed', true,
      'alreadyReserved', true,
      'used', v_used,
      'limit', v_limit,
      'remaining', greatest(v_limit - v_used, 0)
    );
  end if;

  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'alreadyReserved', false,
      'used', v_used,
      'limit', v_limit,
      'remaining', 0
    );
  end if;

  insert into public.user_usage_events (user_id, feature, request_key)
  values (p_user_id, p_feature, p_request_key);

  v_used := v_used + 1;

  return jsonb_build_object(
    'allowed', true,
    'alreadyReserved', false,
    'used', v_used,
    'limit', v_limit,
    'remaining', greatest(v_limit - v_used, 0)
  );
end;
$$;

revoke all on function public.reserve_storytuner_usage(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_storytuner_usage(uuid, text, uuid) to service_role;
