begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.people (
    auth_user_id,
    first_name,
    last_name,
    email,
    created_by,
    updated_by
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), nullif(split_part(new.email, '@', 1), ''), 'New'),
    coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), 'User'),
    new.email,
    new.id,
    new.id
  )
  on conflict (auth_user_id) do update
  set email = excluded.email,
      updated_at = now(),
      updated_by = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.complete_customer_onboarding(
  first_name text,
  last_name text,
  preferred_name text default null,
  phone text default null,
  household_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_person_id uuid;
  existing_household_id uuid;
  new_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(complete_customer_onboarding.first_name), '') is null
     or nullif(trim(complete_customer_onboarding.last_name), '') is null then
    raise exception 'First and last name are required';
  end if;

  select p.id into current_person_id
  from public.people p
  where p.auth_user_id = current_user_id;

  if current_person_id is null then
    raise exception 'Customer profile was not initialized';
  end if;

  update public.people
  set first_name = trim(complete_customer_onboarding.first_name),
      last_name = trim(complete_customer_onboarding.last_name),
      preferred_name = nullif(trim(complete_customer_onboarding.preferred_name), ''),
      phone = nullif(trim(complete_customer_onboarding.phone), ''),
      updated_by = current_user_id
  where id = current_person_id;

  select hm.household_id into existing_household_id
  from public.household_members hm
  where hm.person_id = current_person_id
    and hm.status = 'active'
  order by hm.is_primary desc, hm.created_at
  limit 1;

  if existing_household_id is not null then
    return existing_household_id;
  end if;

  insert into public.households (name, primary_person_id, created_by, updated_by)
  values (
    coalesce(
      nullif(trim(complete_customer_onboarding.household_name), ''),
      trim(complete_customer_onboarding.last_name) || ' Household'
    ),
    current_person_id,
    current_user_id,
    current_user_id
  )
  returning id into new_household_id;

  insert into public.household_members (
    household_id,
    person_id,
    relationship,
    is_primary,
    is_guardian,
    can_manage_household
  ) values (
    new_household_id,
    current_person_id,
    'self',
    true,
    true,
    true
  );

  return new_household_id;
end;
$$;

revoke all on function public.complete_customer_onboarding(text, text, text, text, text) from public;
grant execute on function public.complete_customer_onboarding(text, text, text, text, text) to authenticated;

create or replace function private.bootstrap_initial_staff(
  target_email text,
  first_name text,
  last_name text,
  target_roles public.staff_role[] default array['system_admin'::public.staff_role]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  target_person_id uuid;
  requested_role public.staff_role;
begin
  select u.id into target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(target_email));

  if target_user_id is null then
    raise exception 'Create and verify the Supabase Auth user before bootstrapping staff access';
  end if;

  insert into public.people (auth_user_id, first_name, last_name, email)
  values (
    target_user_id,
    trim(bootstrap_initial_staff.first_name),
    trim(bootstrap_initial_staff.last_name),
    lower(trim(bootstrap_initial_staff.target_email))
  )
  on conflict (auth_user_id) do update
  set first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      updated_at = now()
  returning id into target_person_id;

  insert into public.staff_accounts (auth_user_id, person_id, status)
  values (target_user_id, target_person_id, 'active')
  on conflict (auth_user_id) do update
  set person_id = excluded.person_id,
      status = 'active',
      updated_at = now();

  foreach requested_role in array target_roles loop
    insert into public.user_roles (auth_user_id, role, reason)
    values (target_user_id, requested_role, 'Initial production bootstrap')
    on conflict (auth_user_id, role) do update
    set revoked_at = null,
        revoked_by = null,
        reason = excluded.reason,
        granted_at = now();
  end loop;

  return target_user_id;
end;
$$;

revoke all on function private.bootstrap_initial_staff(text, text, text, public.staff_role[]) from public, anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('private-documents', 'private-documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy public_media_read
on storage.objects for select to anon, authenticated
using (bucket_id = 'public-media');

create policy public_media_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'public-media'
  and (private.authorize('content.edit') or private.authorize('catalog.manage') or private.authorize('events.manage'))
);

create policy public_media_staff_update
on storage.objects for update to authenticated
using (
  bucket_id = 'public-media'
  and (private.authorize('content.edit') or private.authorize('catalog.manage') or private.authorize('events.manage'))
)
with check (
  bucket_id = 'public-media'
  and (private.authorize('content.edit') or private.authorize('catalog.manage') or private.authorize('events.manage'))
);

create policy public_media_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'public-media'
  and (private.authorize('content.publish') or private.authorize('catalog.manage') or private.authorize('events.manage'))
);

create policy private_documents_staff_read
on storage.objects for select to authenticated
using (
  bucket_id = 'private-documents'
  and (private.authorize('people.manage') or private.authorize('registrations.manage') or private.authorize('development.manage'))
);

create policy private_documents_staff_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-documents'
  and (private.authorize('people.manage') or private.authorize('registrations.manage') or private.authorize('development.manage'))
);

create policy private_documents_staff_update
on storage.objects for update to authenticated
using (
  bucket_id = 'private-documents'
  and (private.authorize('people.manage') or private.authorize('registrations.manage') or private.authorize('development.manage'))
)
with check (
  bucket_id = 'private-documents'
  and (private.authorize('people.manage') or private.authorize('registrations.manage') or private.authorize('development.manage'))
);

create policy private_documents_staff_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-documents'
  and (private.authorize('people.manage') or private.authorize('registrations.manage') or private.authorize('development.manage'))
);

commit;
