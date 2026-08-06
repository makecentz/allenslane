begin;

-- Customer identity and household mutations use guarded functions instead of
-- broad browser table writes. Existing read access remains governed by RLS.
revoke insert, update, delete on public.people, public.households,
  public.household_members, public.addresses, public.participant_sensitive_details
  from authenticated;

create or replace function public.save_customer_household(
  p_first_name text,
  p_last_name text,
  p_preferred_name text default null,
  p_phone text default null,
  p_household_name text default null,
  p_address_id uuid default null,
  p_line1 text default null,
  p_line2 text default null,
  p_city text default null,
  p_region text default null,
  p_postal_code text default null,
  p_country_code text default 'US'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_person_id uuid;
  current_household_id uuid;
  normalized_country text := upper(coalesce(nullif(trim(p_country_code), ''), 'US'));
  has_address_input boolean := coalesce(nullif(trim(p_line1), ''), nullif(trim(p_city), ''), nullif(trim(p_region), ''), nullif(trim(p_postal_code), '')) is not null;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(p_first_name, ''))) not between 1 and 100
     or char_length(trim(coalesce(p_last_name, ''))) not between 1 and 100 then
    raise exception 'First and last name are required and must be 100 characters or fewer';
  end if;
  if char_length(coalesce(nullif(trim(p_preferred_name), ''), '')) > 100 then
    raise exception 'Preferred name must be 100 characters or fewer';
  end if;
  if char_length(coalesce(nullif(trim(p_phone), ''), '')) > 50 then
    raise exception 'Phone must be 50 characters or fewer';
  end if;
  if char_length(trim(coalesce(p_household_name, ''))) not between 1 and 150 then
    raise exception 'Household name is required and must be 150 characters or fewer';
  end if;

  select p.id into current_person_id
  from public.people p
  where p.auth_user_id = current_user_id
    and p.status = 'active';

  if current_person_id is null then
    raise exception 'Customer profile was not initialized';
  end if;

  select hm.household_id into current_household_id
  from public.household_members hm
  where hm.person_id = current_person_id
    and hm.status = 'active'
    and (hm.can_manage_household or hm.is_primary or hm.is_guardian)
  order by hm.is_primary desc, hm.created_at
  limit 1;

  if current_household_id is null then
    raise exception 'A manageable household is required';
  end if;

  perform set_config('app.audit_reason', 'Customer updated household profile', true);

  update public.people
  set first_name = trim(p_first_name),
      last_name = trim(p_last_name),
      preferred_name = nullif(trim(p_preferred_name), ''),
      phone = nullif(trim(p_phone), ''),
      updated_by = current_user_id
  where id = current_person_id;

  update public.households
  set name = trim(p_household_name),
      updated_by = current_user_id
  where id = current_household_id;

  if p_address_id is not null or has_address_input then
    if char_length(trim(coalesce(p_line1, ''))) not between 1 and 200
       or char_length(trim(coalesce(p_city, ''))) not between 1 and 100
       or char_length(trim(coalesce(p_region, ''))) not between 1 and 100
       or char_length(trim(coalesce(p_postal_code, ''))) not between 1 and 20 then
      raise exception 'A complete street, city, state, and postal code are required';
    end if;
    if char_length(coalesce(nullif(trim(p_line2), ''), '')) > 200 then
      raise exception 'Address line 2 must be 200 characters or fewer';
    end if;
    if normalized_country !~ '^[A-Z]{2}$' then
      raise exception 'Country code must contain two letters';
    end if;

    if p_address_id is null then
      update public.addresses
      set is_primary = false
      where household_id = current_household_id
        and address_type = 'home'
        and is_primary;

      insert into public.addresses (
        household_id, address_type, line1, line2, city, region,
        postal_code, country_code, is_primary
      ) values (
        current_household_id, 'home', trim(p_line1), nullif(trim(p_line2), ''),
        trim(p_city), trim(p_region), trim(p_postal_code), normalized_country, true
      );
    else
      update public.addresses
      set line1 = trim(p_line1),
          line2 = nullif(trim(p_line2), ''),
          city = trim(p_city),
          region = trim(p_region),
          postal_code = trim(p_postal_code),
          country_code = normalized_country,
          updated_at = now()
      where id = p_address_id
        and household_id = current_household_id;

      if not found then
        raise exception 'Address is not part of this household';
      end if;
    end if;
  end if;

  return current_household_id;
