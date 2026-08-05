# Phase 2 — Supabase Foundation

Status: Local foundation implemented and validated; live project connection pending
Prepared: August 5, 2026

## Outcome

Phase 2 establishes the clean operational data model for `alanedb` without relying on an unavailable Canvas export. The migrations are repeatable, reset successfully from an empty local Supabase database, pass Supabase database linting, and pass executable security assertions.

The public frontend retains its established layout. Customer and staff account shells now connect to the organization-owned Supabase project, while registrations, payments, and staff operational modules remain closed until their release gates are complete.

## Implemented

- Supabase CLI project configuration for `alanedb`
- Customer email/password configuration with verified email and stronger password rules
- Authenticator-app/TOTP support for mandatory staff MFA
- People, households, guardian/management relationships, addresses, and sensitive participant details
- Legacy person classifications kept separate from authorization roles
- Staff roles, explicit permissions, active/revoked assignments, and MFA-aware authorization helpers
- Programs, terms, facilities, classes, instructors, meetings, registrations, and waitlists
- Orders, line items, Stripe payment references, credits, scholarships, offline-check refunds, and payment voids
- Memberships, campaigns, donations, events, and editorial content
- Append-only audit events for privileged and financial changes
- A non-API `migration` schema for manual cutover and any future legacy export
- Public and private Supabase Storage buckets with staff access policies
- Customer onboarding RPC that creates one retry-safe primary household
- Customer account shell plus a staff portal that requires an active staff record and TOTP-backed `aal2` session
- Initial staff bootstrap function restricted to database administration
- Manual cutover CSV templates and reconciliation controls
- Local reset, lint, and security tests

## Security baseline

- All application tables use Row Level Security.
- Customers can read only their own person/household relationships and related operational records.
- Staff-wide permissions require an active staff account, an active role assignment, and an `aal2` MFA-backed session.
- Finance approval is not inherited by system administrators.
- Only an active Finance approver may approve offline-check refunds or void payments.
- Reconciled refunds and voided payments are immutable; corrections require a linked adjustment/reversal.
- Secret/service-role credentials remain server-only.
- The `migration` schema is not exposed through the Data API.

## Files

- `supabase/config.toml` — local Auth, Storage, and database configuration
- `supabase/migrations/20260805163637_core_identity_access.sql` — identity, roles, audit, and cutover staging
- `supabase/migrations/20260805163647_programs_commerce.sql` — operational, commerce, giving, event, and content tables
- `supabase/migrations/20260805163649_security_audit_rls.sql` — permissions, triggers, RLS, MFA, audit, refunds, and voids
- `supabase/migrations/20260805163650_auth_onboarding_storage.sql` — Auth trigger, customer onboarding, first-staff bootstrap, and Storage policies
- `supabase/migrations/20260805163945_harden_privileges_and_foreign_keys.sql` — least-privilege Data API grants and foreign-key indexes
- `supabase/tests/security.sql` — executable household, MFA, Finance, and audit assertions
- `supabase/cutover-templates/` — staff-prepared manual cutover CSVs
- `architecture.md` — component and trust-boundary design
- `deployment-runbook.md` — live project creation, bootstrap, verification, and rollback sequence
- `manual-cutover-plan.md` — no-export data preparation and reconciliation workflow

## Validation completed

1. A full `supabase db reset` recreated the database and applied the four foundation migrations and seed in order.
2. `supabase db lint --level warning` returned no schema errors for the foundation schema.
3. Security assertions proved customer household isolation.
4. Security assertions proved staff-wide access is denied at `aal1` and granted only at `aal2` when the role contains the required permission.
5. Security assertions rejected a non-Finance refund approval.
6. Security assertions accepted a Finance-approver refund and payment void and confirmed financial audit events.
7. The fifth hardening migration was applied transactionally to the empty live project and verified with Supabase advisors and direct catalog checks: all public tables use RLS, anonymous grants are read-only on ten catalog/content tables, anonymous RPC execution is disabled, and all foreign keys have covering indexes.

## Live-project gate

The five migrations are deployed to the production `alanedb` project in East US (North Virginia). Do not enable customer or staff traffic until Gerrell Jones has a verified Auth account, a second organization administrator is named, Auth/SMTP settings are production-ready, and server secrets are stored through the approved host rather than committed files.
