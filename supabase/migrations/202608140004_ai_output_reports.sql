create table if not exists public.ai_output_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('coach', 'arena', 'lesson', 'checkpoint', 'planner')),
  content text not null check (char_length(content) between 1 and 12000),
  content_hash text not null check (char_length(content_hash) = 64),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolution_note text,
  unique (reporter_id, content_hash)
);

create index if not exists ai_output_reports_status_created_idx
  on public.ai_output_reports(status, created_at desc);

alter table public.ai_output_reports enable row level security;
revoke all on table public.ai_output_reports from anon, authenticated;
grant all on table public.ai_output_reports to service_role;
