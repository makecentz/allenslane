begin;

-- Enrollment records can be read through RLS, but staff mutations must use the
-- guarded RPC below so every change is MFA-backed, permission-scoped, and
-- accompanied by an audit reason.
revoke insert, update, delete on public.registrations from authenticated;
revoke insert, update, delete on public.waitlist_entries from authenticated;

create index if not exists waitlist_active_offers_idx
  on public.waitlist_entries (class_id, offer_expires_at, id)
  where status = 'offered';

create or replace view public.enrollment_desk_entries
with (security_invoker = true)
as
select
  h.id,
  'hold'::text as record_type,
  h.class_id,
  c.code as class_code,
  c.title as class_title,
  c.checkout_mode,
  h.participant_person_id,
  concat_ws(' ', coalesce(nullif(p.preferred_name, ''), p.first_name), p.last_name) as participant_name,
  h.household_id,
  hh.name as household_name,
  h.status,
  h.total_amount as amount,
  h.created_at as occurred_at,
  h.expires_at,
  null::text as reason
from public.registration_holds h
join public.classes c on c.id = h.class_id
join public.people p on p.id = h.participant_person_id
join public.households hh on hh.id = h.household_id
union all
select
  r.id,
  'registration'::text,
  r.class_id,
  c.code,
  c.title,
  c.checkout_mode,
  r.participant_person_id,
  concat_ws(' ', coalesce(nullif(p.preferred_name, ''), p.first_name), p.last_name),
  r.household_id,
  hh.name,
  r.status,
  null::numeric(12,2),
  r.registered_at,
  null::timestamptz,
  r.cancellation_reason
from public.registrations r
join public.classes c on c.id = r.class_id
join public.people p on p.id = r.participant_person_id
join public.households hh on hh.id = r.household_id
union all
select
  w.id,
  'waitlist'::text,
  w.class_id,
  c.code,
  c.title,
  c.checkout_mode,
  w.participant_person_id,
  concat_ws(' ', coalesce(nullif(p.preferred_name, ''), p.first_name), p.last_name),
  w.household_id,
  hh.name,
  w.status,
  null::numeric(12,2),
  w.joined_at,
  w.offer_expires_at,
  null::text
from public.waitlist_entries w
join public.classes c on c.id = w.class_id
join public.people p on p.id = w.participant_person_id
join public.households hh on hh.id = w.household_id;

revoke all on public.enrollment_desk_entries from public, anon, authenticated;
grant select on public.enrollment_desk_entries to authenticated;

