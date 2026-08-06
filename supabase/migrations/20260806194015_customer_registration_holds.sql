begin;

-- A registration hold reserves capacity briefly while checkout is prepared.
-- It is deliberately separate from orders and registrations: only a verified
-- Stripe webhook will create the financial/order records in a later release.
create table public.registration_holds (
  id uuid primary key default extensions.gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  participant_person_id uuid not null references public.people(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  purchaser_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'converted', 'expired', 'canceled')),
  unit_amount numeric(12,2) not null check (unit_amount >= 0),
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  constraint registration_hold_expiry check (expires_at > created_at),
  constraint registration_hold_total check (total_amount = unit_amount + fee_amount)
);

create unique index registration_holds_one_active_participant_idx
  on public.registration_holds (class_id, participant_person_id)
  where status = 'active';
create index registration_holds_capacity_idx
  on public.registration_holds (class_id, expires_at)
  where status = 'active';
create index registration_holds_household_idx
  on public.registration_holds (household_id, created_at desc);
create index registration_holds_participant_idx
  on public.registration_holds (participant_person_id, created_at desc);
create index registration_holds_purchaser_idx
  on public.registration_holds (purchaser_person_id, created_at desc);
create index registration_holds_created_by_idx
  on public.registration_holds (created_by);
create index registration_holds_updated_by_idx
  on public.registration_holds (updated_by)
  where updated_by is not null;

-- Historical cancellations and removals must not permanently prevent a
-- participant from registering or joining the same class again.
alter table public.registrations
  drop constraint registrations_class_id_participant_person_id_key;
create unique index registrations_one_active_participant_idx
  on public.registrations (class_id, participant_person_id)
  where status in ('pending', 'registered', 'transferred');

alter table public.waitlist_entries
  drop constraint waitlist_entries_class_id_participant_person_id_key;
create unique index waitlist_one_active_participant_idx
  on public.waitlist_entries (class_id, participant_person_id)
  where status in ('waiting', 'offered', 'accepted');

create index registrations_participant_idx
  on public.registrations (participant_person_id, registered_at desc);
create index waitlist_participant_idx
  on public.waitlist_entries (participant_person_id, joined_at desc);
create index waitlist_household_idx
  on public.waitlist_entries (household_id, joined_at desc);

alter table public.registration_holds enable row level security;
alter table public.registration_holds force row level security;

create policy registration_holds_household_read
on public.registration_holds for select to authenticated
using (
  private.is_household_member(household_id)
  or private.authorize('registrations.manage')
  or private.authorize('finance.view')
);

revoke all on public.registration_holds from public, anon, authenticated;
grant select on public.registration_holds to authenticated;
grant select, insert, update, delete on public.registration_holds to service_role;

create trigger set_updated_at
before update on public.registration_holds
for each row execute function private.set_updated_at();

create trigger audit_registration_holds
after insert or update or delete on public.registration_holds
for each row execute function private.write_audit_event();

create trigger audit_waitlist_entries
after insert or update or delete on public.waitlist_entries
for each row execute function private.write_audit_event();

