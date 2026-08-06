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

do $$
begin
  if has_table_privilege('authenticated', 'public.registrations', 'insert,update,delete') then
    raise exception 'Authenticated users retain direct registration writes';
  end if;
  if has_table_privilege('authenticated', 'public.waitlist_entries', 'insert,update,delete') then
    raise exception 'Authenticated users retain direct waitlist writes';
  end if;
  if has_table_privilege('anon', 'public.enrollment_desk_entries', 'select') then
    raise exception 'Anonymous users can read the enrollment desk';
  end if;
  if not has_table_privilege('authenticated', 'public.enrollment_desk_entries', 'select') then
    raise exception 'Authenticated enrollment desk access is missing';
  end if;
  if has_function_privilege('anon', 'public.manage_enrollment_record(text,uuid,text,text,integer)', 'execute') then
    raise exception 'Anonymous users can call the enrollment mutation RPC';
  end if;
end $$;

rollback;

-- Customer household and participant workflows.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'household-owner@example.test', 'not-used', now(), '{}', '{"first_name":"Household","last_name":"Owner"}', now(), now()),
  ('90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'household-outsider@example.test', 'not-used', now(), '{}', '{"first_name":"Household","last_name":"Outsider"}', now(), now());

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);

select public.complete_customer_onboarding('Household', 'Owner', null, '215-555-0100', 'Owner Household');

select public.save_customer_household(
  'Household', 'Owner', 'H.O.', '215-555-0101', 'Owner Family',
  null, '601 W Allens Lane', null, 'Philadelphia', 'PA', '19119', 'US'
);

select public.save_household_participant(
  (select hm.household_id from public.household_members hm join public.people p on p.id = hm.person_id where p.auth_user_id = '90000000-0000-4000-8000-000000000001'),
  'Young', 'Artist', 'child', null, null, (current_date - interval '10 years')::date, null, null
);

do $$
declare
  owner_household_id uuid;
begin
  select hm.household_id into owner_household_id
  from public.household_members hm
  join public.people p on p.id = hm.person_id
  where p.auth_user_id = '90000000-0000-4000-8000-000000000001';

  if not exists (select 1 from public.households where id = owner_household_id and name = 'Owner Family') then
    raise exception 'Customer household update was not stored';
  end if;
  if not exists (select 1 from public.addresses where household_id = owner_household_id and is_primary and postal_code = '19119') then
    raise exception 'Customer household address was not stored';
  end if;
  if not exists (
    select 1 from public.household_members hm
    join public.people p on p.id = hm.person_id
    where hm.household_id = owner_household_id
      and p.first_name = 'Young'
      and p.last_name = 'Artist'
      and hm.relationship = 'child'
      and not hm.is_guardian
      and not hm.can_manage_household
  ) then
    raise exception 'Household participant was not stored with safe privileges';
  end if;
  begin
    insert into public.people (first_name, last_name) values ('Direct', 'Write');
    raise exception 'Expected direct customer table write to be denied';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
select set_config(
  'test.household_id',
  (select hm.household_id::text from public.household_members hm join public.people p on p.id = hm.person_id where p.auth_user_id = '90000000-0000-4000-8000-000000000001'),
  true
);

do $$
begin
  if (select count(*) from public.audit_events where entity_table in ('people', 'households', 'household_members', 'addresses')) < 4 then
    raise exception 'Customer household audit events were not written';
  end if;
end $$;

set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"90000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

do $$
declare
  owner_household_id uuid := current_setting('test.household_id')::uuid;
begin
  begin
    perform public.save_household_participant(owner_household_id, 'Unauthorized', 'Person', 'other');
    raise exception 'Expected cross-household participant write to be denied';
  exception
    when others then
      if sqlerrm = 'Expected cross-household participant write to be denied' then
        raise;
      end if;
  end;
end $$;

rollback;

