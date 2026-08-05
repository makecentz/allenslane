begin;

alter table public.payments
  add column voided_by uuid references auth.users(id) on delete restrict,
  add column voided_at timestamptz,
  add column void_reason text,
  add constraint payment_void_fields check (
    status <> 'voided' or (voided_by is not null and voided_at is not null and void_reason is not null)
  );

insert into public.role_permissions (role, permission, description) values
  ('front_desk', 'people.view', 'View customer and household records'),
  ('front_desk', 'registrations.manage', 'Assist with registrations and waitlists'),
  ('front_desk', 'commerce.intake', 'Create orders and accept authorized payments'),
  ('registrar', 'people.view', 'View customer and household records'),
  ('registrar', 'people.manage', 'Maintain customer and household records'),
  ('registrar', 'catalog.manage', 'Manage programs, terms, classes, meetings, and facilities'),
  ('registrar', 'registrations.manage', 'Manage registration, transfer, drop, and waitlist workflows'),
  ('registrar', 'rosters.view', 'View class rosters'),
  ('registrar', 'minors.sensitive', 'View and maintain necessary youth emergency and accessibility details'),
  ('instructor', 'rosters.assigned', 'View rosters only for assigned classes'),
  ('events_manager', 'events.manage', 'Manage events and retained ticketing links'),
  ('events_manager', 'people.view', 'View event customer records'),
  ('content_editor', 'content.edit', 'Create and edit draft public content'),
  ('content_publisher', 'content.edit', 'Create and edit draft public content'),
  ('content_publisher', 'content.publish', 'Publish and archive public content'),
  ('content_publisher', 'catalog.publish', 'Publish program and class catalog content'),
  ('development', 'people.view', 'View constituent and household records'),
  ('development', 'development.manage', 'Manage memberships, campaigns, gifts, and acknowledgements'),
  ('development', 'reports.department', 'Run Development reports'),
  ('finance', 'finance.view', 'View orders, payments, adjustments, and reconciliation data'),
  ('finance', 'finance.reconcile', 'Maintain accounting mappings and reconciliation records'),
  ('finance', 'reports.finance', 'Run Finance reports'),
  ('finance_approver', 'finance.view', 'View orders, payments, adjustments, and reconciliation data'),
  ('finance_approver', 'finance.reconcile', 'Maintain accounting mappings and reconciliation records'),
  ('finance_approver', 'finance.approve', 'Approve and complete offline-check refunds and payment voids'),
  ('finance_approver', 'reports.finance', 'Run Finance reports'),
  ('finance_approver', 'audit.view', 'Review privileged financial audit events'),
  ('reports_user', 'reports.department', 'Run explicitly granted departmental reports'),
  ('support_admin', 'people.view', 'View customer records for support'),
  ('support_admin', 'staff.manage', 'Invite, suspend, and assign approved staff access'),
  ('support_admin', 'audit.view', 'Review operational audit events'),
  ('system_admin', 'staff.manage', 'Manage application configuration and staff access'),
  ('system_admin', 'audit.view', 'Review audit events'),
  ('system_admin', 'migration.manage', 'Operate controlled imports and cutover batches')
on conflict (role, permission) do update
set description = excluded.description;

insert into public.person_classifications (code, display_name, legacy_values) values
  ('assistant', 'Assistant', array['Assistant']),
  ('board_member', 'Board Member', array['Board Member']),
  ('community_partner', 'Community Partner', array['CommPartner']),
  ('counselor', 'Counselor', array['Counselor']),
  ('donor', 'Donor', array['Donor']),
  ('former_staff', 'Former Staff', array['Former Staff']),
  ('instructor', 'Instructor', array['Instructor']),
  ('intern', 'Intern', array['Intern']),
  ('model', 'Model', array['Model']),
  ('presenter_lecturer', 'Presenter/Lecturer', array['Presenter/Lecturer']),
  ('vendor', 'Vendor', array['Vendor']),
  ('volunteer', 'Volunteer', array['Volunteer'])
on conflict (code) do update
set display_name = excluded.display_name,
    legacy_values = excluded.legacy_values,
    updated_at = now();

create or replace function private.is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_accounts sa
    where sa.auth_user_id = (select auth.uid())
      and sa.status = 'active'
  );
$$;