create or replace function public.prepare_class_registration(
  p_class_id uuid,
  p_participant_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  current_user_id uuid := (select auth.uid());
  purchaser_person_id uuid;
  managed_household_id uuid;
  participant_birth_date date;
  class_record record;
  effective_registration_opens_at timestamptz;
  effective_registration_closes_at timestamptz;
  reference_date date;
  participant_age integer;
  effective_unit_amount numeric(12,2);
  active_registration_id uuid;
  active_hold_id uuid;
  active_hold_expires_at timestamptz;
  active_waitlist_id uuid;
  active_waitlist_joined_at timestamptz;
  occupied_count integer;
  waitlist_position integer;
  saved_id uuid;
  saved_expires_at timestamptz;
begin
  if current_user_id is null then
    raise exception 'Sign in before registering for a class';
  end if;
  if p_class_id is null or p_participant_person_id is null then
    raise exception 'Choose a class and household participant';
  end if;

  -- Lock the class first for every request. Capacity checks and inserts then
  -- run serially for this class, without holding a lock during Stripe calls.
  select c.*, t.registration_opens_at as term_registration_opens_at,
         t.registration_closes_at as term_registration_closes_at
    into class_record
  from public.classes c
  join public.terms t on t.id = c.term_id
  where c.id = p_class_id
  for update of c;

  if class_record.id is null then
    raise exception 'Class not found';
  end if;
  if class_record.status not in ('open', 'waitlist') then
    raise exception 'Registration is not available for this class';
  end if;

  select hm.household_id, p.birth_date
    into managed_household_id, participant_birth_date
  from public.household_members hm
  join public.people p on p.id = hm.person_id and p.status = 'active'
  where hm.person_id = p_participant_person_id
    and hm.status = 'active'
    and private.can_manage_household(hm.household_id)
  order by hm.is_primary desc, hm.created_at
  limit 1;

  if managed_household_id is null then
    raise exception 'You cannot register this participant';
  end if;

  select p.id into purchaser_person_id
  from public.people p
  join public.household_members hm
    on hm.person_id = p.id
   and hm.household_id = managed_household_id
   and hm.status = 'active'
  where p.auth_user_id = current_user_id
    and p.status = 'active'
  limit 1;

  if purchaser_person_id is null then
    raise exception 'Your customer profile is not connected to this household';
  end if;

  if class_record.member_price is not null and exists (
    select 1
    from public.memberships m
    where m.status = 'active'
      and current_date between m.starts_on and m.ends_on
      and (m.household_id = managed_household_id or m.person_id = p_participant_person_id)
  ) then
    effective_unit_amount := class_record.member_price;
  else
    effective_unit_amount := class_record.price;
  end if;

  if not exists (
    select 1
    from public.addresses a
    where a.household_id = managed_household_id
      and a.address_type = 'home'
      and nullif(trim(a.line1), '') is not null
      and nullif(trim(a.city), '') is not null
      and nullif(trim(a.region), '') is not null
      and nullif(trim(a.postal_code), '') is not null
  ) then
    raise exception 'Add a complete home address to your household before registering';
  end if;

  effective_registration_opens_at := coalesce(
    class_record.registration_opens_at,
    class_record.term_registration_opens_at
  );
  effective_registration_closes_at := coalesce(
    class_record.registration_closes_at,
    class_record.term_registration_closes_at
  );

  if effective_registration_opens_at is not null and now() < effective_registration_opens_at then
    raise exception 'Registration has not opened for this class';
  end if;
  if effective_registration_closes_at is not null and now() > effective_registration_closes_at then
    raise exception 'Registration has closed for this class';
  end if;

  if class_record.age_min is not null or class_record.age_max is not null then
    if participant_birth_date is null then
      raise exception 'Add the participant birth date before registering for this class';
    end if;
    reference_date := coalesce(class_record.starts_at::date, current_date);
    participant_age := extract(year from age(reference_date, participant_birth_date))::integer;
    if class_record.age_min is not null and participant_age < class_record.age_min then
      raise exception 'This participant is younger than the class age range';
    end if;
    if class_record.age_max is not null and participant_age > class_record.age_max then
      raise exception 'This participant is older than the class age range';
    end if;
  end if;

  select r.id into active_registration_id
  from public.registrations r
  where r.class_id = p_class_id
    and r.participant_person_id = p_participant_person_id
    and r.status in ('pending', 'registered', 'transferred')
  limit 1;

  if active_registration_id is not null then
    return jsonb_build_object(
      'action', 'already_registered',
      'registration_id', active_registration_id
    );
  end if;

  perform set_config('app.audit_reason', 'Customer prepared class registration', true);

  update public.registration_holds
  set status = 'expired', updated_by = current_user_id
  where class_id = p_class_id
    and status = 'active'
    and expires_at <= now();

  select h.id, h.expires_at
    into active_hold_id, active_hold_expires_at
  from public.registration_holds h
  where h.class_id = p_class_id
    and h.participant_person_id = p_participant_person_id
    and h.status = 'active'
    and h.expires_at > now()
  limit 1;

  if active_hold_id is not null then
    return jsonb_build_object(
      'action', 'registration_hold',
      'hold_id', active_hold_id,
      'expires_at', active_hold_expires_at,
      'total_amount', effective_unit_amount + class_record.fee
    );
  end if;

  select w.id, w.joined_at
    into active_waitlist_id, active_waitlist_joined_at
  from public.waitlist_entries w
  where w.class_id = p_class_id
    and w.participant_person_id = p_participant_person_id
    and w.status in ('waiting', 'offered', 'accepted')
  order by w.joined_at
  limit 1;

  if active_waitlist_id is not null then
    select count(*)::integer into waitlist_position
    from public.waitlist_entries w
    where w.class_id = p_class_id
      and w.status in ('waiting', 'offered')
      and (w.joined_at, w.id) <= (active_waitlist_joined_at, active_waitlist_id);

    return jsonb_build_object(
      'action', 'waitlisted',
      'waitlist_entry_id', active_waitlist_id,
      'position', greatest(waitlist_position, 1)
    );
  end if;

  select
    (select count(*) from public.registrations r
      where r.class_id = p_class_id
        and r.status in ('pending', 'registered', 'transferred'))
    +
    (select count(*) from public.registration_holds h
      where h.class_id = p_class_id
        and h.status = 'active'
        and h.expires_at > now())
  into occupied_count;

  if class_record.status = 'open' and occupied_count < class_record.capacity then
    saved_expires_at := now() + interval '15 minutes';
    insert into public.registration_holds (
      class_id, participant_person_id, household_id, purchaser_person_id,
      unit_amount, fee_amount, total_amount, expires_at, created_by, updated_by
    ) values (
      p_class_id, p_participant_person_id, managed_household_id, purchaser_person_id,
      effective_unit_amount, class_record.fee, effective_unit_amount + class_record.fee,
      saved_expires_at, current_user_id, current_user_id
    ) returning id into saved_id;

    return jsonb_build_object(
      'action', 'registration_hold',
      'hold_id', saved_id,
      'expires_at', saved_expires_at,
      'total_amount', effective_unit_amount + class_record.fee
    );
  end if;

  insert into public.waitlist_entries (
    class_id, participant_person_id, household_id, status
  ) values (
    p_class_id, p_participant_person_id, managed_household_id, 'waiting'
  ) returning id into saved_id;

  select count(*)::integer into waitlist_position
  from public.waitlist_entries w
  where w.class_id = p_class_id
    and w.status in ('waiting', 'offered');

  return jsonb_build_object(
    'action', 'waitlisted',
    'waitlist_entry_id', saved_id,
    'position', waitlist_position
  );
end;
$$;

revoke all on function public.prepare_class_registration(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_class_registration(uuid, uuid)
  to authenticated;

commit;
