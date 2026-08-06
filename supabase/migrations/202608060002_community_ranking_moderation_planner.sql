-- StoryTuner Community ranking, moderation controls, stronger name safety,
-- and persistent AI Story Planner history.

create schema if not exists private;

-- Stronger public-name safety. This is intentionally conservative for a
-- youth-facing community. It normalizes common leetspeak, separators, and
-- repeated letters before checking blocked terms and suspicious combinations.
create or replace function public.storytuner_public_name_is_allowed(candidate text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  normalized text;
  compact text;
  squeezed text;
  part text;
  blocked_fragment text;
  blocked_exact text[] := array[
    'ass', 'cock', 'dick', 'cum', 'tits', 'tit', 'boobs', 'boob', 'anus',
    'whore', 'slut', 'bastard', 'sex', 'rape', 'rapist', 'stfu', 'nigger',
    'nigga', 'faggot', 'retard', 'cunt', 'twat', 'wanker', 'pedo', 'nonce'
  ];
  blocked_fragments text[] := array[
    'assman', 'assguy', 'assboy', 'assgirl', 'assface', 'asshead', 'assmaster',
    'dickguy', 'dickboy', 'dickgirl', 'dickhead', 'dickface', 'dickmaster',
    'cockboy', 'cockgirl', 'cockhead', 'cockface', 'poop', 'penis', 'vagina',
    'pussy', 'dildo', 'porn', 'porno', 'nude', 'nudes', 'semen', 'sperm',
    'ejaculate', 'orgasm', 'masturbat', 'blowjob', 'handjob', 'fuck', 'fuk',
    'phuck', 'shit', 'bitch', 'asshole', 'motherfucker', 'cocksucker', 'nazi',
    'kkk', 'heilhitler', 'hitler', 'suicidebait', 'killurself', 'killyourself',
    'onlyfans', 'sexworker', 'rapeme', 'molest', 'pedophile', 'bestial',
    'incest', 'cumslut', 'cumdump', 'boobies', 'titties', 'horny', 'thot'
  ];
begin
  normalized := lower(candidate);
  normalized := translate(normalized, '0134578!|@$+', 'oieastbiiaas');
  compact := regexp_replace(normalized, '[^a-z0-9]', '', 'g');
  squeezed := regexp_replace(compact, '(.)\1+', '\1', 'g');

  foreach blocked_fragment in array blocked_fragments loop
    if position(blocked_fragment in compact) > 0
       or position(blocked_fragment in squeezed) > 0 then
      return false;
    end if;
  end loop;

  foreach part in array regexp_split_to_array(normalized, '[^a-z0-9]+') loop
    if part = any(blocked_exact) then
      return false;
    end if;
  end loop;

  -- Block compact combinations that join a sexual, vulgar, or harassing term
  -- to a common identity word, even when separators were removed.
  if compact ~ '(ass|dick|cock|penis|cum|sex|boob|tit|pussy|fuck|shit|bitch|slut|whore)(man|guy|boy|girl|kid|king|queen|lord|master|lover|face|head|69|420)$' then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.storytuner_public_name_is_allowed(text) from public;
grant execute on function public.storytuner_public_name_is_allowed(text) to authenticated, service_role;

update public.profiles
set username = 'story_' || left(replace(id::text, '-', ''), 10)
where not public.storytuner_public_name_is_allowed(username);

update public.profiles
set display_name = 'StoryTuner member'
where not public.storytuner_public_name_is_allowed(display_name);

alter table public.profiles
  drop constraint if exists profiles_username_public_name_safe;
alter table public.profiles
  add constraint profiles_username_public_name_safe
  check (public.storytuner_public_name_is_allowed(username));

alter table public.profiles
  drop constraint if exists profiles_display_name_public_name_safe;
alter table public.profiles
  add constraint profiles_display_name_public_name_safe
  check (public.storytuner_public_name_is_allowed(display_name));

-- Service-role-only moderation status and immutable action history.
create table if not exists public.community_moderation_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'banned')),
  account_suspended_until timestamptz,
  community_suspended_until timestamptz,
  public_message text,
  internal_note text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint community_moderation_public_message_length
    check (public_message is null or char_length(public_message) <= 500),
  constraint community_moderation_internal_note_length
    check (internal_note is null or char_length(internal_note) <= 2000)
);

create table if not exists public.community_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  moderator_id uuid references auth.users(id) on delete set null,
  report_id uuid references public.community_reports(id) on delete set null,
  action_type text not null
    check (action_type in (
      'warning', 'hide_content', 'restore_content', 'community_suspension',
      'account_suspension', 'account_ban', 'restriction_cleared',
      'report_resolved', 'report_dismissed'
    )),
  duration_days integer check (duration_days is null or duration_days between 1 and 3650),
  note text,
  created_at timestamptz not null default now(),
  constraint community_moderation_action_note_length
    check (note is null or char_length(note) <= 2000)
);

create index if not exists community_moderation_actions_user_idx
  on public.community_moderation_actions (user_id, created_at desc);