create or replace function private.has_role(requested_role public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and private.is_active_staff()
    and exists (
      select 1
      from public.user_roles ur
      where ur.auth_user_id = (select auth.uid())
        and ur.role = requested_role
        and ur.revoked_at is null
    );
$$;

create or replace function private.authorize(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and private.is_active_staff()
    and exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role = ur.role
      where ur.auth_user_id = (select auth.uid())
        and ur.revoked_at is null
        and rp.permission = requested_permission
    );
$$;

create or replace function private.is_household_member(requested_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    join public.people p on p.id = hm.person_id
    where hm.household_id = requested_household_id
      and hm.status = 'active'
      and p.auth_user_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_household(requested_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    join public.people p on p.id = hm.person_id
    where hm.household_id = requested_household_id
      and hm.status = 'active'
      and (hm.can_manage_household or hm.is_primary or hm.is_guardian)
      and p.auth_user_id = (select auth.uid())
  );
$$;

create or replace function private.can_access_person(requested_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p
    where p.id = requested_person_id
      and p.auth_user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.household_members target
    join public.household_members viewer on viewer.household_id = target.household_id
    join public.people viewer_person on viewer_person.id = viewer.person_id
    where target.person_id = requested_person_id
      and target.status = 'active'
      and viewer.status = 'active'
      and viewer_person.auth_user_id = (select auth.uid())
  );
$$;

create or replace function private.can_manage_person(requested_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p
    where p.id = requested_person_id
      and p.auth_user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.household_members target
    join public.household_members viewer on viewer.household_id = target.household_id
    join public.people viewer_person on viewer_person.id = viewer.person_id
    where target.person_id = requested_person_id
      and target.status = 'active'
      and viewer.status = 'active'
      and (viewer.can_manage_household or viewer.is_primary or viewer.is_guardian)
      and viewer_person.auth_user_id = (select auth.uid())
  );
$$;

create or replace function private.is_assigned_instructor(requested_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_aal2()
    and private.is_active_staff()
    and exists (
      select 1
      from public.class_instructors ci
      join public.people p on p.id = ci.instructor_person_id
      where ci.class_id = requested_class_id
        and p.auth_user_id = (select auth.uid())
    );
$$;

revoke all on function private.is_aal2() from public;
revoke all on function private.is_active_staff() from public;
revoke all on function private.has_role(public.staff_role) from public;
revoke all on function private.authorize(text) from public;
revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.can_manage_household(uuid) from public;
revoke all on function private.can_access_person(uuid) from public;
revoke all on function private.can_manage_person(uuid) from public;
revoke all on function private.is_assigned_instructor(uuid) from public;

grant usage on schema private to authenticated;
grant execute on function private.is_aal2() to authenticated;
grant execute on function private.is_active_staff() to authenticated;
grant execute on function private.has_role(public.staff_role) to authenticated;
grant execute on function private.authorize(text) to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;
grant execute on function private.can_manage_household(uuid) to authenticated;
grant execute on function private.can_access_person(uuid) to authenticated;
grant execute on function private.can_manage_person(uuid) to authenticated;
grant execute on function private.is_assigned_instructor(uuid) to authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.write_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_before jsonb;
  row_after jsonb;
  record_id text;
begin
  if tg_op = 'INSERT' then
    row_after := to_jsonb(new);
    record_id := row_after ->> 'id';
  elsif tg_op = 'UPDATE' then
    row_before := to_jsonb(old);
    row_after := to_jsonb(new);
    record_id := coalesce(row_after ->> 'id', row_before ->> 'id');
  else
    row_before := to_jsonb(old);
    record_id := row_before ->> 'id';
  end if;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_schema,
    entity_table,
    entity_id,
    reason,
    request_id,
    before_data,
    after_data
  ) values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_schema,
    tg_table_name,
    record_id,
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(current_setting('request.id', true), ''),
    row_before,
    row_after
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Audit events are append-only';
end;
$$;

create or replace function private.validate_refund_adjustment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'reconciled' then
    raise exception 'Reconciled refunds are immutable; create a linked reversal';
  end if;

  if new.status in ('approved', 'check_issued', 'reconciled') then
    if new.approved_by is null or new.approved_at is null then
      raise exception 'Approved refund states require an approver and approval timestamp';
    end if;

    if not exists (
      select 1
      from public.staff_accounts sa
      join public.user_roles ur on ur.auth_user_id = sa.auth_user_id
      where sa.auth_user_id = new.approved_by
        and sa.status = 'active'
        and ur.role = 'finance_approver'
        and ur.revoked_at is null
    ) then
      raise exception 'Refund approver must hold the active finance_approver role';
    end if;

    if (select auth.uid()) is not null and (select auth.uid()) <> new.approved_by then
      raise exception 'The authenticated Finance approver must approve their own session action';
    end if;

    if (select auth.uid()) is not null and not private.is_aal2() then
      raise exception 'Finance approval requires an MFA-backed aal2 session';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.validate_payment_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'voided' and (tg_op = 'INSERT' or old.status is distinct from 'voided') then
    if new.voided_by is null or new.voided_at is null or new.void_reason is null then
      raise exception 'Payment voids require actor, timestamp, and reason';
    end if;

    if not exists (
      select 1
      from public.staff_accounts sa
      join public.user_roles ur on ur.auth_user_id = sa.auth_user_id
      where sa.auth_user_id = new.voided_by
        and sa.status = 'active'
        and ur.role = 'finance_approver'
        and ur.revoked_at is null
    ) then
      raise exception 'Payment void actor must hold the active finance_approver role';
    end if;

    if (select auth.uid()) is not null and ((select auth.uid()) <> new.voided_by or not private.is_aal2()) then
      raise exception 'Payment void requires the Finance approver in an MFA-backed aal2 session';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'voided' and new is distinct from old then
    raise exception 'Voided payments are immutable';
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'people', 'households', 'household_members', 'addresses', 'participant_sensitive_details',
    'person_classifications', 'staff_accounts', 'programs', 'terms', 'facilities', 'classes',
    'class_meetings', 'orders', 'order_items', 'registrations', 'waitlist_entries', 'payments',
    'refund_adjustments', 'account_credits', 'membership_plans', 'memberships', 'campaigns',
    'donations', 'events', 'content_items'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name);
  end loop;
end $$;

create trigger audit_user_roles
after insert or update or delete on public.user_roles
for each row execute function private.write_audit_event();
create trigger audit_staff_accounts
after insert or update or delete on public.staff_accounts
for each row execute function private.write_audit_event();
create trigger audit_registrations
after insert or update or delete on public.registrations
for each row execute function private.write_audit_event();
create trigger audit_orders
after insert or update or delete on public.orders
for each row execute function private.write_audit_event();
create trigger audit_payments
after insert or update or delete on public.payments
for each row execute function private.write_audit_event();
create trigger audit_refund_adjustments
after insert or update or delete on public.refund_adjustments
for each row execute function private.write_audit_event();
create trigger audit_account_credits
after insert or update or delete on public.account_credits
for each row execute function private.write_audit_event();
create trigger audit_donations
after insert or update or delete on public.donations
for each row execute function private.write_audit_event();
create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function private.prevent_audit_mutation();
create trigger validate_refund_adjustment
before insert or update on public.refund_adjustments
for each row execute function private.validate_refund_adjustment();
create trigger validate_payment_void
before insert or update on public.payments
for each row execute function private.validate_payment_void();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'people', 'households', 'household_members', 'addresses', 'participant_sensitive_details',
    'person_classifications', 'person_classification_assignments', 'staff_accounts', 'user_roles',
    'role_permissions', 'audit_events', 'programs', 'terms', 'facilities', 'classes',
    'class_instructors', 'class_meetings', 'orders', 'order_items', 'registrations',
    'waitlist_entries', 'payments', 'refund_adjustments', 'account_credits', 'credit_applications',
    'membership_plans', 'memberships', 'campaigns', 'donations', 'events', 'content_items'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
  end loop;
end $$;

alter table migration.import_batches enable row level security;
alter table migration.import_rows enable row level security;
alter table migration.reconciliation_controls enable row level security;

grant select on public.programs, public.terms, public.facilities, public.classes,
  public.class_instructors, public.class_meetings, public.events, public.content_items,
  public.person_classifications, public.membership_plans to anon, authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy public_programs_read on public.programs for select to anon, authenticated
using (status = 'published');
create policy staff_programs_manage on public.programs for all to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'))
with check (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

create policy public_terms_read on public.terms for select to anon, authenticated
using (status in ('open', 'closed'));
create policy staff_terms_manage on public.terms for all to authenticated
using (private.authorize('catalog.manage')) with check (private.authorize('catalog.manage'));

create policy public_facilities_read on public.facilities for select to anon, authenticated
using (status = 'active');
create policy staff_facilities_manage on public.facilities for all to authenticated
using (private.authorize('catalog.manage')) with check (private.authorize('catalog.manage'));

create policy public_classes_read on public.classes for select to anon, authenticated
using (status in ('published', 'open', 'waitlist', 'closed'));
create policy staff_classes_manage on public.classes for all to authenticated
using (private.authorize('catalog.manage') or private.authorize('catalog.publish'))
with check (private.authorize('catalog.manage') or private.authorize('catalog.publish'));

create policy public_class_instructors_read on public.class_instructors for select to anon, authenticated
using (exists (select 1 from public.classes c where c.id = class_id and c.status in ('published', 'open', 'waitlist', 'closed')));
create policy staff_class_instructors_manage on public.class_instructors for all to authenticated
using (private.authorize('catalog.manage')) with check (private.authorize('catalog.manage'));

create policy public_class_meetings_read on public.class_meetings for select to anon, authenticated
using (exists (select 1 from public.classes c where c.id = class_id and c.status in ('published', 'open', 'waitlist', 'closed')));
create policy staff_class_meetings_manage on public.class_meetings for all to authenticated
using (private.authorize('catalog.manage')) with check (private.authorize('catalog.manage'));

create policy people_household_read on public.people for select to authenticated
using (private.can_access_person(id) or private.authorize('people.view'));
create policy people_self_update on public.people for update to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));
create policy staff_people_manage on public.people for all to authenticated
using (private.authorize('people.manage')) with check (private.authorize('people.manage'));

