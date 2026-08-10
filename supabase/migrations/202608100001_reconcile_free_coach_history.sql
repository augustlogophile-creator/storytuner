-- Keep the free Coach allowance aligned with the conversation history users can actually see.
-- This is a one-time reconciliation for accounts affected by the earlier migration, which
-- imported lifetime coach.sent values even when those historical messages had already been cleared.
-- Going forward, the free UI no longer exposes Clear, so all five free exchanges remain visible.

create temporary table _storytuner_coach_reconcile on commit drop as
select
  app.user_id,
  least(
    5,
    coalesce((
      select count(*)::integer
      from jsonb_array_elements(coalesce(app.state #> '{coach,messages}', '[]'::jsonb)) as message
      where message ->> 'role' = 'user'
        and nullif(btrim(coalesce(message ->> 'content', '')), '') is not null
    ), 0)
  )::integer as visible_used
from public.user_app_state app
left join public.subscriptions subscription
  on subscription.user_id = app.user_id
where not (
  subscription.status in ('active', 'trialing')
  and (subscription.current_period_end is null or subscription.current_period_end > now())
);

-- Replace the imported Coach usage events for free accounts with the number of retained
-- user messages that are actually present in their synced Coach history.
delete from public.user_usage_events usage
using _storytuner_coach_reconcile reconcile
where usage.user_id = reconcile.user_id
  and usage.feature = 'coach_message';

insert into public.user_usage_events (user_id, feature, request_key, created_at)
select
  reconcile.user_id,
  'coach_message',
  gen_random_uuid(),
  now()
from _storytuner_coach_reconcile reconcile
cross join lateral generate_series(1, reconcile.visible_used);

-- Keep the legacy synced counter aligned too, so the UI has a consistent fallback if the
-- usage endpoint is temporarily unavailable.
update public.user_app_state app
set state = jsonb_set(
  app.state,
  '{coach,sent}',
  to_jsonb(reconcile.visible_used),
  true
)
from _storytuner_coach_reconcile reconcile
where app.user_id = reconcile.user_id;
