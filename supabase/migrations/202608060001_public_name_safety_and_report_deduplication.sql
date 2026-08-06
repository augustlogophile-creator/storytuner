-- Public-name safety and duplicate-report protection.
-- Existing unsafe public names are replaced with neutral values, and every
-- future insert or name update must pass the same check.

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
  part text;
  blocked_fragment text;
  blocked_exact text[] := array[
    'cock', 'dick', 'cum', 'tits', 'boobs', 'boob', 'anus',
    'whore', 'slut', 'bastard', 'sex', 'rape', 'rapist', 'stfu'
  ];
  blocked_fragments text[] := array[
    'poop', 'penis', 'vagina', 'pussy', 'dildo', 'porn', 'porno',
    'nude', 'nudes', 'semen', 'sperm', 'ejaculate', 'orgasm',
    'masturbat', 'blowjob', 'handjob', 'fuck', 'fuk', 'shit',
    'bitch', 'asshole', 'motherfucker', 'cocksucker', 'nazi', 'kkk'
  ];
begin
  normalized := lower(candidate);
  normalized := replace(normalized, '0', 'o');
  normalized := replace(normalized, '1', 'i');
  normalized := replace(normalized, '!', 'i');
  normalized := replace(normalized, '|', 'i');
  normalized := replace(normalized, '3', 'e');
  normalized := replace(normalized, '4', 'a');
  normalized := replace(normalized, '5', 's');
  normalized := replace(normalized, '7', 't');
  normalized := replace(normalized, '8', 'b');

  compact := regexp_replace(normalized, '[^a-z0-9]', '', 'g');

  foreach blocked_fragment in array blocked_fragments loop
    if position(blocked_fragment in compact) > 0 then
      return false;
    end if;
  end loop;

  foreach part in array regexp_split_to_array(normalized, '[^a-z0-9]+') loop
    if part = any(blocked_exact) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.storytuner_public_name_is_allowed(text) from public;
grant execute on function public.storytuner_public_name_is_allowed(text) to authenticated, service_role;

-- Replace any already-existing unsafe public names before the constraints are
-- validated. The generated username is unique because it is derived from the
-- account UUID.
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

-- One report per person per target. Repeated submissions return the original
-- result instead of creating moderation spam.
with ranked_reports as (
  select
    id,
    row_number() over (
      partition by reporter_id, coalesce(post_id, reply_id), (post_id is not null)
      order by created_at asc, id asc
    ) as report_number
  from public.community_reports
)
delete from public.community_reports
where id in (
  select id from ranked_reports where report_number > 1
);
create unique index if not exists community_reports_unique_post_reporter
  on public.community_reports (reporter_id, post_id)
  where post_id is not null;

create unique index if not exists community_reports_unique_reply_reporter
  on public.community_reports (reporter_id, reply_id)
  where reply_id is not null;
