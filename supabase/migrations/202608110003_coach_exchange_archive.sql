-- Durable Weaver conversation history so the visible chat can never drift away
-- from the server-owned five-message allowance.

create extension if not exists pgcrypto;

create table if not exists public.coach_exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  user_message text not null,
  assistant_message text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);

create index if not exists coach_exchanges_user_created_idx
  on public.coach_exchanges (user_id, created_at asc);

alter table public.coach_exchanges enable row level security;
revoke all on table public.coach_exchanges from anon, authenticated;
grant select, insert, update, delete on table public.coach_exchanges to service_role;

-- Backfill any Weaver exchanges that are still present in the synced app state.
with state_messages as (
  select
    s.user_id,
    message.value as user_value,
    message.ordinality as user_ord,
    s.state #> '{coach,messages}' as messages
  from public.user_app_state s
  cross join lateral jsonb_array_elements(coalesce(s.state #> '{coach,messages}', '[]'::jsonb))
    with ordinality as message(value, ordinality)
  where message.value ->> 'role' = 'user'
    and nullif(trim(message.value ->> 'content'), '') is not null
), paired as (
  select
    u.user_id,
    gen_random_uuid() as request_key,
    trim(u.user_value ->> 'content') as user_message,
    (
      select trim(a.value ->> 'content')
      from jsonb_array_elements(coalesce(u.messages, '[]'::jsonb))
        with ordinality as a(value, ordinality)
      where a.ordinality > u.user_ord
        and a.value ->> 'role' = 'assistant'
        and nullif(trim(a.value ->> 'content'), '') is not null
      order by a.ordinality
      limit 1
    ) as assistant_message,
    case
      when (u.user_value ->> 'createdAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then (u.user_value ->> 'createdAt')::timestamptz
      else now()
    end as created_at
  from state_messages u
)
insert into public.coach_exchanges (user_id, request_key, user_message, assistant_message, created_at)
select user_id, request_key, user_message, assistant_message, created_at
from paired
where assistant_message is not null
  and not exists (
    select 1
    from public.coach_exchanges e
    where e.user_id = paired.user_id
      and e.user_message = paired.user_message
      and e.assistant_message = paired.assistant_message
  );

-- One-time reconciliation for legacy accounts. If an old browser clear removed the
-- visible conversation before server-owned usage was added, we cannot recover text
-- that no longer exists. In that case, make the allowance match the exchanges that
-- can actually be shown instead of claiming five invisible messages were used.
delete from public.user_usage_events
where feature = 'coach_message';

insert into public.user_usage_events (user_id, feature, request_key, created_at)
select
  e.user_id,
  'coach_message',
  e.request_key,
  e.created_at
from (
  select *, row_number() over (partition by user_id order by created_at asc, id asc) as rn
  from public.coach_exchanges
) e
where e.rn <= 5
on conflict (user_id, feature, request_key) do nothing;