create policy households_member_read on public.households for select to authenticated
using (private.is_household_member(id) or private.authorize('people.view'));
create policy households_manager_update on public.households for update to authenticated
using (private.can_manage_household(id)) with check (private.can_manage_household(id));
create policy staff_households_manage on public.households for all to authenticated
using (private.authorize('people.manage')) with check (private.authorize('people.manage'));

create policy household_members_read on public.household_members for select to authenticated
using (private.is_household_member(household_id) or private.authorize('people.view'));
create policy household_members_customer_manage on public.household_members for insert to authenticated
with check (private.can_manage_household(household_id));
create policy household_members_customer_update on public.household_members for update to authenticated
using (private.can_manage_household(household_id)) with check (private.can_manage_household(household_id));
create policy staff_household_members_manage on public.household_members for all to authenticated
using (private.authorize('people.manage')) with check (private.authorize('people.manage'));

create policy addresses_read on public.addresses for select to authenticated
using (
  (household_id is not null and private.is_household_member(household_id)) or
  (person_id is not null and private.can_access_person(person_id)) or
  private.authorize('people.view')
);
create policy addresses_customer_manage on public.addresses for all to authenticated
using (
  (household_id is not null and private.can_manage_household(household_id)) or
  (person_id is not null and private.can_manage_person(person_id))
)
with check (
  (household_id is not null and private.can_manage_household(household_id)) or
  (person_id is not null and private.can_manage_person(person_id))
);
create policy staff_addresses_manage on public.addresses for all to authenticated
using (private.authorize('people.manage')) with check (private.authorize('people.manage'));