create or replace function public.manage_enrollment_record(
  p_record_type text,
  p_record_id uuid,
  p_action text,
  p_reason text,
  p_offer_hours integer default 48
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_type text := lower(trim(coalesce(p_record_type, '')));
  normalized_action text := lower(trim(coalesce(p_action, '')));
  normalized_reason text := trim(coalesce(p_reason, ''));
  target_class_id uuid;
  target_status text;
  class_record record;
  occupied_count integer;
  saved_status text;
  saved_expires_at timestamptz;
  linked_order_status text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.authorize('registrations.manage') then
    raise exception 'An active MFA-backed Registration Manager role is required';
  end if;
  if p_record_id is null then
    raise exception 'Choose an enrollment record';
  end if;
  if char_length(normalized_reason) not between 10 and 500 then
    raise exception 'Enter an operational reason between 10 and 500 characters';
  end if;
  if p_offer_hours is null or p_offer_hours not between 1 and 168 then
    raise exception 'Waitlist offers must remain open for 1 to 168 hours';
  end if;

  if normalized_type = 'hold' then
    select h.class_id into target_class_id
    from public.registration_holds h
    where h.id = p_record_id;
  elsif normalized_type = 'registration' then
    select r.class_id into target_class_id
    from public.registrations r
    where r.id = p_record_id;
  elsif normalized_type = 'waitlist' then
    select w.class_id into target_class_id
    from public.waitlist_entries w
    where w.id = p_record_id;
  else
    raise exception 'Unsupported enrollment record type';
  end if;

  if target_class_id is null then
    raise exception 'Enrollment record not found';
  end if;

  -- Every enrollment transaction locks the class before its child record so
  -- capacity-sensitive operations have a single, consistent lock order.
  select c.id, c.checkout_mode, c.capacity, c.status
    into class_record
  from public.classes c
  where c.id = target_class_id
  for update;

  if class_record.id is null then
    raise exception 'Class not found';
  end if;
  if class_record.checkout_mode <> 'internal' then
    raise exception 'Canvas-managed classes are read-only during parallel operations';
  end if;

  perform set_config('app.audit_reason', normalized_reason, true);

  if normalized_type = 'hold' then
    if normalized_action <> 'cancel' then
      raise exception 'Unsupported registration-hold action';
    end if;

    select h.status into target_status
    from public.registration_holds h
    where h.id = p_record_id
    for update;

    if target_status is null then
      raise exception 'Registration hold no longer exists';
    end if;

    if target_status <> 'active' then
      raise exception 'Only an active registration hold can be canceled';
    end if;

    update public.registration_holds
    set status = 'canceled', updated_by = current_user_id
    where id = p_record_id
    returning status into saved_status;

  elsif normalized_type = 'registration' then
    if normalized_action <> 'cancel' then
      raise exception 'Unsupported registration action';
    end if;

    select r.status, o.status
      into target_status, linked_order_status
    from public.registrations r
    left join public.order_items oi on oi.id = r.order_item_id
    left join public.orders o on o.id = oi.order_id
    where r.id = p_record_id
    for update of r;

    if target_status is null then
      raise exception 'Registration no longer exists';
    end if;

    if target_status not in ('pending', 'registered', 'transferred') then
      raise exception 'Only an active registration can be canceled';
    end if;
    if linked_order_status in ('paid', 'partially_paid', 'closed') then
      raise exception 'A financially settled registration requires the Finance check-refund workflow';
    end if;

    update public.registrations
    set status = 'canceled',
        canceled_at = now(),
        cancellation_reason = normalized_reason,
        updated_by = current_user_id
    where id = p_record_id
    returning status into saved_status;

  elsif normalized_type = 'waitlist' then
    select w.status into target_status
    from public.waitlist_entries w
    where w.id = p_record_id
    for update;

    if target_status is null then
      raise exception 'Waitlist entry no longer exists';
    end if;

    if normalized_action = 'offer' then
      if target_status <> 'waiting' then
        raise exception 'Only a waiting entry can receive an offer';
      end if;
      if class_record.status not in ('open', 'waitlist') then
        raise exception 'The class is not accepting enrollment activity';
      end if;

      update public.registration_holds
      set status = 'expired', updated_by = current_user_id
      where class_id = target_class_id
        and status = 'active'
        and expires_at <= now();

      update public.waitlist_entries
      set status = 'expired', resolved_at = now()
      where class_id = target_class_id
        and status = 'offered'
        and offer_expires_at <= now();

      if p_record_id <> (
        select w.id
        from public.waitlist_entries w
        where w.class_id = target_class_id
          and w.status = 'waiting'
        order by w.joined_at, w.id
        limit 1
      ) then
        raise exception 'Offers must follow the waitlist order';
      end if;

      select
        (select count(*) from public.registrations r
          where r.class_id = target_class_id
            and r.status in ('pending', 'registered', 'transferred'))
        +
        (select count(*) from public.registration_holds h
          where h.class_id = target_class_id
            and h.status = 'active'
            and h.expires_at > now())
        +
        (select count(*) from public.waitlist_entries w
          where w.class_id = target_class_id
            and w.status = 'offered'
            and w.offer_expires_at > now())
      into occupied_count;

      if occupied_count >= class_record.capacity then
        raise exception 'No capacity is available for a waitlist offer';
      end if;

      saved_expires_at := now() + make_interval(hours => p_offer_hours);
      update public.waitlist_entries
      set status = 'offered',
          offered_at = now(),
          offer_expires_at = saved_expires_at,
          resolved_at = null
      where id = p_record_id
      returning status into saved_status;

    elsif normalized_action = 'remove' then
      if target_status not in ('waiting', 'offered') then
        raise exception 'Only a waiting or offered entry can be removed';
      end if;
      update public.waitlist_entries
      set status = 'removed', resolved_at = now()
      where id = p_record_id
      returning status into saved_status;

    elsif normalized_action = 'return_to_waiting' then
      if target_status not in ('offered', 'expired') then
        raise exception 'Only an offered or expired entry can return to waiting';
      end if;
      update public.waitlist_entries
      set status = 'waiting',
          offered_at = null,
          offer_expires_at = null,
          resolved_at = null
      where id = p_record_id
      returning status into saved_status;

    else
      raise exception 'Unsupported waitlist action';
    end if;
  end if;

  return jsonb_build_object(
    'record_id', p_record_id,
    'record_type', normalized_type,
    'action', normalized_action,
    'status', saved_status,
    'expires_at', saved_expires_at
  );
end;
$$;

revoke all on function public.manage_enrollment_record(text, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.manage_enrollment_record(text, uuid, text, text, integer)
  to authenticated;

commit;
