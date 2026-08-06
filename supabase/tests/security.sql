\set ON_ERROR_STOP on

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'customer-a@example.test', 'not-used', now(), '{}', '{"first_name":"Customer","last_name":"A"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'customer-b@example.test', 'not-used', now(), '{}', '{"first_name":"Customer","last_name":"B"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'registrar@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Registrar"}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'finance@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Finance"}', now(), now());

insert into public.households (id, name, primary_person_id)
select '20000000-0000-4000-8000-000000000001', 'Customer A Household', id
from public.people where auth_user_id = '10000000-0000-4000-8000-000000000001';

insert into public.households (id, name, primary_person_id)
select '20000000-0000-4000-8000-000000000002', 'Customer B Household', id
from public.people where auth_user_id = '10000000-0000-4000-8000-000000000002';

insert into public.household_members (household_id, person_id, relationship, is_primary, is_guardian, can_manage_household)
select '20000000-0000-4000-8000-000000000001', id, 'self', true, true, true
from public.people where auth_user_id = '10000000-0000-4000-8000-000000000001';

insert into public.household_members (household_id, person_id, relationship, is_primary, is_guardian, can_manage_household)
select '20000000-0000-4000-8000-000000000002', id, 'self', true, true, true
from public.people where auth_user_id = '10000000-0000-4000-8000-000000000002';

insert into public.staff_accounts (auth_user_id, person_id, status)
select auth_user_id, id, 'active' from public.people
where auth_user_id in ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');

insert into public.user_roles (auth_user_id, role, reason) values
  ('10000000-0000-4000-8000-000000000003', 'registrar', 'Automated security test'),
  ('10000000-0000-4000-8000-000000000004', 'finance_approver', 'Automated security test');

insert into public.programs (id, code, name, status)
values ('30000000-0000-4000-8000-000000000001', 'TEST', 'Test Program', 'published');
insert into public.terms (id, code, name, starts_on, ends_on, status)
values ('31000000-0000-4000-8000-000000000001', 'TEST-TERM', 'Test Term', current_date, current_date + 30, 'open');
insert into public.classes (id, program_id, term_id, code, slug, title, capacity, status)
values (
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'TEST-1', 'test-class', 'Test Class', 10, 'open'
);

insert into public.orders (id, household_id, purchaser_person_id, status, total, balance_due)
select
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  id,
  'paid',
  100,
  0
from public.people where auth_user_id = '10000000-0000-4000-8000-000000000001';

insert into public.payments (id, order_id, provider, provider_payment_id, amount, status, received_at)
values (
  '41000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  'stripe', 'pi_test_only', 100, 'succeeded', now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  if (select count(*) from public.people) <> 1 then
    raise exception 'Customer household isolation failed';
  end if;
  if (select count(*) from public.orders) <> 1 then
    raise exception 'Customer order visibility failed';
  end if;
  if (select count(*) from public.audit_events) <> 0 then
    raise exception 'Customer must not read audit events';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',
  true
);

do $$
begin
  if (select count(*) from public.people) <> 1 then
    raise exception 'Staff without MFA received staff-wide access';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

do $$
begin
  if (select count(*) from public.people) <> 4 then
    raise exception 'MFA-backed registrar did not receive authorized people access';
  end if;
end $$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

do $$
begin
  begin
    insert into public.refund_adjustments (
      order_id, payment_id, amount, reason, status, approved_by, approved_at
    ) values (
      '40000000-0000-4000-8000-000000000001',
      '41000000-0000-4000-8000-000000000001',
      20, 'Unauthorized test', 'approved',
      '10000000-0000-4000-8000-000000000003', now()
    );
    raise exception 'Non-Finance approver was able to approve a refund';
  exception
    when others then
      if sqlerrm = 'Non-Finance approver was able to approve a refund' then
        raise;
      end if;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',
  true
);

insert into public.refund_adjustments (
  id, order_id, payment_id, amount, reason, status, approved_by, approved_at
) values (
  '42000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  20, 'Approved test', 'approved',
  '10000000-0000-4000-8000-000000000004', now()
);

update public.payments
set status = 'voided',
    voided_by = '10000000-0000-4000-8000-000000000004',
    voided_at = now(),
    void_reason = 'Approved automated test'
where id = '41000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.refund_adjustments
    where id = '42000000-0000-4000-8000-000000000001' and status = 'approved'
  ) then
    raise exception 'Finance-approved refund was not stored';
  end if;
  if not exists (
    select 1 from public.payments
    where id = '41000000-0000-4000-8000-000000000001' and status = 'voided'
  ) then
    raise exception 'Finance-approved payment void was not stored';
  end if;
  if (select count(*) from public.audit_events where entity_table in ('refund_adjustments', 'payments')) < 2 then
    raise exception 'Financial audit events were not written';
  end if;
end $$;

