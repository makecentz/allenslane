# Phase 2 — Supabase Foundation

Status: Live foundation deployed and validated; controlled staff-access management enabled
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
- Read-only Finance overview for authorized staff to monitor orders, payments, paper-check refunds, and reconciliation status
- Read-only People & Households directory for authorized staff, with contact search and explicit exclusion of sensitive participant details
- Audited Programs & Catalog workspace for authorized staff, with guarded program, term, facility, class, schedule, pricing, and capacity editing; publisher-only release controls; required operational reasons; and read-only enrollment/waitlist summaries
- Audited Content & Events workspace for authorized staff, with guarded draft/review editing, publisher-only publication and archiving, event management, required operational reasons, hero-media readiness, and validated HTTPS ticketing links
- Controlled Administration & Audit workspace for MFA-verified authorized staff to activate existing accounts, grant or revoke roles, change staff status, and review privileged events
- Protected staff-invitation Edge Function with verified JWT, exact-origin CORS, MFA and permission checks, Auth invitation delivery, and guarded role activation
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
- `supabase/migrations/20260805194801_staff_access_management.sql` — guarded staff-access RPCs, direct-write revocation, Finance approval checks, recovery protections, and mandatory audit reasons
- `supabase/tests/security.sql` — executable household, MFA, Finance, and audit assertions
- `supabase/cutover-templates/` — staff-prepared manual cutover CSVs
- `architecture.md` — component and trust-boundary design
- `deployment-runbook.md` — live project creation, bootstrap, verification, and rollback sequence
- `manual-cutover-plan.md` — no-export data preparation and reconciliation workflow
- `supabase/functions/invite-staff/index.ts` — protected staff invitation orchestration
- `supabase/templates/` — branded invitation, account-confirmation, and password-recovery email templates
- `transactional-email-runbook.md` — Resend, Namecheap DNS, hosted SMTP, templates, and delivery verification

## Validation completed

1. A full `supabase db reset` recreated the database and applied the four foundation migrations and seed in order.
2. `supabase db lint --level warning` returned no schema errors for the foundation schema.
3. Security assertions proved customer household isolation.
4. Security assertions proved staff-wide access is denied at `aal1` and granted only at `aal2` when the role contains the required permission.
5. Security assertions rejected a non-Finance refund approval.
6. Security assertions accepted a Finance-approver refund and payment void and confirmed financial audit events.
7. The fifth hardening migration was applied transactionally to the empty live project and verified with Supabase advisors and direct catalog checks: all public tables use RLS, anonymous grants are read-only on ten catalog/content tables, anonymous RPC execution is disabled, and all foreign keys have covering indexes.
8. The sixth staff-access migration was syntax-checked and behavior-tested in rollback-only live transactions before deployment. Verification confirmed that direct authenticated writes are revoked, anonymous RPC execution is denied, MFA-backed Staff Management is required, Finance escalation is rejected without Finance Approver authority, status changes and role changes are audited, and last-administrator recovery protections remain active.
9. The `invite-staff` Edge Function was deployed with JWT verification enabled. Verification confirmed the exact production-origin CORS preflight returns `204` and unauthenticated POST requests return `401` without executing an invitation.
10. The seventh publishing-workflow migration was behavior-tested in a rollback-only live transaction before deployment. Verification confirmed direct browser writes are revoked, editor and publisher duties are separated, Event Management is MFA-backed, and accepted content/event mutations write append-only audit records with mandatory reasons.
11. The eighth catalog-workflow migration was behavior-tested in a rollback-only live transaction before deployment. Verification confirmed direct browser writes are revoked, Catalog Managers can prepare operational records, Catalog Publishers control public program/class release, and all accepted catalog mutations write audit records with mandatory reasons.

## Live-project gate

The eight migrations are deployed to the production `alanedb` project in East US (North Virginia). Gerrell Jones and Tara Harrison Turner (`tara@allenslane.org`) each have an active staff record and all 12 application roles as super administrators. Gerrell has a confirmed Auth account and verified TOTP factor. Tara accepted her application invitation and must enroll TOTP before protected staff access becomes usable. The 24 full-access role assignments were made through the guarded staff-access function and recorded in the audit trail. Continue building and testing on the temporary domain with approved test accounts. Resend, custom SMTP, email DNS, and branded hosted templates are the final-domain launch task and do not block the remaining application modules. Do not enable public transactional traffic until that final setup is complete and server secrets are stored through the approved host rather than committed files.
