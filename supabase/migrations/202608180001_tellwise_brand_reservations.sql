-- Tellwise brand reservation update.
-- Keep legacy StoryTuner names reserved so old official-looking handles cannot be claimed.

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
      'tellwise',
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

update public.profiles
set display_name = 'Tellwise member'
where lower(display_name) = 'storytuner member';
