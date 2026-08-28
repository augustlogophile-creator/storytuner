-- Tellwise account-deletion cooldown.
-- Keep only a keyed/HMAC email digest, never the deleted email itself. This small
-- security tombstone prevents immediate delete-and-recreate abuse without retaining
-- the deleted user's profile or content.

create table if not exists public.account_deletion_cooldowns (
  email_hash text primary key,
  deleted_at timestamptz not null default now(),
  eligible_at timestamptz not null,
  constraint account_deletion_cooldowns_hash_shape
    check (email_hash ~ '^[0-9a-f]{64}$'),
  constraint account_deletion_cooldowns_window
    check (eligible_at > deleted_at)
);

create index if not exists account_deletion_cooldowns_eligible_at_idx
  on public.account_deletion_cooldowns (eligible_at);

alter table public.account_deletion_cooldowns enable row level security;

-- This table is never exposed to browser sessions. Next.js server routes using
-- the service role are the only code allowed to read or mutate it.
revoke all on table public.account_deletion_cooldowns from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_cooldowns to service_role;
