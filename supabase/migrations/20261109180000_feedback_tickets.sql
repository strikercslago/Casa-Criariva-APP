create table public.feedback_tickets (
  id uuid primary key,
  number bigint generated always as identity unique,
  created_by uuid not null references auth.users(id),
  author_name text not null,
  category text not null check (category in ('suggestion', 'bug', 'improvement')),
  title text not null check (title = btrim(title) and char_length(title) between 3 and 120),
  description text not null check (description = btrim(description) and char_length(description) between 10 and 5000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'planned', 'completed', 'declined')),
  response text not null default '' check (char_length(response) <= 5000),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_tickets_author_date_idx on public.feedback_tickets (created_by, created_at desc);
create index feedback_tickets_status_date_idx on public.feedback_tickets (status, created_at desc);
alter table public.feedback_tickets enable row level security;
revoke all on public.feedback_tickets from public, anon, authenticated;
grant select on public.feedback_tickets to authenticated;
create policy feedback_tickets_read on public.feedback_tickets for select to authenticated
using (public.current_user_can_teach() and (created_by = (select auth.uid()) or public.current_user_can_manage_operations()));

-- Writes go through these functions, never through client-supplied ownership/status fields.
create function public.create_feedback_ticket(p_id uuid, p_category text, p_title text, p_description text)
returns setof public.feedback_tickets language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  display_name text;
begin
  if actor is null or not public.current_user_can_teach() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select coalesce(nullif(btrim(full_name), ''), 'Usuário') into display_name from public.profiles where id = actor;
  insert into public.feedback_tickets (id, created_by, author_name, category, title, description)
  values (p_id, actor, coalesce(display_name, 'Usuário'), p_category, btrim(p_title), btrim(p_description))
  on conflict (id) do nothing;
  -- Retrying the same request cannot create a second ticket or reveal another user's ticket.
  if not exists (select 1 from public.feedback_tickets where id = p_id and created_by = actor) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.feedback_tickets where id = p_id and created_by = actor;
end;
$$;

create function public.respond_feedback_ticket(p_id uuid, p_status text, p_response text)
returns setof public.feedback_tickets language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_can_manage_operations() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query update public.feedback_tickets
    set status = p_status, response = btrim(coalesce(p_response, '')), updated_by = auth.uid(), updated_at = now()
    where id = p_id returning *;
end;
$$;
revoke all on function public.create_feedback_ticket(uuid, text, text, text) from public, anon;
revoke all on function public.respond_feedback_ticket(uuid, text, text) from public, anon;
grant execute on function public.create_feedback_ticket(uuid, text, text, text) to authenticated;
grant execute on function public.respond_feedback_ticket(uuid, text, text) to authenticated;
