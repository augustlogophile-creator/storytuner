-- Make the one free Story Planner allowance durable and independent from saved
-- plan rows. Deleting app content must not reset a server-enforced free limit.

alter table public.user_usage_events
  drop constraint if exists user_usage_events_feature_check;

alter table public.user_usage_events
  add constraint user_usage_events_feature_check
  check (feature in ('coach_message', 'arena_review', 'story_planner'));

-- Preserve the fact that an existing free user has already used Planner when a
-- saved plan exists at migration time. One row is enough because the limit is 1.
insert into public.user_usage_events (user_id, feature, request_key, created_at)
select distinct on (p.user_id)
  p.user_id,
  'story_planner',
  gen_random_uuid(),
  p.created_at
from public.story_plans p
where not exists (
  select 1
  from public.user_usage_events e
  where e.user_id = p.user_id
    and e.feature = 'story_planner'
)
order by p.user_id, p.created_at asc;

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
  elsif p_feature = 'story_planner' then
    v_limit := 1;
  else
    raise exception 'Unknown Tellwise usage feature';
  end if;

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