create policy sensitive_details_read on public.participant_sensitive_details for select to authenticated
using (private.can_manage_person(person_id) or private.authorize('minors.sensitive'));
create policy sensitive_details_customer_manage on public.participant_sensitive_details for all to authenticated
using (private.can_manage_person(person_id)) with check (private.can_manage_person(person_id));
create policy sensitive_details_staff_manage on public.participant_sensitive_details for all to authenticated
using (private.authorize('minors.sensitive')) with check (private.authorize('minors.sensitive'));

create policy classifications_public_read on public.person_classifications for select to anon, authenticated
using (active);
create policy classifications_staff_manage on public.person_classifications for all to authenticated
using (private.authorize('staff.manage')) with check (private.authorize('staff.manage'));
create policy classification_assignments_read on public.person_classification_assignments for select to authenticated
using (private.can_access_person(person_id) or private.authorize('people.view'));
create policy classification_assignments_staff_manage on public.person_classification_assignments for all to authenticated
using (private.authorize('people.manage')) with check (private.authorize('people.manage'));

create policy staff_account_self_read on public.staff_accounts for select to authenticated
using (auth_user_id = (select auth.uid()) or private.authorize('staff.manage'));
create policy staff_accounts_manage on public.staff_accounts for all to authenticated
using (private.authorize('staff.manage')) with check (private.authorize('staff.manage'));
create policy user_roles_self_read on public.user_roles for select to authenticated
using (auth_user_id = (select auth.uid()) or private.authorize('staff.manage'));
create policy user_roles_manage on public.user_roles for all to authenticated
using (private.authorize('staff.manage')) with check (private.authorize('staff.manage'));
create policy role_permissions_staff_read on public.role_permissions for select to authenticated
using (private.is_aal2() and private.is_active_staff());
create policy role_permissions_admin_manage on public.role_permissions for all to authenticated
using (private.has_role('system_admin')) with check (private.has_role('system_admin'));

create policy audit_authorized_read on public.audit_events for select to authenticated
using (private.authorize('audit.view'));