-- Customer registration holds and waitlists.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('73000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'registration-owner@example.test', 'not-used', now(), '{}', '{"first_name":"Registration","last_name":"Owner"}', now(), now()),
  ('73000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'registration-outsider@example.test', 'not-used', now(), '{}', '{"first_name":"Registration","last_name":"Outsider"}', now(), now());

insert into public.programs (id, code, name, status)
values ('70000000-0000-4000-8000-000000000001', 'TEST-REG', 'Registration Test', 'published');
insert into public.terms (
  id, code, name, starts_on, ends_on, registration_opens_at, registration_closes_at, status
) values (
  '71000000-0000-4000-8000-000000000001', 'TEST-TERM', 'Registration Test Term',
  current_date, current_date + 90, now() - interval '1 day', now() + interval '20 days', 'open'
);
insert into public.classes (
  id, program_id, term_id, code, slug, title, age_min, age_max, capacity,
  price, fee, starts_at, ends_at, status, published_at
) values (
  '72000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  'TEST-CLASS', 'test-class', 'Registration Test Class', 8, 18, 1,
  100, 5, now() + interval '30 days', now() + interval '31 days', 'open', now()
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',
  true
);
select public.complete_customer_onboarding('Registration', 'Owner', null, null, 'Registration Household');
select public.save_customer_household(
  'Registration', 'Owner', null, null, 'Registration Household',
  null, '601 W Allens Lane', null, 'Philadelphia', 'PA', '19119', 'US'
);
select public.save_household_participant(
  (select hm.household_id from public.household_members hm join public.people p on p.id = hm.person_id where p.auth_user_id = '73000000-0000-4000-8000-000000000001'),
  'First', 'Artist', 'child', null, null, (current_date - interval '10 years')::date, null, null
);
select public.save_household_participant(
  (select hm.household_id from public.household_members hm join public.people p on p.id = hm.person_id where p.auth_user_id = '73000000-0000-4000-8000-000000000001'),
  'Second', 'Artist', 'child', null, null, (current_date - interval '11 years')::date, null, null
);

do $$
declare
  first_id uuid := (select id from public.people where first_name = 'First' and last_name = 'Artist');
  second_id uuid := (select id from public.people where first_name = 'Second' and last_name = 'Artist');
  first_result jsonb;
  repeat_result jsonb;
  second_result jsonb;
begin
  first_result := public.prepare_class_registration('72000000-0000-4000-8000-000000000001', first_id);
  if first_result ->> 'action' <> 'registration_hold'
     or (first_result ->> 'total_amount')::numeric <> 105 then
    raise exception 'Expected a 105 dollar registration hold, got %', first_result;
  end if;

  repeat_result := public.prepare_class_registration('72000000-0000-4000-8000-000000000001', first_id);
  if repeat_result ->> 'hold_id' <> first_result ->> 'hold_id'
     or (select count(*) from public.registration_holds where participant_person_id = first_id and status = 'active') <> 1 then
    raise exception 'Repeated registration preparation was not idempotent';
  end if;

  second_result := public.prepare_class_registration('72000000-0000-4000-8000-000000000001', second_id);
  if second_result ->> 'action' <> 'waitlisted'
     or (second_result ->> 'position')::integer <> 1 then
    raise exception 'Expected waitlist position one, got %', second_result;
  end if;

  begin
    insert into public.registration_holds (
      class_id, participant_person_id, household_id, purchaser_person_id,
      unit_amount, fee_amount, total_amount, expires_at, created_by
    ) values (
      '72000000-0000-4000-8000-000000000001', first_id,
      (select household_id from public.household_members where person_id = first_id),
      (select id from public.people where auth_user_id = '73000000-0000-4000-8000-000000000001'),
      1, 0, 1, now() + interval '5 minutes', '73000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected direct registration hold insert to be denied';
  exception
    when insufficient_privilege then null;
  end;
end $$;

select set_config(
  'request.jwt.claims',
  '{"sub":"73000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',
  true
);

do $$
declare
  first_id uuid := (select id from public.people where first_name = 'First' and last_name = 'Artist');
begin
  begin
    perform public.prepare_class_registration('72000000-0000-4000-8000-000000000001', first_id);
    raise exception 'Expected cross-household registration preparation to be denied';
  exception
    when others then
      if sqlerrm = 'Expected cross-household registration preparation to be denied' then
        raise;
      end if;
  end;
end $$;

reset role;
do $$
begin
  if (select count(*) from public.audit_events where entity_table in ('registration_holds', 'waitlist_entries')) < 2 then
    raise exception 'Registration and waitlist audit events were not written';
  end if;
end $$;

rollback;

-- Canvas-synchronized catalog records must never enter internal checkout.
begin;

insert into public.programs (id, code, name, status)
values ('74000000-0000-4000-8000-000000000001', 'TEST-EXTERNAL', 'External Catalog Test', 'published');
insert into public.terms (id, code, name, starts_on, ends_on, status)
values ('74100000-0000-4000-8000-000000000001', 'TEST-EXTERNAL-TERM', 'External Catalog Term', current_date, current_date + 30, 'open');

do $$
begin
  begin
    insert into public.classes (
      program_id, term_id, code, slug, title, capacity, status,
      checkout_mode, external_registration_url, source_capacity_known
    ) values (
      '74000000-0000-4000-8000-000000000001',
      '74100000-0000-4000-8000-000000000001',
      'TEST-EXTERNAL-1', 'test-external-class', 'External Catalog Test', 0, 'open',
      'external', 'https://canvas.allenslane.org/classes/1', false
    );
    raise exception 'External class entered the internal registration status';
  exception
    when check_violation then null;
  end;
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

-- Stripe registration checkout permissions. Fulfillment functions stay service-only.
begin;

do $$
begin
  if has_table_privilege('anon', 'public.payment_checkout_sessions', 'select') then
    raise exception 'Anonymous users can read payment checkout sessions';
  end if;
  if not has_table_privilege('authenticated', 'public.payment_checkout_sessions', 'select') then
    raise exception 'Customers cannot read their RLS-filtered checkout sessions';
  end if;
  if has_table_privilege('authenticated', 'public.payment_checkout_sessions', 'insert,update,delete') then
    raise exception 'Authenticated users retain direct checkout-session writes';
  end if;
  if not has_function_privilege('authenticated', 'public.begin_registration_checkout(uuid)', 'execute') then
    raise exception 'Authenticated customers cannot begin registration checkout';
  end if;
  if has_function_privilege('anon', 'public.begin_registration_checkout(uuid)', 'execute') then
    raise exception 'Anonymous users can begin registration checkout';
  end if;
  if has_function_privilege('authenticated', 'public.attach_registration_checkout(uuid,text,text,timestamp with time zone,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.fail_registration_checkout(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.finalize_registration_checkout(text,text,text,bigint,text,timestamp with time zone,boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.expire_registration_checkout(text,text,boolean)', 'execute') then
    raise exception 'Authenticated users can call service-only checkout fulfillment functions';
  end if;
  if not has_function_privilege('service_role', 'public.attach_registration_checkout(uuid,text,text,timestamp with time zone,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.fail_registration_checkout(uuid,text)', 'execute')
     or not has_function_privilege('service_role', 'public.finalize_registration_checkout(text,text,text,bigint,text,timestamp with time zone,boolean)', 'execute')
     or not has_function_privilege('service_role', 'public.expire_registration_checkout(text,text,boolean)', 'execute') then
    raise exception 'Service role checkout fulfillment permissions are incomplete';
  end if;
end $$;

rollback;

\echo 'Security assertions passed.'
