-- Independent mirror: no foreign keys or writes to students, attendance or finance.
create table public.google_calendar_connection (
  id text primary key default 'school' check (id = 'school'),
  generation uuid not null default gen_random_uuid(),
  refresh_ciphertext text,
  account_email text,
  connected_by uuid references auth.users(id) on delete set null,
  calendar_id text,
  calendar_name text,
  time_zone text not null default 'America/Sao_Paulo',
  sync_token text,
  page_token text,
  sync_epoch uuid not null default gen_random_uuid(),
  revision bigint not null default 0,
  last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(),
  needs_sync boolean not null default true,
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'reconnect', 'error')),
  lease_id uuid,
  lease_until timestamptz,
  channel_id uuid,
  channel_resource_id text,
  channel_token_hash text,
  channel_expires_at timestamptz
);
insert into public.google_calendar_connection(id) values ('school');

create table public.google_calendar_oauth_states (
  state_hash text primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  generation uuid not null,
  verifier_ciphertext text not null,
  expires_at timestamptz not null
);

create table public.google_calendar_events (
  event_id text primary key,
  generation uuid not null,
  seen_epoch uuid not null,
  event jsonb not null,
  updated_at timestamptz not null default now()
);

-- Secrets and the mirror are accessible only through authenticated Edge Function operations.
alter table public.google_calendar_connection enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
alter table public.google_calendar_events enable row level security;
revoke all on public.google_calendar_connection, public.google_calendar_oauth_states, public.google_calendar_events from public, anon, authenticated;
grant all on public.google_calendar_connection, public.google_calendar_oauth_states, public.google_calendar_events to service_role;

create function public.claim_google_calendar_lease(p_lease uuid)
returns boolean language sql security definer set search_path = public as $$
  with claimed as (
    update public.google_calendar_connection set lease_id = p_lease, lease_until = now() + interval '4 minutes'
    where id = 'school' and (lease_until is null or lease_until < now()) returning 1
  ) select exists(select 1 from claimed);
$$;

-- A page and its cursor commit together. Retries cannot skip changes or duplicate rows.
create function public.apply_google_calendar_page(
  p_lease uuid, p_generation uuid, p_events jsonb, p_page_token text, p_sync_token text
) returns void language plpgsql security definer set search_path = public as $$
declare connection public.google_calendar_connection;
begin
  select * into connection from public.google_calendar_connection where id = 'school' for update;
  if p_lease is null or connection.lease_id is distinct from p_lease
    or connection.generation is distinct from p_generation
    or connection.lease_until is null or connection.lease_until < now() then
    raise exception 'Stale calendar operation' using errcode = '40001';
  end if;
  if p_page_token is null and p_sync_token is null then raise exception 'Missing sync cursor'; end if;
  insert into public.google_calendar_events(event_id, generation, seen_epoch, event)
    select item->>'id', p_generation, connection.sync_epoch, item from jsonb_array_elements(p_events) item
    on conflict(event_id) do update set generation = excluded.generation, seen_epoch = excluded.seen_epoch,
      event = excluded.event, updated_at = now();
  if p_page_token is null and connection.sync_token is null then
    -- Mark vanished mirror entries, never delete school data or Google events.
    update public.google_calendar_events set event = event || '{"status":"cancelled"}'::jsonb, updated_at = now()
      where generation = p_generation and seen_epoch <> connection.sync_epoch;
  end if;
  update public.google_calendar_connection set page_token = p_page_token,
    sync_token = case when p_page_token is null then p_sync_token else sync_token end,
    last_synced_at = case when p_page_token is null then now() else last_synced_at end,
    revision = revision + 1,
    needs_sync = p_page_token is not null,
    next_sync_at = case when p_page_token is null then now() + interval '15 minutes' else now() end,
    status = 'connected'
    where id = 'school';
end;
$$;

revoke all on function public.claim_google_calendar_lease(uuid) from public, anon, authenticated;
revoke all on function public.apply_google_calendar_page(uuid,uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.claim_google_calendar_lease(uuid) to service_role;
grant execute on function public.apply_google_calendar_page(uuid,uuid,jsonb,text,text) to service_role;
