-- Bind the official Tellwise account to the owner/admin role as soon as it
-- successfully claims @tellwise. The moderators table remains unavailable to
-- browser clients, so this cannot be self-granted by another account.

alter table public.profiles
  drop constraint if exists profiles_username_reserved;

alter table public.profiles
  add constraint profiles_username_reserved
  check (
    username not in (
      'admin',
      'administrator',
      'moderator',
      'mod',
      'tell_wise',
      'tellwiseapp',
      'tellwise_admin',
      'tellwise_support',
      'tellwise_official',
      'storytuner',
      'story_tuner',
      'storytunerapp',
      'storytuner_admin',
      'storytuner_support',
      'storytuner_official',
      'support',
      'staff',
      'official',
      'security',
      'system',
      'help',
      'helpdesk',
      'parch'
    )
  );

create or replace function private.enforce_official_tellwise_username()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  official_email constant text := 'tellwiseapp@gmail.com';
begin
  if lower(new.username) = 'tellwise' then
    if not exists (
      select 1
      from auth.users u
      where u.id = new.id
        and lower(coalesce(u.email, '')) = official_email
        and u.email_confirmed_at is not null
    ) then
      raise exception 'reserved Tellwise username'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_official_tellwise_username() from public, anon, authenticated;
grant execute on function private.enforce_official_tellwise_username() to service_role;

drop trigger if exists enforce_official_tellwise_username on public.profiles;
create trigger enforce_official_tellwise_username
before insert or update of username on public.profiles
for each row
execute function private.enforce_official_tellwise_username();

create or replace function private.bootstrap_tellwise_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(new.username) <> 'tellwise' then
    return new;
  end if;

  if not exists (
    select 1
    from auth.users u
    where u.id = new.id
      and lower(coalesce(u.email, '')) = 'tellwiseapp@gmail.com'
      and u.email_confirmed_at is not null
  ) then
    return new;
  end if;

  -- Retire the old StoryTuner owner account from moderation when the official
  -- Tellwise identity is successfully established.
  delete from public.community_moderators m
  using auth.users u
  where m.user_id = u.id
    and lower(coalesce(u.email, '')) = 'storytunerapp@gmail.com';

  insert into public.community_moderators (user_id, role)
  values (new.id, 'admin')
  on conflict (user_id) do update set role = 'admin';

  return new;
end;
$$;

revoke all on function private.bootstrap_tellwise_owner() from public, anon, authenticated;
grant execute on function private.bootstrap_tellwise_owner() to service_role;

drop trigger if exists bootstrap_tellwise_owner on public.profiles;
create trigger bootstrap_tellwise_owner
after insert or update of username on public.profiles
for each row
execute function private.bootstrap_tellwise_owner();

-- Backfill immediately if the official account already exists and already owns
-- @tellwise by the time this migration is applied.
insert into public.community_moderators (user_id, role)
select p.id, 'admin'
from public.profiles p
join auth.users u on u.id = p.id
where lower(p.username) = 'tellwise'
  and lower(coalesce(u.email, '')) = 'tellwiseapp@gmail.com'
  and u.email_confirmed_at is not null
on conflict (user_id) do update set role = 'admin';
