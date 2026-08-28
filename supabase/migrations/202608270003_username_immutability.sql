-- Tellwise usernames are permanent once claimed. Enforce this in the database
-- as defense in depth so a future service-route mistake cannot silently rename
-- an established public identity.

create or replace function private.prevent_tellwise_username_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.username is distinct from new.username then
    raise exception 'Tellwise usernames are permanent once claimed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_tellwise_username_change() from public, anon, authenticated;
grant execute on function private.prevent_tellwise_username_change() to service_role;

drop trigger if exists prevent_tellwise_username_change on public.profiles;
create trigger prevent_tellwise_username_change
before update of username on public.profiles
for each row
execute function private.prevent_tellwise_username_change();
