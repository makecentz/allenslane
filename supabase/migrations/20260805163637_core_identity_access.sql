begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
create schema if not exists migration;

revoke all on schema private from public, anon, authenticated;
revoke all on schema migration from public, anon, authenticated;

create type public.staff_role as enum (
  'front_desk',
  'registrar',
  'instructor',
  'events_manager',
  'content_editor',
  'content_publisher',
  'development',
  'finance',
  'finance_approver',
  'reports_user',
  'support_admin',
  'system_admin'
);

create table public.people (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  email text,
  phone text,
  birth_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'deceased', 'merged')),
  email_marketing_status text not null default 'unknown' check (email_marketing_status in ('unknown', 'subscribed', 'unsubscribed', 'suppressed')),
  email_marketing_changed_at timestamptz,
  merged_into_person_id uuid references public.people(id) on delete restrict,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint people_email_format check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint people_merge_target check (merged_into_person_id is null or merged_into_person_id <> id)
);

create index people_name_idx on public.people (lower(last_name), lower(first_name));
create index people_email_idx on public.people (lower(email)) where email is not null;
create index people_auth_user_idx on public.people (auth_user_id) where auth_user_id is not null;
create unique index people_legacy_identity_idx on public.people (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create table public.households (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  primary_person_id uuid references public.people(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'inactive', 'merged')),
  merged_into_household_id uuid references public.households(id) on delete restrict,
  legacy_source text,
  legacy_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  constraint households_merge_target check (merged_into_household_id is null or merged_into_household_id <> id)
);

create unique index households_legacy_identity_idx on public.households (legacy_source, legacy_id)
  where legacy_source is not null and legacy_id is not null;

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  relationship text not null default 'member',
  is_primary boolean not null default false,
  is_guardian boolean not null default false,
  can_manage_household boolean not null default false,
  starts_on date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, person_id),
  constraint household_member_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index household_members_person_idx on public.household_members (person_id, status);
create unique index household_one_primary_idx on public.household_members (household_id) where is_primary and status = 'active';

create table public.addresses (
  id uuid primary key default extensions.gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  address_type text not null default 'home' check (address_type in ('home', 'mailing', 'billing', 'work', 'other')),
  line1 text not null,
  line2 text,
  city text not null,
  region text not null,
  postal_code text not null,
  country_code text not null default 'US' check (char_length(country_code) = 2),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint address_owner_exactly_one check (num_nonnulls(household_id, person_id) = 1)
);

create index addresses_household_idx on public.addresses (household_id) where household_id is not null;
create index addresses_person_idx on public.addresses (person_id) where person_id is not null;

create table public.participant_sensitive_details (
  person_id uuid primary key references public.people(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  authorized_pickup jsonb not null default '[]'::jsonb,
  medical_notes text,
  medication_notes text,
  accessibility_notes text,
  expires_at timestamptz,
  legal_hold boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint authorized_pickup_is_array check (jsonb_typeof(authorized_pickup) = 'array')
);

create table public.person_classifications (
  code text primary key,
  display_name text not null,
  description text,
  active boolean not null default true,
  legacy_values text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_classification_assignments (
  person_id uuid not null references public.people(id) on delete cascade,
  classification_code text not null references public.person_classifications(code) on delete restrict,
  starts_on date,
  ends_on date,
  source text not null default 'application',
  source_reference text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  primary key (person_id, classification_code, source),
  constraint person_classification_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table public.person_classifications is 'Descriptive person relationships only. These values never grant authorization.';

create table public.staff_accounts (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid not null unique references public.people(id) on delete restrict,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'disabled')),
  mfa_required boolean not null default true check (mfa_required),
  hired_on date,
  ended_on date,
  last_reviewed_at timestamptz,
  last_reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_account_dates check (ended_on is null or hired_on is null or ended_on >= hired_on)
);

create table public.user_roles (
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  reason text not null,
  primary key (auth_user_id, role),
  constraint user_role_revoke_fields check (
    (revoked_at is null and revoked_by is null) or
    (revoked_at is not null and revoked_by is not null)
  )
);

create index user_roles_active_idx on public.user_roles (auth_user_id, role) where revoked_at is null;

create table public.role_permissions (
  role public.staff_role not null,
  permission text not null,
  description text not null,
  primary key (role, permission)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default current_user,
  action text not null,
  entity_schema text not null,
  entity_table text not null,
  entity_id text,
  reason text,
  request_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_entity_idx on public.audit_events (entity_table, entity_id, occurred_at desc);
create index audit_events_actor_idx on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_occurred_idx on public.audit_events (occurred_at desc);

create table migration.import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source_system text not null,
  source_file_name text,
  source_snapshot_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'validated', 'approved', 'applied', 'rejected', 'rolled_back')),
  prepared_by uuid references auth.users(id) on delete set null,
  verified_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  prepared_at timestamptz not null default now(),
  verified_at timestamptz,
  approved_at timestamptz,
  applied_at timestamptz,
  notes text,
  constraint import_batch_verification check ((verified_at is null) = (verified_by is null)),
  constraint import_batch_approval check ((approved_at is null) = (approved_by is null))
);

create table migration.import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references migration.import_batches(id) on delete cascade,
  domain text not null,
  source_reference text not null,
  raw_data jsonb not null,
  normalized_data jsonb,
  status text not null default 'pending' check (status in ('pending', 'valid', 'warning', 'rejected', 'applied')),
  target_table text,
  target_id uuid,
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, domain, source_reference),
  constraint import_row_raw_object check (jsonb_typeof(raw_data) = 'object'),
  constraint import_row_errors_array check (jsonb_typeof(errors) = 'array')
);

create table migration.reconciliation_controls (
  id bigint generated always as identity primary key,
  batch_id uuid not null references migration.import_batches(id) on delete cascade,
  domain text not null,
  control_name text not null,
  source_value numeric,
  target_value numeric,
  variance numeric generated always as (target_value - source_value) stored,
  status text not null default 'pending' check (status in ('pending', 'matched', 'accepted_variance', 'failed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  explanation text,
  unique (batch_id, domain, control_name),
  constraint reconciliation_review check ((reviewed_at is null) = (reviewed_by is null))
);

comment on schema migration is 'Non-API staging boundary for verified manual cutover and any future Canvas export.';

commit;
