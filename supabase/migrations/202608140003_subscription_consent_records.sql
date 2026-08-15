-- Durable verification of affirmative automatic-renewal consent.
-- Apply this migration before accepting production subscriptions.
create table if not exists public.subscription_consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  consent_version text not null,
  consent_summary text not null,
  consented_at timestamptz not null,
  retain_until timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_consent_records_user_idx
  on public.subscription_consent_records (user_id, consented_at desc);

create unique index if not exists subscription_consent_records_checkout_idx
  on public.subscription_consent_records (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.subscription_consent_records enable row level security;

revoke all on table public.subscription_consent_records from anon, authenticated;
grant select, insert, update, delete on table public.subscription_consent_records to service_role;

comment on table public.subscription_consent_records is
  'Limited legal/compliance record of affirmative subscription renewal consent. Not user-facing app content.';
