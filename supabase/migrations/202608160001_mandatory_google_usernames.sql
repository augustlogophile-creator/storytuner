-- Mandatory StoryTuner public usernames.
-- The app server is the only path that may create/change a username. Normal
-- authenticated clients may still edit the small set of non-identity profile
-- fields explicitly granted below.

alter table public.profiles
  drop constraint if exists profiles_username_lowercase;
alter table public.profiles
  add constraint profiles_username_lowercase
  check (username = lower(username));

alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (
    char_length(username) between 3 and 20
    and username ~ '^[a-z0-9][a-z0-9_]*[a-z0-9]$'
    and username !~ '__'
  );

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

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
      'storytuner',
      'story_tuner',
      'storytunerapp',
      'storytuner_admin',
      'support',
      'storytuner_support',
      'staff',
      'official',
      'storytuner_official',
      'security',
      'system',
      'help',
      'helpdesk',
      'parch'
    )
  );

-- Critical bypass protection: browser Supabase clients can no longer insert a
-- profile or directly change username/onboarding fields. Those operations go
-- through StoryTuner's authenticated server endpoint using the service role.
revoke insert, update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, ai_personalization_enabled) on table public.profiles to authenticated;
