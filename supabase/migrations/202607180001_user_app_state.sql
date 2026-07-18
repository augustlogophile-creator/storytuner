create table if not exists public.user_app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  state_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_app_state enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.user_app_state to authenticated, service_role;

drop policy if exists "Users can read their own app state" on public.user_app_state;
create policy "Users can read their own app state"
on public.user_app_state for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own app state" on public.user_app_state;
create policy "Users can create their own app state"
on public.user_app_state for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app state" on public.user_app_state;
create policy "Users can update their own app state"
on public.user_app_state for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own app state" on public.user_app_state;
create policy "Users can delete their own app state"
on public.user_app_state for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.update_user_app_state_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_app_state_updated_at on public.user_app_state;
create trigger user_app_state_updated_at
before update on public.user_app_state
for each row execute function public.update_user_app_state_timestamp();