rollback;

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Admin"}', now(), now()),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'new-staff@example.test', 'not-used', now(), '{}', '{"first_name":"New","last_name":"Staff"}', now(), now());

insert into public.staff_accounts (auth_user_id, person_id, status)
select auth_user_id, id, 'active' from public.people
where auth_user_id = '50000000-0000-4000-8000-000000000001';

insert into public.user_roles (auth_user_id, role, reason)
values ('50000000-0000-4000-8000-000000000001', 'system_admin', 'Automated staff access test');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"50000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select public.activate_existing_staff(
  'new-staff@example.test',
  'registrar',
  'Approved automated staff activation'
);

do $$
begin
  if not exists (
    select 1 from public.get_staff_access_register()
    where auth_user_id = '50000000-0000-4000-8000-000000000002'
      and 'registrar' = any(active_roles)
  ) then
    raise exception 'Activated staff account was not returned in the access register';
  end if;

  begin
    perform public.manage_staff_role(
      '50000000-0000-4000-8000-000000000002',
      'finance_approver',
      true,
      'Unauthorized Finance escalation test'
    );
    raise exception 'System Administrator without Finance approval changed a Finance role';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.user_roles (auth_user_id, role, reason)
    values ('50000000-0000-4000-8000-000000000002', 'front_desk', 'Direct write bypass test');
    raise exception 'Authenticated role bypassed guarded staff role functions';
  exception
    when insufficient_privilege then null;
  end;

  if not public.set_staff_account_status(
    '50000000-0000-4000-8000-000000000002',
    'suspended',
    'Approved automated suspension test'
  ) then
    raise exception 'Staff suspension did not change the account';
  end if;

  if (select count(*) from public.audit_events where entity_table in ('staff_accounts', 'user_roles')) < 3 then
    raise exception 'Staff access audit events were not written';
  end if;
end $$;

rollback;

begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'editor@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Editor"}', now(), now()),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'publisher@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Publisher"}', now(), now()),
  ('60000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'events@example.test', 'not-used', now(), '{}', '{"first_name":"Test","last_name":"Events"}', now(), now());

insert into public.staff_accounts (auth_user_id, person_id, status)
select auth_user_id, id, 'active' from public.people
where auth_user_id in (
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000003'
);

insert into public.user_roles (auth_user_id, role, reason) values
  ('60000000-0000-4000-8000-000000000001', 'content_editor', 'Automated publishing workflow test'),
  ('60000000-0000-4000-8000-000000000002', 'content_publisher', 'Automated publishing workflow test'),
  ('60000000-0000-4000-8000-000000000003', 'events_manager', 'Automated event workflow test');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

do $$
begin
  begin
    insert into public.content_items (content_type, slug, title)
    values ('article', 'direct-write-test', 'Direct write test');
    raise exception 'Content editor bypassed the guarded publishing function';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select public.save_content_item(
  null,
  'article',
  'workflow-test',
  'Publishing workflow test',
  'Draft summary',
  '{"text":"Draft body"}'::jsonb,
  null,
  null,
  'review',
  'Submit automated draft for review'
);

do $$
declare
  target_id uuid;
begin
  select id into target_id from public.content_items where slug = 'workflow-test';
  begin
    perform public.save_content_item(
      target_id,
      'article',
      'workflow-test',
      'Publishing workflow test',
      'Draft summary',
      '{"text":"Draft body"}'::jsonb,
      null,
      null,
      'published',
      'Unauthorized automated publish attempt'
    );
    raise exception 'Content editor published without Publisher permission';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);

select public.save_content_item(
  (select id from public.content_items where slug = 'workflow-test'),
  'article',
  'workflow-test',
  'Publishing workflow test',
  'Approved summary',
  '{"text":"Approved body"}'::jsonb,
  null,
  null,
  'published',
  'Approve automated content publication'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"60000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',
  true
);

select public.save_event(
  null,
  'workflow-event',
  'Publishing workflow event',
  'Automated event summary',
  'Automated event description',
  now() + interval '7 days',
  now() + interval '7 days 2 hours',
  'America/New_York',
  null,
  'https://tickets.example.test/workflow-event',
  25,
  null,
  null,
  'published',
  'Publish automated event workflow test'
);

reset role;

do $$
begin
  if not exists (
    select 1 from public.content_items
    where slug = 'workflow-test' and status = 'published' and published_at is not null
  ) then
    raise exception 'Publisher workflow did not publish content';
  end if;

  if not exists (
    select 1 from public.events
    where slug = 'workflow-event' and status = 'published' and published_at is not null
  ) then
    raise exception 'Event workflow did not publish the event';
  end if;

  if (
    select count(*) from public.audit_events
    where entity_table in ('content_items', 'events')
      and char_length(coalesce(reason, '')) >= 10
  ) <> 3 then
    raise exception 'Content and event audit events were not written with reasons';
  end if;
end $$;

rollback;

\echo 'Security assertions passed.'
