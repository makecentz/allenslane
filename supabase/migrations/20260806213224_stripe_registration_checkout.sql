begin;

create table public.payment_checkout_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_hold_id uuid not null unique references public.registration_holds(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  participant_person_id uuid not null references public.people(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  purchaser_person_id uuid not null references public.people(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  checkout_url text,
  status text not null default 'creating'
    check (status in ('creating', 'open', 'completed', 'expired', 'canceled', 'failed')),
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'USD',
  livemode boolean,
  expires_at timestamptz not null,
  completed_at timestamptz,
  failure_reason text,
  last_event_id text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_checkout_completion_fields check (
    status <> 'completed' or (
      completed_at is not null
      and stripe_checkout_session_id is not null
      and stripe_payment_intent_id is not null
    )
  ),
  constraint payment_checkout_url_https check (
    checkout_url is null or checkout_url ~ '^https://checkout[.]stripe[.]com/'
  )
);

create index payment_checkout_sessions_household_idx
  on public.payment_checkout_sessions (household_id, created_at desc);
create index payment_checkout_sessions_class_status_idx
  on public.payment_checkout_sessions (class_id, status, expires_at);
create index payment_checkout_sessions_created_by_idx
  on public.payment_checkout_sessions (created_by, created_at desc);
create index payment_checkout_sessions_payment_intent_idx
  on public.payment_checkout_sessions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table private.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  object_id text,
  livemode boolean not null,
  status text not null check (status in ('processing', 'processed', 'ignored')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on private.stripe_webhook_events from public, anon, authenticated, service_role;

alter table public.payment_checkout_sessions enable row level security;
alter table public.payment_checkout_sessions force row level security;

create policy payment_checkout_sessions_household_read
on public.payment_checkout_sessions for select to authenticated
using (
  private.is_household_member(household_id)
  or private.authorize('registrations.manage')
  or private.authorize('finance.view')
);

revoke all on public.payment_checkout_sessions from public, anon, authenticated;
grant select on public.payment_checkout_sessions to authenticated;
grant select, insert, update, delete on public.payment_checkout_sessions to service_role;

create trigger set_updated_at
before update on public.payment_checkout_sessions
for each row execute function private.set_updated_at();

create trigger audit_payment_checkout_sessions
after insert or update or delete on public.payment_checkout_sessions
for each row execute function private.write_audit_event();

create or replace function public.begin_registration_checkout(p_hold_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_class_id uuid;
  hold_record record;
  class_record record;
  existing_checkout record;
  saved_checkout_id uuid;
  checkout_expires_at timestamptz := now() + interval '31 minutes';
  purchaser_email text;
  participant_name text;
  amount_cents bigint;
begin
  if current_user_id is null then
    raise exception 'Sign in before starting checkout';
  end if;
  if p_hold_id is null then
    raise exception 'Choose a registration hold';
  end if;

  select h.class_id into target_class_id
  from public.registration_holds h
  where h.id = p_hold_id;

  if target_class_id is null then
    raise exception 'Registration hold not found';
  end if;

  select c.id, c.code, c.title, c.checkout_mode, c.status, c.gl_account_code
    into class_record
  from public.classes c
  where c.id = target_class_id
  for update;

  select h.* into hold_record
  from public.registration_holds h
  where h.id = p_hold_id
  for update;

  if hold_record.id is null then
    raise exception 'Registration hold no longer exists';
  end if;
  if class_record.checkout_mode <> 'internal' then
    raise exception 'Canvas-managed classes cannot use native checkout';
  end if;
  if class_record.status not in ('open', 'waitlist') then
    raise exception 'Registration is not available for this class';
  end if;
  if hold_record.status <> 'active' or hold_record.expires_at <= now() then
    raise exception 'This registration hold has expired; prepare registration again';
  end if;
  if hold_record.created_by <> current_user_id
     or not private.can_manage_household(hold_record.household_id)
     or not exists (
       select 1 from public.people p
       where p.id = hold_record.purchaser_person_id
         and p.auth_user_id = current_user_id
         and p.status = 'active'
     ) then
    raise exception 'You cannot purchase this registration';
  end if;
  if exists (
    select 1 from public.registrations r
    where r.class_id = target_class_id
      and r.participant_person_id = hold_record.participant_person_id
      and r.status in ('pending', 'registered', 'transferred')
  ) then
    raise exception 'This participant already has an active registration';
  end if;
  if hold_record.total_amount <= 0 then
    raise exception 'Free registrations do not require Stripe Checkout';
  end if;

  select pcs.* into existing_checkout
  from public.payment_checkout_sessions pcs
  where pcs.registration_hold_id = p_hold_id
  for update;

  if existing_checkout.status = 'completed' then
    return jsonb_build_object(
      'action', 'completed',
      'checkout_id', existing_checkout.id,
      'checkout_url', null,
      'expires_at', existing_checkout.expires_at
    );
  end if;

  if existing_checkout.status = 'open'
     and existing_checkout.expires_at > now()
     and existing_checkout.checkout_url is not null then
    return jsonb_build_object(
      'action', 'checkout_ready',
      'checkout_id', existing_checkout.id,
      'checkout_url', existing_checkout.checkout_url,
      'expires_at', existing_checkout.expires_at,
      'amount_cents', round(existing_checkout.amount * 100)::bigint,
      'currency', lower(trim(existing_checkout.currency))
    );
  end if;

  perform set_config('app.audit_reason', 'Customer started Stripe registration checkout', true);

  update public.registration_holds
  set expires_at = greatest(expires_at, checkout_expires_at + interval '5 minutes'),
      updated_by = current_user_id
  where id = p_hold_id;

  if existing_checkout.id is null then
    insert into public.payment_checkout_sessions (
      registration_hold_id, class_id, participant_person_id, household_id,
      purchaser_person_id, status, amount, currency, expires_at, created_by
    ) values (
      p_hold_id, target_class_id, hold_record.participant_person_id,
      hold_record.household_id, hold_record.purchaser_person_id, 'creating',
      hold_record.total_amount, 'USD', checkout_expires_at, current_user_id
    ) returning id into saved_checkout_id;
  else
    update public.payment_checkout_sessions
    set status = 'creating',
        stripe_checkout_session_id = null,
        stripe_payment_intent_id = null,
        checkout_url = null,
        livemode = null,
        expires_at = checkout_expires_at,
        completed_at = null,
        failure_reason = null,
        last_event_id = null
    where id = existing_checkout.id
    returning id into saved_checkout_id;
  end if;

  select u.email into purchaser_email
  from auth.users u
  where u.id = current_user_id;

  select concat_ws(' ', coalesce(nullif(p.preferred_name, ''), p.first_name), p.last_name)
    into participant_name
  from public.people p
  where p.id = hold_record.participant_person_id;

  amount_cents := round(hold_record.total_amount * 100)::bigint;

  return jsonb_build_object(
    'action', 'create_checkout',
    'checkout_id', saved_checkout_id,
    'hold_id', p_hold_id,
    'class_id', target_class_id,
    'class_code', class_record.code,
    'class_title', class_record.title,
    'participant_name', participant_name,
    'customer_email', purchaser_email,
    'amount_cents', amount_cents,
    'currency', 'usd',
    'expires_at', checkout_expires_at
  );
end;
$$;

create or replace function public.attach_registration_checkout(
  p_checkout_id uuid,
  p_stripe_session_id text,
  p_checkout_url text,
  p_expires_at timestamptz,
  p_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  target_class_id uuid;
  checkout_record record;
begin
  if p_checkout_id is null
     or coalesce(p_stripe_session_id, '') !~ '^cs_(test_|live_)?[A-Za-z0-9]+'
     or coalesce(p_checkout_url, '') !~ '^https://checkout[.]stripe[.]com/' then
    raise exception 'Stripe Checkout returned invalid session details';
  end if;
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '35 minutes' then
    raise exception 'Stripe Checkout returned an invalid expiration';
  end if;

  select pcs.class_id into target_class_id
  from public.payment_checkout_sessions pcs
  where pcs.id = p_checkout_id;
  if target_class_id is null then
    raise exception 'Checkout record not found';
  end if;

  perform 1 from public.classes c where c.id = target_class_id for update;
  select pcs.* into checkout_record
  from public.payment_checkout_sessions pcs
  where pcs.id = p_checkout_id
  for update;

  if checkout_record.status not in ('creating', 'open') then
    raise exception 'Checkout can no longer be attached';
  end if;

  perform set_config('app.audit_reason', 'Stripe Checkout session attached', true);

  update public.payment_checkout_sessions
  set stripe_checkout_session_id = p_stripe_session_id,
      checkout_url = p_checkout_url,
      status = 'open',
      livemode = p_livemode,
      expires_at = p_expires_at,
      failure_reason = null
  where id = p_checkout_id;

  update public.registration_holds
  set expires_at = greatest(expires_at, p_expires_at + interval '5 minutes')
  where id = checkout_record.registration_hold_id
    and status = 'active';

  return jsonb_build_object(
    'checkout_id', p_checkout_id,
    'checkout_url', p_checkout_url,
    'expires_at', p_expires_at
  );
end;
$$;

create or replace function public.fail_registration_checkout(
  p_checkout_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('app.audit_reason', 'Stripe Checkout creation failed', true);
  update public.payment_checkout_sessions
  set status = 'failed',
      failure_reason = left(coalesce(nullif(trim(p_reason), ''), 'Stripe session creation failed'), 500)
  where id = p_checkout_id
    and status in ('creating', 'open');
end;
$$;

create or replace function public.finalize_registration_checkout(
  p_event_id text,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_total bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '10s'
as $$
declare
  target_class_id uuid;
  checkout_record record;
  event_inserted boolean;
  saved_order_id uuid;
  saved_order_item_id uuid;
  saved_registration_id uuid;
  expected_amount_cents bigint;
begin
  if char_length(trim(coalesce(p_event_id, ''))) < 5
     or coalesce(p_session_id, '') !~ '^cs_(test_|live_)?[A-Za-z0-9]+'
     or char_length(trim(coalesce(p_payment_intent_id, ''))) < 5
     or p_amount_total is null or p_amount_total <= 0
     or lower(trim(coalesce(p_currency, ''))) <> 'usd'
     or p_paid_at is null then
    raise exception 'Stripe completion payload is invalid';
  end if;

  select pcs.class_id into target_class_id
  from public.payment_checkout_sessions pcs
  where pcs.stripe_checkout_session_id = p_session_id;
  if target_class_id is null then
    raise exception 'Stripe Checkout session is not recognized';
  end if;

  perform 1 from public.classes c where c.id = target_class_id for update;

  select pcs.*, h.status as hold_status, h.expires_at as hold_expires_at,
         h.unit_amount, h.fee_amount, h.total_amount,
         c.title as class_title, c.gl_account_code
    into checkout_record
  from public.payment_checkout_sessions pcs
  join public.registration_holds h on h.id = pcs.registration_hold_id
  join public.classes c on c.id = pcs.class_id
  where pcs.stripe_checkout_session_id = p_session_id
  for update of pcs, h;

  insert into private.stripe_webhook_events (
    event_id, event_type, object_id, livemode, status
  ) values (
    trim(p_event_id), 'checkout.session.completed', p_session_id, p_livemode, 'processing'
  ) on conflict (event_id) do nothing;
  event_inserted := found;

  if not event_inserted then
    select o.id into saved_order_id
    from public.orders o
    where o.legacy_source = 'stripe_checkout'
      and o.legacy_id = p_session_id;
    return jsonb_build_object('action', 'duplicate', 'order_id', saved_order_id);
  end if;

  if checkout_record.status = 'completed' then
    update private.stripe_webhook_events
    set status = 'processed', processed_at = now()
    where event_id = p_event_id;
    select o.id into saved_order_id
    from public.orders o
    where o.legacy_source = 'stripe_checkout'
      and o.legacy_id = p_session_id;
    return jsonb_build_object('action', 'already_completed', 'order_id', saved_order_id);
  end if;

  expected_amount_cents := round(checkout_record.amount * 100)::bigint;
  if checkout_record.status not in ('creating', 'open')
     or checkout_record.livemode is distinct from p_livemode
     or expected_amount_cents <> p_amount_total
     or p_paid_at > checkout_record.expires_at + interval '5 minutes'
     or p_paid_at > checkout_record.hold_expires_at
     or checkout_record.hold_status <> 'active' then
    raise exception 'Stripe payment does not match an active registration hold';
  end if;

  if exists (
    select 1 from public.registrations r
    where r.class_id = checkout_record.class_id
      and r.participant_person_id = checkout_record.participant_person_id
      and r.status in ('pending', 'registered', 'transferred')
  ) then
    raise exception 'Participant already has an active registration';
  end if;

  perform set_config('app.audit_reason', 'Verified Stripe Checkout payment fulfilled', true);

  insert into public.orders (
    household_id, purchaser_person_id, status, source_channel, currency,
    subtotal, fee_total, total, balance_due, legacy_source, legacy_id,
    created_by, updated_by
  ) values (
    checkout_record.household_id, checkout_record.purchaser_person_id,
    'paid', 'web', 'USD', checkout_record.unit_amount,
    checkout_record.fee_amount, checkout_record.total_amount, 0,
    'stripe_checkout', p_session_id, checkout_record.created_by,
    checkout_record.created_by
  ) returning id into saved_order_id;

  insert into public.order_items (
    order_id, item_type, source_id, description, quantity, unit_amount,
    fee_amount, line_total, gl_account_code
  ) values (
    saved_order_id, 'class', checkout_record.class_id,
    checkout_record.class_title, 1, checkout_record.unit_amount,
    checkout_record.fee_amount, checkout_record.total_amount,
    checkout_record.gl_account_code
  ) returning id into saved_order_item_id;

  insert into public.registrations (
    class_id, participant_person_id, household_id, order_item_id, status,
    registered_at, created_by, updated_by
  ) values (
    checkout_record.class_id, checkout_record.participant_person_id,
    checkout_record.household_id, saved_order_item_id, 'registered',
    p_paid_at, checkout_record.created_by, checkout_record.created_by
  ) returning id into saved_registration_id;

  insert into public.payments (
    order_id, provider, provider_payment_id, amount, currency, status,
    received_at, settlement_reference, legacy_source, legacy_id, created_by
  ) values (
    saved_order_id, 'stripe', p_payment_intent_id, checkout_record.total_amount,
    'USD', 'succeeded', p_paid_at, p_session_id, 'stripe_checkout',
    p_session_id, checkout_record.created_by
  );

  update public.registration_holds
  set status = 'converted', updated_by = checkout_record.created_by
  where id = checkout_record.registration_hold_id;

  update public.payment_checkout_sessions
  set status = 'completed',
      stripe_payment_intent_id = p_payment_intent_id,
      completed_at = p_paid_at,
      last_event_id = p_event_id,
      failure_reason = null
  where id = checkout_record.id;

  update private.stripe_webhook_events
  set status = 'processed', processed_at = now()
  where event_id = p_event_id;

  return jsonb_build_object(
    'action', 'completed',
    'order_id', saved_order_id,
    'registration_id', saved_registration_id
  );
end;
$$;

create or replace function public.expire_registration_checkout(
  p_event_id text,
  p_session_id text,
  p_livemode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  target_class_id uuid;
  checkout_record record;
  event_inserted boolean;
begin
  if char_length(trim(coalesce(p_event_id, ''))) < 5
     or coalesce(p_session_id, '') !~ '^cs_(test_|live_)?[A-Za-z0-9]+' then
    raise exception 'Stripe expiration payload is invalid';
  end if;

  select pcs.class_id into target_class_id
  from public.payment_checkout_sessions pcs
  where pcs.stripe_checkout_session_id = p_session_id;
  if target_class_id is null then
    return jsonb_build_object('action', 'ignored');
  end if;

  perform 1 from public.classes c where c.id = target_class_id for update;
  select pcs.* into checkout_record
  from public.payment_checkout_sessions pcs
  where pcs.stripe_checkout_session_id = p_session_id
  for update;

  insert into private.stripe_webhook_events (
    event_id, event_type, object_id, livemode, status
  ) values (
    trim(p_event_id), 'checkout.session.expired', p_session_id, p_livemode, 'processing'
  ) on conflict (event_id) do nothing;
  event_inserted := found;

  if not event_inserted then
    return jsonb_build_object('action', 'duplicate');
  end if;
  if checkout_record.livemode is distinct from p_livemode then
    raise exception 'Stripe mode does not match the checkout record';
  end if;

  perform set_config('app.audit_reason', 'Stripe Checkout session expired', true);

  if checkout_record.status in ('creating', 'open') then
    update public.payment_checkout_sessions
    set status = 'expired', last_event_id = p_event_id
    where id = checkout_record.id;

    update public.registration_holds
    set status = 'expired'
    where id = checkout_record.registration_hold_id
      and status = 'active';
  end if;

  update private.stripe_webhook_events
  set status = 'processed', processed_at = now()
  where event_id = p_event_id;

  return jsonb_build_object('action', 'expired');
end;
$$;

revoke all on function public.begin_registration_checkout(uuid)
  from public, anon, authenticated;
grant execute on function public.begin_registration_checkout(uuid)
  to authenticated;

revoke all on function public.attach_registration_checkout(uuid, text, text, timestamptz, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.attach_registration_checkout(uuid, text, text, timestamptz, boolean)
  to service_role;

revoke all on function public.fail_registration_checkout(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.fail_registration_checkout(uuid, text)
  to service_role;

revoke all on function public.finalize_registration_checkout(text, text, text, bigint, text, timestamptz, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_registration_checkout(text, text, text, bigint, text, timestamptz, boolean)
  to service_role;

revoke all on function public.expire_registration_checkout(text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.expire_registration_checkout(text, text, boolean)
  to service_role;

commit;
