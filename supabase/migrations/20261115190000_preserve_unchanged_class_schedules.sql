create or replace function public.update_class_with_schedules(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_class_id uuid := (payload ->> 'class_id')::uuid;
  class_payload jsonb := coalesce(payload -> 'class', '{}'::jsonb);
  schedules_payload jsonb := coalesce(payload -> 'schedules', '[]'::jsonb);
  active_count integer;
  requested_capacity integer;
  schedule_item jsonb;
  previous_schedules jsonb;
  normalized_schedules jsonb;
  schedules_changed boolean;
begin
  if actor_id is null or not public.current_user_can_manage_operations() then
    raise exception 'Only active operations staff can update classes.' using errcode = '42501';
  end if;

  perform public.assert_class_schedules_valid(schedules_payload);

  -- Serialize with enrollment mutations which also lock the class row.
  perform 1 from public.classes where id = target_class_id for update;
  if not found then
    raise exception 'Class not found.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(weekday, start_time, end_time)
    order by weekday, start_time, end_time), '[]'::jsonb)
  into previous_schedules from public.class_schedules where class_id = target_class_id;

  select coalesce(jsonb_agg(jsonb_build_array(weekday, start_time, end_time)
    order by weekday, start_time, end_time), '[]'::jsonb)
  into normalized_schedules
  from jsonb_to_recordset(schedules_payload) as s(weekday smallint, start_time time, end_time time);

  schedules_changed := previous_schedules is distinct from normalized_schedules;

  requested_capacity := nullif(class_payload ->> 'capacity', '')::integer;

  select count(*)::integer
  into active_count
  from public.enrollments
  where class_id = target_class_id
    and status = 'active';

  update public.classes
  set
    name = btrim(class_payload ->> 'name'),
    description = nullif(btrim(coalesce(class_payload ->> 'description', '')), ''),
    capacity = requested_capacity,
    status = coalesce(nullif(class_payload ->> 'status', '')::public.class_status, status)
  where id = target_class_id;

  if not found then
    raise exception 'Class not found.' using errcode = 'P0002';
  end if;

  -- Metadata-only edits must not detach historical sessions from their schedule.
  if schedules_changed then
  delete from public.class_schedules where class_id = target_class_id;

  for schedule_item in select value from jsonb_array_elements(schedules_payload) loop
    insert into public.class_schedules (class_id, weekday, start_time, end_time)
    values (
      target_class_id,
      (schedule_item ->> 'weekday')::smallint,
      (schedule_item ->> 'start_time')::time,
      (schedule_item ->> 'end_time')::time
    );
  end loop;
  end if;

  insert into public.audit_events (actor_user_id, entity_type, entity_id, action, metadata)
  values
    (
      actor_id,
      'class',
      target_class_id,
      'class.updated',
      jsonb_build_object('active_enrollments', active_count, 'capacity', requested_capacity)
    );

  if schedules_changed then
    insert into public.audit_events (actor_user_id, entity_type, entity_id, action, metadata)
    values (
      actor_id,
      'class',
      target_class_id,
      'class.schedule_changed',
      jsonb_build_object('schedule_count', jsonb_array_length(schedules_payload))
    );

  end if;

  return target_class_id;
end;
$$;


alter function public.update_class_with_schedules(jsonb) owner to postgres;
revoke all on function public.update_class_with_schedules(jsonb) from public, anon;
grant execute on function public.update_class_with_schedules(jsonb) to authenticated;
