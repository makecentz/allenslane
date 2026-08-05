begin;

-- Staff access mutations are performed only through the guarded RPCs below.
-- SELECT remains governed by the existing RLS policies.
revoke insert, update, delete on public.staff_accounts from authenticated;
revoke insert, update, delete on public.user_roles from authenticated;

create or replace function private.validate_staff_access_change(
  requested_role public.staff_role,
  change_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.authorize('staff.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Staff Management permission is required';
  end if;

  if char_length(trim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'A reason of at least 10 characters is required';
  end if;

  if requested_role in ('finance'::public.staff_role, 'finance_approver'::public.staff_role)
     and not private.authorize('finance.approve') then
    raise exception using errcode = '42501', message = 'Finance Approver permission is required for Finance role changes';
  end if;

  if requested_role = 'system_admin'::public.staff_role
     and not private.has_role('system_admin'::public.staff_role) then
    raise exception using errcode = '42501', message = 'Only a System Administrator may change System Administrator access';
  end if;
end;
$$;

revoke all on function private.validate_staff_access_change(public.staff_role, text)
from public, anon, authenticated, service_role;

create or replace function public.get_staff_access_register()
returns table (
  auth_user_id uuid,
  first_name text,
  last_name text,
  preferred_name text,
  email text,
  status text,
  mfa_required boolean,
  last_reviewed_at timestamptz,
  updated_at timestamptz,
  active_roles text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.authorize('staff.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Staff Management permission is required';
  end if;

  return query
  select
    sa.auth_user_id,
    p.first_name,
    p.last_name,
    p.preferred_name,
    coalesce(u.email::text, p.email),
    sa.status,
    sa.mfa_required,
    sa.last_reviewed_at,
    sa.updated_at,
    coalesce(
      array_agg(ur.role::text order by ur.role::text) filter (where ur.revoked_at is null),
      array[]::text[]
    )
  from public.staff_accounts sa
  join public.people p on p.id = sa.person_id
  join auth.users u on u.id = sa.auth_user_id
  left join public.user_roles ur on ur.auth_user_id = sa.auth_user_id and ur.revoked_at is null
  group by
    sa.auth_user_id, p.first_name, p.last_name, p.preferred_name, u.email, p.email,
    sa.status, sa.mfa_required, sa.last_reviewed_at, sa.updated_at
  order by lower(p.last_name), lower(p.first_name), sa.auth_user_id;
end;
$$;

create or replace function public.activate_existing_staff(
  target_email text,
  requested_role public.staff_role,
  change_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_person_id uuid;
begin
  perform private.validate_staff_access_change(requested_role, change_reason);

  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(target_email));

  if target_user_id is null then
    raise exception using errcode = 'P0002', message = 'No existing Allens Lane account matches that email';
  end if;

  select p.id into target_person_id
  from public.people p
  where p.auth_user_id = target_user_id;

  if target_person_id is null then
    raise exception using errcode = 'P0002', message = 'The account is not linked to an Allens Lane person record';
  end if;

  perform set_config('app.audit_reason', trim(change_reason), true);

  insert into public.staff_accounts (auth_user_id, person_id, status)
  values (target_user_id, target_person_id, 'active')
  on conflict (auth_user_id) do update
  set person_id = excluded.person_id,
      status = 'active',
      updated_at = now();

  insert into public.user_roles (auth_user_id, role, granted_at, granted_by, revoked_at, revoked_by, reason)
  values (target_user_id, requested_role, now(), (select auth.uid()), null, null, trim(change_reason))
  on conflict (auth_user_id, role) do update
  set granted_at = now(),
      granted_by = (select auth.uid()),
      revoked_at = null,
      revoked_by = null,
      reason = excluded.reason;

  return target_user_id;
end;
$$;

create or replace function public.manage_staff_role(
  target_auth_user_id uuid,
  requested_role public.staff_role,
  grant_role boolean,
  change_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  perform private.validate_staff_access_change(requested_role, change_reason);

  if not exists (
    select 1 from public.staff_accounts sa
    where sa.auth_user_id = target_auth_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'The target staff account does not exist';
  end if;

  if not grant_role
     and target_auth_user_id = (select auth.uid())
     and requested_role in ('system_admin'::public.staff_role, 'finance_approver'::public.staff_role) then
    raise exception using errcode = '42501', message = 'You cannot revoke your own recovery-critical role';
  end if;

  if not grant_role and requested_role = 'system_admin'::public.staff_role and not exists (
    select 1
    from public.staff_accounts sa
    join public.user_roles ur on ur.auth_user_id = sa.auth_user_id
    where sa.status = 'active'
      and ur.role = 'system_admin'::public.staff_role
      and ur.revoked_at is null
      and sa.auth_user_id <> target_auth_user_id
  ) then
    raise exception using errcode = '42501', message = 'At least one other active System Administrator must remain';
  end if;

  perform set_config('app.audit_reason', trim(change_reason), true);

  if grant_role then
    insert into public.user_roles (auth_user_id, role, granted_at, granted_by, revoked_at, revoked_by, reason)
    values (target_auth_user_id, requested_role, now(), (select auth.uid()), null, null, trim(change_reason))
    on conflict (auth_user_id, role) do update
    set granted_at = now(),
        granted_by = (select auth.uid()),
        revoked_at = null,
        revoked_by = null,
        reason = excluded.reason;
    return true;
  end if;

  update public.user_roles
  set revoked_at = now(),
      revoked_by = (select auth.uid()),
      reason = trim(change_reason)
  where auth_user_id = target_auth_user_id
    and role = requested_role
    and revoked_at is null;
  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$$;

create or replace function public.set_staff_account_status(
  target_auth_user_id uuid,
  new_status text,
  change_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_rows integer;
begin
  if (select auth.uid()) is null or not private.authorize('staff.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Staff Management permission is required';
  end if;

  if new_status not in ('active', 'suspended', 'disabled') then
    raise exception using errcode = '22023', message = 'Staff status must be active, suspended, or disabled';
  end if;

  if char_length(trim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'A reason of at least 10 characters is required';
  end if;

  if target_auth_user_id = (select auth.uid()) and new_status <> 'active' then
    raise exception using errcode = '42501', message = 'You cannot suspend or disable your own staff account';
  end if;

  if new_status <> 'active' and exists (
    select 1 from public.user_roles ur
    where ur.auth_user_id = target_auth_user_id
      and ur.role = 'system_admin'::public.staff_role
      and ur.revoked_at is null
  ) and not exists (
    select 1
    from public.staff_accounts sa
    join public.user_roles ur on ur.auth_user_id = sa.auth_user_id
    where sa.status = 'active'
      and ur.role = 'system_admin'::public.staff_role
      and ur.revoked_at is null
      and sa.auth_user_id <> target_auth_user_id
  ) then
    raise exception using errcode = '42501', message = 'At least one other active System Administrator must remain';
  end if;

  perform set_config('app.audit_reason', trim(change_reason), true);
  update public.staff_accounts
  set status = new_status,
      last_reviewed_at = now(),
      last_reviewed_by = (select auth.uid()),
      updated_at = now()
  where auth_user_id = target_auth_user_id
    and status <> new_status;
  get diagnostics changed_rows = row_count;
  return changed_rows > 0;
end;
$$;

revoke all on function public.get_staff_access_register() from public, anon, authenticated, service_role;
revoke all on function public.activate_existing_staff(text, public.staff_role, text) from public, anon, authenticated, service_role;
revoke all on function public.manage_staff_role(uuid, public.staff_role, boolean, text) from public, anon, authenticated, service_role;
revoke all on function public.set_staff_account_status(uuid, text, text) from public, anon, authenticated, service_role;

grant execute on function public.get_staff_access_register() to authenticated;
grant execute on function public.activate_existing_staff(text, public.staff_role, text) to authenticated;
grant execute on function public.manage_staff_role(uuid, public.staff_role, boolean, text) to authenticated;
grant execute on function public.set_staff_account_status(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

commit;
