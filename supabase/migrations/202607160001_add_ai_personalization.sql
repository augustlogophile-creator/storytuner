-- Enables an explicit, private opt-in for long-term Weaver coaching context.
alter table public.profiles
  add column if not exists ai_personalization_enabled boolean not null default false;

comment on column public.profiles.ai_personalization_enabled is
  'When true, StoryTuner may include private text summaries from the user''s past recordings in Weaver coaching requests.';
