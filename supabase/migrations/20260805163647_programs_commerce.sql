begin;

create table public.programs (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.programs(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  audience text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  display_order integer not null default 0,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint programs_parent_not_self check (parent_id is null or parent_id <> id)
);

create unique index programs_legacy_identity_idx on public.programs (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create table public.terms (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_dates check (ends_on >= starts_on),
  constraint terms_registration_dates check (
    registration_closes_at is null or registration_opens_at is null or registration_closes_at >= registration_opens_at
  )
);

create table public.facilities (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  address_text text,
  capacity integer check (capacity is null or capacity >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default extensions.gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  facility_id uuid references public.facilities(id) on delete restrict,
  code text not null,
  slug text not null,
  title text not null,
  summary text,
  description text,
  level text,
  age_min numeric(4,1),
  age_max numeric(4,1),
  capacity integer not null check (capacity >= 0),
  minimum_enrollment integer not null default 0 check (minimum_enrollment >= 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  member_price numeric(12,2) check (member_price is null or member_price >= 0),
  fee numeric(12,2) not null default 0 check (fee >= 0),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text not null default 'America/New_York',
  image_path text,
  image_alt text,
  status text not null default 'draft' check (status in ('draft', 'published', 'open', 'waitlist', 'closed', 'canceled', 'completed', 'archived')),
  published_at timestamptz,
  gl_account_code text,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (term_id, code),
  unique (term_id, slug),
  constraint class_age_range check (age_max is null or age_min is null or age_max >= age_min),
  constraint class_enrollment_range check (minimum_enrollment <= capacity),
  constraint class_dates check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint class_registration_dates check (
    registration_closes_at is null or registration_opens_at is null or registration_closes_at >= registration_opens_at
  )
);

create unique index classes_legacy_identity_idx on public.classes (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index classes_public_catalog_idx on public.classes (status, term_id, program_id);
create index classes_schedule_idx on public.classes (starts_at, facility_id) where status not in ('canceled', 'archived');

create table public.class_instructors (
  class_id uuid not null references public.classes(id) on delete cascade,
  instructor_person_id uuid not null references public.people(id) on delete restrict,
  role_label text not null default 'Instructor',
  display_order integer not null default 0,
  primary key (class_id, instructor_person_id)
);

create index class_instructors_person_idx on public.class_instructors (instructor_person_id);

create table public.class_meetings (
  id uuid primary key default extensions.gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  facility_id uuid references public.facilities(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'canceled', 'makeup', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_meeting_dates check (ends_at > starts_at)
);

create index class_meetings_schedule_idx on public.class_meetings (starts_at, facility_id);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  order_number bigint generated always as identity unique,
  household_id uuid not null references public.households(id) on delete restrict,
  purchaser_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'pending', 'paid', 'partially_paid', 'canceled', 'closed')),
  source_channel text not null default 'web' check (source_channel in ('web', 'staff', 'manual_cutover')),
  currency char(3) not null default 'USD',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  credit_total numeric(12,2) not null default 0 check (credit_total >= 0),
  scholarship_total numeric(12,2) not null default 0 check (scholarship_total >= 0),
  fee_total numeric(12,2) not null default 0 check (fee_total >= 0),
  tax_total numeric(12,2) not null default 0 check (tax_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  balance_due numeric(12,2) not null default 0 check (balance_due >= 0),
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);

create unique index orders_legacy_identity_idx on public.orders (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index orders_household_idx on public.orders (household_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  item_type text not null check (item_type in ('class', 'event_ticket', 'membership', 'donation', 'fee', 'other')),
  source_id uuid,
  description text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_amount numeric(12,2) not null check (unit_amount >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  credit_amount numeric(12,2) not null default 0 check (credit_amount >= 0),
  scholarship_amount numeric(12,2) not null default 0 check (scholarship_amount >= 0),
  fee_amount numeric(12,2) not null default 0 check (fee_amount >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  gl_account_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  participant_person_id uuid not null references public.people(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  order_item_id uuid unique references public.order_items(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'registered', 'transferred', 'dropped', 'canceled', 'completed')),
  registered_at timestamptz not null default now(),
  canceled_at timestamptz,
  cancellation_reason text,
  waiver_version text,
  waiver_accepted_at timestamptz,
  waiver_accepted_by_person_id uuid references public.people(id) on delete restrict,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (class_id, participant_person_id),
  constraint registration_cancel_fields check (
    status not in ('dropped', 'canceled') or canceled_at is not null
  )
);

create unique index registrations_legacy_identity_idx on public.registrations (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index registrations_household_idx on public.registrations (household_id, registered_at desc);
create index registrations_class_roster_idx on public.registrations (class_id, status, registered_at);

create table public.waitlist_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  participant_person_id uuid not null references public.people(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete restrict,
  status text not null default 'waiting' check (status in ('waiting', 'offered', 'accepted', 'expired', 'removed')),
  joined_at timestamptz not null default now(),
  offered_at timestamptz,
  offer_expires_at timestamptz,
  resolved_at timestamptz,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, participant_person_id),
  constraint waitlist_offer_dates check (offer_expires_at is null or offered_at is null or offer_expires_at >= offered_at)
);

create unique index waitlist_legacy_identity_idx on public.waitlist_entries (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index waitlist_order_idx on public.waitlist_entries (class_id, status, joined_at, id);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null check (provider in ('stripe', 'check', 'cash', 'manual_cutover')),
  provider_payment_id text,
  amount numeric(12,2) not null check (amount > 0),
  currency char(3) not null default 'USD',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'voided', 'disputed')),
  received_at timestamptz,
  settlement_reference text,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index payment_provider_id_idx on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;
create unique index payments_legacy_identity_idx on public.payments (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);

create table public.refund_adjustments (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete restrict,
  reversal_of_id uuid references public.refund_adjustments(id) on delete restrict,
  method text not null default 'paper_check' check (method = 'paper_check'),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'check_issued', 'reconciled', 'declined', 'canceled', 'reversed')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  check_number text,
  check_issued_on date,
  quickbooks_reference text,
  reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_approval_fields check (
    (approved_at is null and approved_by is null) or
    (approved_at is not null and approved_by is not null)
  ),
  constraint refund_check_fields check (
    status not in ('check_issued', 'reconciled') or (check_number is not null and check_issued_on is not null)
  ),
  constraint refund_reconciliation_fields check (
    status <> 'reconciled' or (reconciled_at is not null and quickbooks_reference is not null)
  ),
  constraint refund_not_self_reversal check (reversal_of_id is null or reversal_of_id <> id)
);

create index refund_adjustments_order_idx on public.refund_adjustments (order_id, created_at desc);
create index refund_adjustments_status_idx on public.refund_adjustments (status, created_at);

create table public.account_credits (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete restrict,
  person_id uuid references public.people(id) on delete restrict,
  credit_type text not null check (credit_type in ('credit', 'scholarship', 'gift_certificate')),
  original_amount numeric(12,2) not null check (original_amount > 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  expires_on date,
  status text not null default 'active' check (status in ('active', 'exhausted', 'expired', 'voided')),
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint account_credit_remaining check (remaining_amount <= original_amount)
);

create table public.credit_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  credit_id uuid not null references public.account_credits(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  applied_at timestamptz not null default now(),
  applied_by uuid references auth.users(id) on delete set null
);

create index credit_applications_credit_idx on public.credit_applications (credit_id);
create index credit_applications_order_idx on public.credit_applications (order_id);

create table public.membership_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price numeric(12,2) not null check (price >= 0),
  term_months integer not null check (term_months > 0),
  household_eligible boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  plan_id uuid not null references public.membership_plans(id) on delete restrict,
  household_id uuid references public.households(id) on delete restrict,
  person_id uuid references public.people(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('pending', 'active', 'expired', 'canceled')),
  auto_renew boolean not null default false,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_owner_exactly_one check (num_nonnulls(household_id, person_id) = 1),
  constraint membership_dates check (ends_on >= starts_on)
);

create unique index memberships_legacy_identity_idx on public.memberships (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create table public.campaigns (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  fund_name text,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('draft', 'active', 'closed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.donations (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete restrict,
  donor_person_id uuid references public.people(id) on delete restrict,
  donor_household_id uuid references public.households(id) on delete restrict,
  order_item_id uuid references public.order_items(id) on delete restrict,
  gift_date date not null,
  amount numeric(12,2) not null check (amount > 0),
  deductible_amount numeric(12,2) not null check (deductible_amount >= 0 and deductible_amount <= amount),
  anonymous boolean not null default false,
  tribute_name text,
  status text not null default 'received' check (status in ('pledged', 'received', 'canceled', 'written_off')),
  acknowledgement_sent_at timestamptz,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_donor_present check (num_nonnulls(donor_person_id, donor_household_id) >= 1)
);

create unique index donations_legacy_identity_idx on public.donations (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create index donations_campaign_idx on public.donations (campaign_id, gift_date desc);
create index donations_person_idx on public.donations (donor_person_id, gift_date desc) where donor_person_id is not null;
create index donations_household_idx on public.donations (donor_household_id, gift_date desc) where donor_household_id is not null;

create table public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/New_York',
  facility_id uuid references public.facilities(id) on delete restrict,
  external_ticket_url text,
  capacity integer check (capacity is null or capacity >= 0),
  image_path text,
  image_alt text,
  status text not null default 'draft' check (status in ('draft', 'published', 'canceled', 'completed', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint event_dates check (ends_at is null or ends_at >= starts_at)
);

create table public.content_items (
  id uuid primary key default extensions.gen_random_uuid(),
  content_type text not null check (content_type in ('page', 'article', 'profile', 'production', 'exhibition', 'sponsor')),
  slug text not null,
  title text not null,
  summary text,
  body jsonb not null default '{}'::jsonb,
  hero_image_path text,
  hero_image_alt text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  unique (content_type, slug),
  constraint content_body_object check (jsonb_typeof(body) = 'object')
);

commit;
