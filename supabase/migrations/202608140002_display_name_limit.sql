-- Enforce the StoryTuner display-name limit at the database layer.
-- Existing over-length names are shortened before the constraint is added.
update public.profiles
set display_name = left(trim(display_name), 15)
where char_length(trim(display_name)) > 15;

alter table public.profiles
  drop constraint if exists profiles_display_name_length;

alter table public.profiles
  add constraint profiles_display_name_length
  check (char_length(trim(display_name)) between 1 and 15);