create index if not exists community_moderation_actions_report_idx
  on public.community_moderation_actions (report_id, created_at desc)
  where report_id is not null;

alter table public.community_moderation_status enable row level security;
alter table public.community_moderation_actions enable row level security;
revoke all on table public.community_moderation_status from anon, authenticated;
revoke all on table public.community_moderation_actions from anon, authenticated;
grant select, insert, update, delete on table public.community_moderation_status to service_role;
grant select, insert, update, delete on table public.community_moderation_actions to service_role;

create or replace function public.update_community_moderation_timestamp()
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

drop trigger if exists community_moderation_status_updated_at on public.community_moderation_status;
create trigger community_moderation_status_updated_at
before update on public.community_moderation_status
for each row execute function public.update_community_moderation_timestamp();

create or replace function private.current_user_account_is_restricted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.community_moderation_status m
    where m.user_id = (select auth.uid())
      and (
        m.account_status = 'banned'
        or (
          m.account_status = 'suspended'
          and (m.account_suspended_until is null or m.account_suspended_until > now())
        )
      )
  );
$$;

revoke all on function private.current_user_account_is_restricted() from public;
grant execute on function private.current_user_account_is_restricted() to authenticated, service_role;

-- Community access now also respects Community suspensions and full-account restrictions.
create or replace function private.current_user_has_active_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.subscriptions s
      where s.user_id = (select auth.uid())
        and s.status in ('active', 'trialing')
        and (s.current_period_end is null or s.current_period_end > now())
    )
    and not private.current_user_account_is_restricted()
    and not exists (
      select 1
      from public.community_moderation_status m
      where m.user_id = (select auth.uid())
        and m.community_suspended_until is not null
        and m.community_suspended_until > now()
    );
$$;

revoke all on function private.current_user_has_active_membership() from public;
grant execute on function private.current_user_has_active_membership() to authenticated, service_role;

-- Proper ranked pagination. Likes are the primary signal, recency breaks ties.
create or replace function public.community_ranked_feed(page_offset integer default 0, page_size integer default 20)
returns table (
  id uuid,
  author_id uuid,
  post_type text,
  title text,
  body text,
  shared_transcript text,
  created_at timestamptz,
  edited_at timestamptz,
  like_count bigint,
  reply_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.current_user_has_active_membership() then
    return;
  end if;

  return query
  select
    p.id,
    p.author_id,
    p.post_type,
    p.title,
    p.body,
    p.shared_transcript,
    p.created_at,
    p.edited_at,
    count(distinct l.user_id)::bigint as like_count,
    count(distinct r.id) filter (where r.status = 'active')::bigint as reply_count
  from public.community_posts p
  left join public.community_post_likes l on l.post_id = p.id
  left join public.community_replies r on r.post_id = p.id
  where p.status = 'active'
    and not exists (
      select 1
      from public.community_user_blocks b
      where
        (b.blocker_id = (select auth.uid()) and b.blocked_id = p.author_id)
        or
        (b.blocked_id = (select auth.uid()) and b.blocker_id = p.author_id)
    )
  group by p.id
  order by count(distinct l.user_id) desc, p.created_at desc, p.id desc
  offset greatest(coalesce(page_offset, 0), 0)
  limit least(greatest(coalesce(page_size, 20), 1), 50);
end;
$$;

revoke all on function public.community_ranked_feed(integer, integer) from public;
grant execute on function public.community_ranked_feed(integer, integer) to authenticated, service_role;

-- Public Community identity lookup. This returns only the two public profile
-- fields needed beside posts and replies, never email, age, or private state.
-- A security-definer function avoids fragile cross-profile RLS reads while
-- still requiring paid Community access and respecting user blocks.
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

-- Persistent Story Planner history. Inputs and AI outputs remain private to the user.
create table if not exists public.story_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience_context text not null,
  goal text not null,
  rough_plan text not null,
  must_include text not null default '',
  nervous_about text not null default '',
  output jsonb not null,
  created_at timestamptz not null default now(),
  constraint story_plans_audience_length check (char_length(audience_context) between 1 and 1000),
  constraint story_plans_goal_length check (char_length(goal) between 1 and 1500),
  constraint story_plans_rough_length check (char_length(rough_plan) between 1 and 5000),
  constraint story_plans_must_include_length check (char_length(must_include) <= 3000),
  constraint story_plans_nervous_length check (char_length(nervous_about) <= 2000)
);

create index if not exists story_plans_user_created_idx
  on public.story_plans (user_id, created_at desc);

alter table public.story_plans enable row level security;
revoke all on table public.story_plans from anon, authenticated;
grant select, delete on table public.story_plans to authenticated;
grant select, insert, update, delete on table public.story_plans to service_role;

drop policy if exists "Users can read their own story plans" on public.story_plans;
create policy "Users can read their own story plans"
on public.story_plans for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own story plans" on public.story_plans;
create policy "Users can delete their own story plans"
on public.story_plans for delete to authenticated
using ((select auth.uid()) = user_id);
