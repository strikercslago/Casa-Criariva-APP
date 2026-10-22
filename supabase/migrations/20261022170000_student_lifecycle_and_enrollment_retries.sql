-- Teachers may maintain student records; no financial/guardian permissions change.
create policy "students_update_teaching_staff"
on public.students for update to authenticated
using (public.current_user_can_teach())
with check (public.current_user_can_teach());

-- Private request ledger: a retry returns the original student, atomically.
create table public.student_enrollment_requests (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  student_id uuid not null references public.students(id),
  created_at timestamptz not null default now(),
  primary key (actor_id, request_id)
);
alter table public.student_enrollment_requests enable row level security;
revoke all on public.student_enrollment_requests from public, anon, authenticated;

alter function public.complete_student_enrollment(jsonb) rename to complete_student_enrollment_internal;
revoke all on function public.complete_student_enrollment_internal(jsonb) from public, anon, authenticated;

create function public.complete_student_enrollment(payload jsonb)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  request_key uuid := nullif(payload ->> 'request_id', '')::uuid;
  result_id uuid;
  student_data jsonb := payload -> 'student';
begin
  if actor is null or not public.current_user_can_teach() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if request_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(actor::text || request_key::text, 0));
    select student_id into result_id from public.student_enrollment_requests
      where actor_id = actor and request_id = request_key;
    if found then return result_id; end if;
  end if;

  if public.current_user_can_manage_operations() then
    result_id := public.complete_student_enrollment_internal(payload);
  else
    -- Teacher registration is intentionally limited to student identity data.
    if coalesce(payload -> 'guardians', '[]'::jsonb) <> '[]'::jsonb
      or coalesce(payload -> 'class', 'null'::jsonb) <> 'null'::jsonb
      or coalesce(payload -> 'billing_plan', 'null'::jsonb) <> 'null'::jsonb then
      raise exception 'Teacher enrollment only accepts student data' using errcode = '42501';
    end if;
    insert into public.students (full_name, preferred_name, birth_date, enrollment_date, notes, created_by)
    values (btrim(student_data ->> 'full_name'), nullif(btrim(student_data ->> 'preferred_name'), ''),
      nullif(student_data ->> 'birth_date', '')::date, (student_data ->> 'enrollment_date')::date,
      nullif(btrim(student_data ->> 'notes'), ''), actor)
    returning id into result_id;
    insert into public.audit_events (actor_user_id, entity_type, entity_id, action, metadata)
    values (actor, 'student', result_id, 'student.created', jsonb_build_object('source', 'teacher_registration'));
  end if;

  if request_key is not null then
    insert into public.student_enrollment_requests (actor_id, request_id, student_id)
    values (actor, request_key, result_id);
  end if;
  return result_id;
end;
$$;
alter function public.complete_student_enrollment(jsonb) owner to postgres;
revoke all on function public.complete_student_enrollment(jsonb) from public, anon;
grant execute on function public.complete_student_enrollment(jsonb) to authenticated;

create function public.audit_student_lifecycle()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_events (actor_user_id, entity_type, entity_id, action, metadata)
    values (auth.uid(), 'student', new.id, 'student.status_changed',
      jsonb_build_object('previous_status', old.status, 'status', new.status));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_student_lifecycle() from public, anon, authenticated;
create trigger students_audit_lifecycle after update on public.students
for each row execute function public.audit_student_lifecycle();
