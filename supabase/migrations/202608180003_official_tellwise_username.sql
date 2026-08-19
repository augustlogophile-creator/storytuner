-- Allow the official Tellwise Google account to own @tellwise while keeping
-- the handle unavailable to every other account. Browser clients still cannot
-- insert profiles or mutate usernames directly; the server claim route is the
-- normal write path. This trigger is database-level defense in depth.

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
begin
  if lower(new.username) = 'tellwise' then
    if not exists (
      select 1
      from auth.users u
      where u.id = new.id
        and lower(coalesce(u.email, '')) = 'tellwiseapp@gmail.com'
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
