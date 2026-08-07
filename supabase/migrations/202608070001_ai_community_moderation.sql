-- StoryTuner AI Community moderation.
-- Human reports continue to work normally. AI-held content is inserted as
-- removed, then surfaced in the same owner moderation queue for review.

alter table public.community_reports
  alter column reporter_id drop not null;

alter table public.community_reports
  add column if not exists source text not null default 'user',
  add column if not exists ai_model text,
  add column if not exists ai_flagged boolean,
  add column if not exists ai_categories jsonb,
  add column if not exists ai_category_scores jsonb,
  add column if not exists ai_top_category text,
  add column if not exists ai_top_score double precision,
  add column if not exists ai_recommended_action text;

update public.community_reports
set source = 'user'
where source is null;

alter table public.community_reports
  drop constraint if exists community_reports_source_valid;
alter table public.community_reports
  add constraint community_reports_source_valid
  check (source in ('user', 'ai'));

alter table public.community_reports
  drop constraint if exists community_reports_source_reporter_valid;
alter table public.community_reports
  add constraint community_reports_source_reporter_valid
  check (
    (source = 'user' and reporter_id is not null)
    or
    (source = 'ai' and reporter_id is null)
  );

alter table public.community_reports
  drop constraint if exists community_reports_ai_top_score_valid;
alter table public.community_reports
  add constraint community_reports_ai_top_score_valid
  check (ai_top_score is null or (ai_top_score >= 0 and ai_top_score <= 1));

alter table public.community_reports
  drop constraint if exists community_reports_ai_recommendation_length;
alter table public.community_reports
  add constraint community_reports_ai_recommendation_length
  check (ai_recommended_action is null or char_length(ai_recommended_action) <= 500);

create index if not exists community_reports_source_status_idx
  on public.community_reports (source, status, created_at asc);

-- Prevent the same currently-open AI hold from being queued more than once.
-- Once a prior AI review is resolved or dismissed, a later edit can create a
-- fresh review for the same content.
create unique index if not exists community_reports_open_ai_post_idx
  on public.community_reports (post_id)
  where source = 'ai' and post_id is not null and status in ('open', 'reviewing');

create unique index if not exists community_reports_open_ai_reply_idx
  on public.community_reports (reply_id)
  where source = 'ai' and reply_id is not null and status in ('open', 'reviewing');