end;
$$;

create or replace function public.save_household_participant(
  p_household_id uuid,
  p_first_name text,
  p_last_name text,
  p_relationship text,
  p_person_id uuid default null,
  p_preferred_name text default null,
  p_birth_date date default null,
  p_email text default null,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  saved_person_id uuid;
  normalized_relationship text := lower(trim(coalesce(p_relationship, '')));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.can_manage_household(p_household_id) then
    raise exception 'Household management permission is required';
  end if;
  if char_length(trim(coalesce(p_first_name, ''))) not between 1 and 100
     or char_length(trim(coalesce(p_last_name, ''))) not between 1 and 100 then
    raise exception 'First and last name are required and must be 100 characters or fewer';
  end if;
  if char_length(coalesce(nullif(trim(p_preferred_name), ''), '')) > 100 then
    raise exception 'Preferred name must be 100 characters or fewer';
  end if;
  if normalized_relationship not in ('child', 'spouse', 'partner', 'dependent', 'other') then
    raise exception 'Choose a supported household relationship';
  end if;
  if p_birth_date is not null and (p_birth_date > current_date or p_birth_date < current_date - interval '120 years') then
    raise exception 'Birth date is outside the supported range';
  end if;
  if nullif(trim(p_email), '') is not null and trim(p_email) !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if char_length(coalesce(nullif(trim(p_email), ''), '')) > 320
     or char_length(coalesce(nullif(trim(p_phone), ''), '')) > 50 then
    raise exception 'Email or phone is too long';
  end if;

  perform set_config('app.audit_reason', 'Customer saved household participant', true);

  if p_person_id is null then
    insert into public.people (
      first_name, last_name, preferred_name, email, phone, birth_date,
      created_by, updated_by
    ) values (
      trim(p_first_name), trim(p_last_name), nullif(trim(p_preferred_name), ''),
      nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''), p_birth_date,
      current_user_id, current_user_id
    ) returning id into saved_person_id;

    insert into public.household_members (
      household_id, person_id, relationship, is_primary, is_guardian,
      can_manage_household, status
    ) values (
      p_household_id, saved_person_id, normalized_relationship, false, false,
      false, 'active'
    );
  else
    select p.id into saved_person_id
    from public.people p
    join public.household_members hm on hm.person_id = p.id
    where p.id = p_person_id
      and p.auth_user_id is null
      and p.status = 'active'
      and hm.household_id = p_household_id
      and hm.status = 'active';

    if saved_person_id is null then
      raise exception 'Participant is not editable in this household';
    end if;

    update public.people
    set first_name = trim(p_first_name),
        last_name = trim(p_last_name),
        preferred_name = nullif(trim(p_preferred_name), ''),
        email = nullif(lower(trim(p_email)), ''),
        phone = nullif(trim(p_phone), ''),
        birth_date = p_birth_date,
        updated_by = current_user_id
    where id = saved_person_id;

    update public.household_members
    set relationship = normalized_relationship,
        updated_at = now()
    where household_id = p_household_id
      and person_id = saved_person_id;
  end if;

  return saved_person_id;
end;
$$;

-- Extend audit coverage to customer-maintained identity records. Sensitive
-- medical/accommodation details intentionally remain outside this release.
create trigger audit_people
after insert or update or delete on public.people
for each row execute function private.write_audit_event();
create trigger audit_households
after insert or update or delete on public.households
for each row execute function private.write_audit_event();
create trigger audit_household_members
after insert or update or delete on public.household_members
for each row execute function private.write_audit_event();
create trigger audit_addresses
after insert or update or delete on public.addresses
for each row execute function private.write_audit_event();

revoke all on function public.save_customer_household(text, text, text, text, text, uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_customer_household(text, text, text, text, text, uuid, text, text, text, text, text, text) to authenticated;
revoke all on function public.save_household_participant(uuid, text, text, text, uuid, text, date, text, text) from public, anon, authenticated;
grant execute on function public.save_household_participant(uuid, text, text, text, uuid, text, date, text, text) to authenticated;

commit;
