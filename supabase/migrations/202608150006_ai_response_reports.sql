create table if not exists public.ai_response_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  surface text not null check (surface in ('coach', 'practice', 'check', 'studio', 'planner', 'other')),
  response_text text not null,
  reason text not null,
  response_id text,
  lesson_id text,
  recording_id text,
  conversation_id text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists ai_response_reports_status_idx
  on public.ai_response_reports(status, created_at desc);

create index if not exists ai_response_reports_reporter_idx
  on public.ai_response_reports(reporter_id);

alter table public.ai_response_reports enable row level security;

drop policy if exists "Users can submit their own AI reports" on public.ai_response_reports;
create policy "Users can submit their own AI reports"
on public.ai_response_reports
for insert
to authenticated
with check (reporter_id = (select auth.uid()));
