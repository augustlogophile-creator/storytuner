-- Tellwise Journal: private written entries.
-- Existing private recording_uploads are surfaced in Journal automatically.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_title_length check (char_length(title) between 1 and 120),
  constraint journal_entries_body_length check (char_length(body) between 1 and 20000)
);

create index if not exists journal_entries_user_updated_idx
  on public.journal_entries (user_id, updated_at desc);

alter table public.journal_entries enable row level security;
revoke all on table public.journal_entries from public, anon;
grant select, insert, update, delete on table public.journal_entries to authenticated;

drop policy if exists "Users can read their journal entries" on public.journal_entries;
create policy "Users can read their journal entries" on public.journal_entries for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their journal entries" on public.journal_entries;
create policy "Users can create their journal entries" on public.journal_entries for insert to authenticated
with check ((select auth.uid()) = user_id and char_length(btrim(title)) between 1 and 120 and char_length(btrim(body)) between 1 and 20000);

drop policy if exists "Users can update their journal entries" on public.journal_entries;
create policy "Users can update their journal entries" on public.journal_entries for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id and char_length(btrim(title)) between 1 and 120 and char_length(btrim(body)) between 1 and 20000);

drop policy if exists "Users can delete their journal entries" on public.journal_entries;
create policy "Users can delete their journal entries" on public.journal_entries for delete to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists journal_entries_set_updated_at on public.journal_entries;
create trigger journal_entries_set_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();
