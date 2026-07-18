create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  status text not null default 'inactive',
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
grant usage on schema public to authenticated, service_role;
grant select on table public.subscriptions to authenticated;
grant select, insert, update, delete on table public.subscriptions to service_role;

drop policy if exists "Users can read their own subscription" on public.subscriptions;
create policy "Users can read their own subscription"
on public.subscriptions for select to authenticated
using (auth.uid() = user_id);

create or replace function public.update_subscription_timestamp()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.update_subscription_timestamp();