create policy orders_household_read on public.orders for select to authenticated
using (private.is_household_member(household_id) or private.authorize('finance.view') or private.authorize('commerce.intake'));
create policy orders_staff_manage on public.orders for all to authenticated
using (private.authorize('commerce.intake') or private.authorize('finance.reconcile'))
with check (private.authorize('commerce.intake') or private.authorize('finance.reconcile'));

create policy order_items_read on public.order_items for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (
    private.is_household_member(o.household_id) or private.authorize('finance.view') or private.authorize('commerce.intake')
  )
));
create policy order_items_staff_manage on public.order_items for all to authenticated
using (private.authorize('commerce.intake') or private.authorize('finance.reconcile'))
with check (private.authorize('commerce.intake') or private.authorize('finance.reconcile'));

create policy registrations_household_read on public.registrations for select to authenticated
using (
  private.is_household_member(household_id) or
  private.authorize('registrations.manage') or
  private.authorize('rosters.view') or
  private.is_assigned_instructor(class_id)
);
create policy registrations_staff_manage on public.registrations for all to authenticated
using (private.authorize('registrations.manage')) with check (private.authorize('registrations.manage'));

create policy waitlists_household_read on public.waitlist_entries for select to authenticated
using (private.is_household_member(household_id) or private.authorize('registrations.manage'));
create policy waitlists_staff_manage on public.waitlist_entries for all to authenticated
using (private.authorize('registrations.manage')) with check (private.authorize('registrations.manage'));

create policy payments_household_read on public.payments for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (private.is_household_member(o.household_id) or private.authorize('finance.view'))
));
create policy payments_staff_manage on public.payments for all to authenticated
using (private.authorize('commerce.intake') or private.authorize('finance.reconcile') or private.authorize('finance.approve'))
with check (private.authorize('commerce.intake') or private.authorize('finance.reconcile') or private.authorize('finance.approve'));

create policy refunds_household_read on public.refund_adjustments for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (private.is_household_member(o.household_id) or private.authorize('finance.view'))
));
create policy refunds_finance_manage on public.refund_adjustments for all to authenticated
using (private.authorize('finance.approve')) with check (private.authorize('finance.approve'));

create policy credits_household_read on public.account_credits for select to authenticated
using (private.is_household_member(household_id) or private.authorize('finance.view') or private.authorize('registrations.manage'));
create policy credits_staff_manage on public.account_credits for all to authenticated
using (private.authorize('finance.reconcile')) with check (private.authorize('finance.reconcile'));
create policy credit_applications_read on public.credit_applications for select to authenticated
using (exists (
  select 1 from public.orders o
  where o.id = order_id and (private.is_household_member(o.household_id) or private.authorize('finance.view'))
));
create policy credit_applications_staff_manage on public.credit_applications for all to authenticated
using (private.authorize('finance.reconcile')) with check (private.authorize('finance.reconcile'));

create policy membership_plans_public_read on public.membership_plans for select to anon, authenticated
using (status = 'active');
create policy membership_plans_development_manage on public.membership_plans for all to authenticated
using (private.authorize('development.manage')) with check (private.authorize('development.manage'));
create policy memberships_owner_read on public.memberships for select to authenticated
using (
  (household_id is not null and private.is_household_member(household_id)) or
  (person_id is not null and private.can_access_person(person_id)) or
  private.authorize('development.manage') or private.authorize('finance.view')
);
create policy memberships_development_manage on public.memberships for all to authenticated
using (private.authorize('development.manage')) with check (private.authorize('development.manage'));

create policy campaigns_staff_read on public.campaigns for select to authenticated
using (private.authorize('development.manage') or private.authorize('finance.view'));
create policy campaigns_development_manage on public.campaigns for all to authenticated
using (private.authorize('development.manage')) with check (private.authorize('development.manage'));
create policy donations_owner_read on public.donations for select to authenticated
using (
  (donor_person_id is not null and private.can_access_person(donor_person_id)) or
  (donor_household_id is not null and private.is_household_member(donor_household_id)) or
  private.authorize('development.manage') or private.authorize('finance.view')
);
create policy donations_development_manage on public.donations for all to authenticated
using (private.authorize('development.manage')) with check (private.authorize('development.manage'));

create policy events_public_read on public.events for select to anon, authenticated
using (status = 'published');
create policy events_staff_manage on public.events for all to authenticated
using (private.authorize('events.manage')) with check (private.authorize('events.manage'));
create policy content_public_read on public.content_items for select to anon, authenticated
using (status = 'published');
create policy content_editors_manage on public.content_items for all to authenticated
using (private.authorize('content.edit') or private.authorize('content.publish'))
with check (private.authorize('content.edit') or private.authorize('content.publish'));

commit;
