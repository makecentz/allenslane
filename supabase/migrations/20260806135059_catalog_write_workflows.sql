begin;

-- Catalog mutations are only available through guarded RPCs. Public and staff
-- reads continue through the existing RLS policies.
revoke insert, update, delete on public.programs from authenticated;
revoke insert, update, delete on public.terms from authenticated;
revoke insert, update, delete on public.facilities from authenticated;
revoke insert, update, delete on public.classes from authenticated;

drop policy if exists staff_programs_manage on public.programs;
create policy staff_programs_read on public.programs for select to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

drop policy if exists staff_terms_manage on public.terms;
create policy staff_terms_read on public.terms for select to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

drop policy if exists staff_facilities_manage on public.facilities;
create policy staff_facilities_read on public.facilities for select to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

drop policy if exists staff_classes_manage on public.classes;
create policy staff_classes_read on public.classes for select to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

create or replace function private.validate_catalog_reason(change_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An authenticated staff session is required';
  end if;

  if char_length(trim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'A reason of at least 10 characters is required';
  end if;
end;
$$;

revoke all on function private.validate_catalog_reason(text)
from public, anon, authenticated, service_role;

create or replace function public.save_program(
  p_program_id uuid,
  p_parent_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_audience text,
  p_status text,
  p_display_order integer,
  p_change_reason text
)
returns public.programs
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_program public.programs;
  existing_status text;
  can_publish boolean := private.authorize('catalog.publish');
begin
  perform private.validate_catalog_reason(p_change_reason);

  if not (private.authorize('catalog.manage') or can_publish) then
    raise exception using errcode = '42501', message = 'Active MFA-backed Catalog permission is required';
  end if;

  if p_status not in ('draft', 'published', 'archived') then
    raise exception using errcode = '22023', message = 'Unsupported program status';
  end if;

  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
     or trim(coalesce(p_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Program code and name are required';
  end if;

  if p_parent_id is not null and not exists (
    select 1 from public.programs p where p.id = p_parent_id
  ) then
    raise exception using errcode = '23503', message = 'Parent program not found';
  end if;

  if p_program_id is not null then
    select p.status into existing_status from public.programs p where p.id = p_program_id;
    if existing_status is null then
      raise exception using errcode = 'P0002', message = 'Program not found';
    end if;
  end if;

  if p_program_id is not null and p_parent_id = p_program_id then
    raise exception using errcode = '22023', message = 'A program cannot be its own parent';
  end if;

  if not can_publish and (
    p_status in ('published', 'archived') or existing_status in ('published', 'archived')
  ) then
    raise exception using errcode = '42501', message = 'Catalog Publisher permission is required for published or archived programs';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_program_id is null then
    insert into public.programs (
      parent_id, code, name, description, audience, status, display_order, created_by, updated_by
    ) values (
      p_parent_id,
      upper(trim(p_code)),
      trim(p_name),
      nullif(trim(coalesce(p_description, '')), ''),
      nullif(trim(coalesce(p_audience, '')), ''),
      p_status,
      coalesce(p_display_order, 0),
      (select auth.uid()),
      (select auth.uid())
    ) returning * into saved_program;
  else
    update public.programs
    set parent_id = p_parent_id,
        code = upper(trim(p_code)),
        name = trim(p_name),
        description = nullif(trim(coalesce(p_description, '')), ''),
        audience = nullif(trim(coalesce(p_audience, '')), ''),
        status = p_status,
        display_order = coalesce(p_display_order, 0),
        updated_by = (select auth.uid())
    where id = p_program_id
    returning * into saved_program;
  end if;

  return saved_program;
end;
$$;

create or replace function public.save_term(
  p_term_id uuid,
  p_code text,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_registration_opens_at timestamptz,
  p_registration_closes_at timestamptz,
  p_status text,
  p_change_reason text
)
returns public.terms
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_term public.terms;
begin
  perform private.validate_catalog_reason(p_change_reason);

  if not private.authorize('catalog.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Catalog Management permission is required';
  end if;

  if p_status not in ('draft', 'open', 'closed', 'archived') then
    raise exception using errcode = '22023', message = 'Unsupported term status';
  end if;

  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
     or trim(coalesce(p_name, '')) = '' or p_starts_on is null or p_ends_on is null then
    raise exception using errcode = '22023', message = 'Term code, name, and dates are required';
  end if;

  if p_ends_on < p_starts_on then
    raise exception using errcode = '22023', message = 'Term end date must not precede its start date';
  end if;

  if p_registration_closes_at is not null and p_registration_opens_at is not null
     and p_registration_closes_at < p_registration_opens_at then
    raise exception using errcode = '22023', message = 'Registration close time must not precede its open time';
  end if;

  if p_term_id is not null and not exists (select 1 from public.terms t where t.id = p_term_id) then
    raise exception using errcode = 'P0002', message = 'Term not found';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_term_id is null then
    insert into public.terms (
      code, name, starts_on, ends_on, registration_opens_at, registration_closes_at, status
    ) values (
      upper(trim(p_code)), trim(p_name), p_starts_on, p_ends_on,
      p_registration_opens_at, p_registration_closes_at, p_status
    ) returning * into saved_term;
  else
    update public.terms
    set code = upper(trim(p_code)),
        name = trim(p_name),
        starts_on = p_starts_on,
        ends_on = p_ends_on,
        registration_opens_at = p_registration_opens_at,
        registration_closes_at = p_registration_closes_at,
        status = p_status
    where id = p_term_id
    returning * into saved_term;
  end if;

  return saved_term;
end;
$$;

create or replace function public.save_facility(
  p_facility_id uuid,
  p_code text,
  p_name text,
  p_address_text text,
  p_capacity integer,
  p_status text,
  p_change_reason text
)
returns public.facilities
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_facility public.facilities;
begin
  perform private.validate_catalog_reason(p_change_reason);

  if not private.authorize('catalog.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Catalog Management permission is required';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception using errcode = '22023', message = 'Unsupported facility status';
  end if;

  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
     or trim(coalesce(p_name, '')) = '' then
    raise exception using errcode = '22023', message = 'Facility code and name are required';
  end if;

  if p_capacity is not null and p_capacity < 0 then
    raise exception using errcode = '22023', message = 'Facility capacity cannot be negative';
  end if;

  if p_facility_id is not null and not exists (
    select 1 from public.facilities f where f.id = p_facility_id
  ) then
    raise exception using errcode = 'P0002', message = 'Facility not found';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_facility_id is null then
    insert into public.facilities (code, name, address_text, capacity, status)
    values (
      upper(trim(p_code)), trim(p_name), nullif(trim(coalesce(p_address_text, '')), ''),
      p_capacity, p_status
    ) returning * into saved_facility;
  else
    update public.facilities
    set code = upper(trim(p_code)),
        name = trim(p_name),
        address_text = nullif(trim(coalesce(p_address_text, '')), ''),
        capacity = p_capacity,
        status = p_status
    where id = p_facility_id
    returning * into saved_facility;
  end if;

  return saved_facility;
end;
$$;

create or replace function public.save_class(
  p_class_id uuid,
  p_program_id uuid,
  p_term_id uuid,
  p_facility_id uuid,
  p_code text,
  p_slug text,
  p_title text,
  p_summary text,
  p_description text,
  p_level text,
  p_age_min numeric,
  p_age_max numeric,
  p_capacity integer,
  p_minimum_enrollment integer,
  p_price numeric,
  p_member_price numeric,
  p_fee numeric,
  p_registration_opens_at timestamptz,
  p_registration_closes_at timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_image_path text,
  p_image_alt text,
  p_status text,
  p_gl_account_code text,
  p_change_reason text
)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_class public.classes;
  existing_status text;
  can_manage boolean := private.authorize('catalog.manage');
  can_publish boolean := private.authorize('catalog.publish');
begin
  perform private.validate_catalog_reason(p_change_reason);

  if not (can_manage or can_publish) then
    raise exception using errcode = '42501', message = 'Active MFA-backed Catalog permission is required';
  end if;

  if p_status not in ('draft', 'published', 'open', 'waitlist', 'closed', 'canceled', 'completed', 'archived') then
    raise exception using errcode = '22023', message = 'Unsupported class status';
  end if;

  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
     or lower(trim(coalesce(p_slug, ''))) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or trim(coalesce(p_title, '')) = '' then
    raise exception using errcode = '22023', message = 'Class code, slug, and title are required';
  end if;

  if not exists (select 1 from public.programs p where p.id = p_program_id) then
    raise exception using errcode = '23503', message = 'Class program not found';
  end if;

  if not exists (select 1 from public.terms t where t.id = p_term_id) then
    raise exception using errcode = '23503', message = 'Class term not found';
  end if;

  if p_facility_id is not null and not exists (
    select 1 from public.facilities f where f.id = p_facility_id
  ) then
    raise exception using errcode = '23503', message = 'Class facility not found';
  end if;

  if p_capacity is null or p_capacity < 0 or p_minimum_enrollment is null
     or p_minimum_enrollment < 0 or p_minimum_enrollment > p_capacity then
    raise exception using errcode = '22023', message = 'Class enrollment limits are invalid';
  end if;

  if p_price is null or p_price < 0 or p_fee is null or p_fee < 0
     or (p_member_price is not null and p_member_price < 0) then
    raise exception using errcode = '22023', message = 'Class prices cannot be negative';
  end if;

  if p_age_max is not null and p_age_min is not null and p_age_max < p_age_min then
    raise exception using errcode = '22023', message = 'Maximum age must not be less than minimum age';
  end if;

  if p_ends_at is not null and p_starts_at is not null and p_ends_at < p_starts_at then
    raise exception using errcode = '22023', message = 'Class end time must not precede its start time';
  end if;

  if p_registration_closes_at is not null and p_registration_opens_at is not null
     and p_registration_closes_at < p_registration_opens_at then
    raise exception using errcode = '22023', message = 'Registration close time must not precede its open time';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = coalesce(nullif(trim(p_timezone), ''), 'America/New_York')
  ) then
    raise exception using errcode = '22023', message = 'Unknown class timezone';
  end if;

  if p_class_id is not null then
    select c.status into existing_status from public.classes c where c.id = p_class_id;
    if existing_status is null then
      raise exception using errcode = 'P0002', message = 'Class not found';
    end if;
  end if;

  if not can_publish and (
    (existing_status is null and p_status in ('published', 'open', 'waitlist', 'closed', 'archived')) or
    (existing_status = 'draft' and p_status in ('published', 'open', 'waitlist', 'closed', 'archived')) or
    p_status = 'archived' or existing_status = 'archived'
  ) then
    raise exception using errcode = '42501', message = 'Catalog Publisher permission is required to release or archive a class';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_class_id is null then
    insert into public.classes (
      program_id, term_id, facility_id, code, slug, title, summary, description, level,
      age_min, age_max, capacity, minimum_enrollment, price, member_price, fee,
      registration_opens_at, registration_closes_at, starts_at, ends_at, timezone,
      image_path, image_alt, status, published_at, gl_account_code, created_by, updated_by
    ) values (
      p_program_id, p_term_id, p_facility_id, upper(trim(p_code)), lower(trim(p_slug)),
      trim(p_title), nullif(trim(coalesce(p_summary, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_level, '')), ''),
      p_age_min, p_age_max, p_capacity, p_minimum_enrollment, p_price, p_member_price, p_fee,
      p_registration_opens_at, p_registration_closes_at, p_starts_at, p_ends_at,
      coalesce(nullif(trim(p_timezone), ''), 'America/New_York'),
      nullif(trim(coalesce(p_image_path, '')), ''), nullif(trim(coalesce(p_image_alt, '')), ''),
      p_status, case when p_status in ('published', 'open', 'waitlist', 'closed') then now() else null end,
      nullif(trim(coalesce(p_gl_account_code, '')), ''), (select auth.uid()), (select auth.uid())
    ) returning * into saved_class;
  else
    update public.classes
    set program_id = p_program_id,
        term_id = p_term_id,
        facility_id = p_facility_id,
        code = upper(trim(p_code)),
        slug = lower(trim(p_slug)),
        title = trim(p_title),
        summary = nullif(trim(coalesce(p_summary, '')), ''),
        description = nullif(trim(coalesce(p_description, '')), ''),
        level = nullif(trim(coalesce(p_level, '')), ''),
        age_min = p_age_min,
        age_max = p_age_max,
        capacity = p_capacity,
        minimum_enrollment = p_minimum_enrollment,
        price = p_price,
        member_price = p_member_price,
        fee = p_fee,
        registration_opens_at = p_registration_opens_at,
        registration_closes_at = p_registration_closes_at,
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        timezone = coalesce(nullif(trim(p_timezone), ''), 'America/New_York'),
        image_path = nullif(trim(coalesce(p_image_path, '')), ''),
        image_alt = nullif(trim(coalesce(p_image_alt, '')), ''),
        status = p_status,
        published_at = case
          when p_status in ('published', 'open', 'waitlist', 'closed') then coalesce(published_at, now())
          when p_status = 'draft' then null
          else published_at
        end,
        gl_account_code = nullif(trim(coalesce(p_gl_account_code, '')), ''),
        updated_by = (select auth.uid())
    where id = p_class_id
    returning * into saved_class;
  end if;

  return saved_class;
end;
$$;

drop trigger if exists audit_programs on public.programs;
create trigger audit_programs after insert or update or delete on public.programs
for each row execute function private.write_audit_event();

drop trigger if exists audit_terms on public.terms;
create trigger audit_terms after insert or update or delete on public.terms
for each row execute function private.write_audit_event();

drop trigger if exists audit_facilities on public.facilities;
create trigger audit_facilities after insert or update or delete on public.facilities
for each row execute function private.write_audit_event();

drop trigger if exists audit_classes on public.classes;
create trigger audit_classes after insert or update or delete on public.classes
for each row execute function private.write_audit_event();

revoke all on function public.save_program(uuid, uuid, text, text, text, text, text, integer, text)
from public, anon, authenticated, service_role;
revoke all on function public.save_term(uuid, text, text, date, date, timestamptz, timestamptz, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.save_facility(uuid, text, text, text, integer, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.save_class(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, numeric, integer, integer, numeric, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.save_program(uuid, uuid, text, text, text, text, text, integer, text)
to authenticated;
grant execute on function public.save_term(uuid, text, text, date, date, timestamptz, timestamptz, text, text)
to authenticated;
grant execute on function public.save_facility(uuid, text, text, text, integer, text, text)
to authenticated;
grant execute on function public.save_class(uuid, uuid, uuid, uuid, text, text, text, text, text, text, numeric, numeric, integer, integer, numeric, numeric, numeric, timestamptz, timestamptz, timestamptz, timestamptz, text, text, text, text, text, text)
to authenticated;

notify pgrst, 'reload schema';

commit;
