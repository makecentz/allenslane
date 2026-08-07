# Allens L Platform

This repository contains the public Allens L website clone and the Supabase foundation for the future customer and staff operations platform.

## Current status

- Public multi-route frontend clone implemented with Vinext/Next.js, including working search, completed sitemap routes, crawler metadata, original staff portraits, responsive navigation, and a functional contact-email handoff
- ChatGPT sign-in removed; public pages open directly
- Phase 1 requirements, permissions, migration, retention, and integration decisions documented in `docs/phase-1/`
- Phase 2 Supabase schema, RLS, staff MFA enforcement, audit trail, Storage policies, manual cutover boundary, and security assertions implemented in `supabase/`
- Live `alanedb` Supabase project connected; 17 production migrations deployed and verified
- Customer email/password sign-in, sign-up, recovery, onboarding, and account shell implemented at `/account`
- Customer household profile, home-address, and participant management implemented at `/account` through guarded, audited RPCs; participant creation cannot grant guardian, manager, or primary-account privileges
- Staff sign-in, mandatory TOTP enrollment/challenge, and permission-aware portal shell implemented at `/staff`
- Read-only Finance overview implemented at `/staff/finance` for authorized `aal2` staff sessions
- Read-only People & Households directory implemented at `/staff/people` with search and data-minimization boundaries
- Audited Programs & Catalog workspace implemented at `/staff/programs` with guarded program, term, facility, class, schedule, pricing, capacity, and publication management; registration and waitlist actions remain read-only
- Public `/classes` catalog connected to RLS-filtered Supabase records with search, program filtering, responsive class cards, and an unchanged-content fallback while no published records exist
- Audited Content & Events workspace implemented at `/staff/content` with role-scoped draft editing, publisher approval, event management, operational reasons, and protected external ticketing links
- Controlled Administration, Integrations & Audit workspace implemented at `/staff/admin` for activating accounts, managing roles and staff status, reviewing audit events, and replacing encrypted API/webhook configuration through Supabase Vault
- Protected `invite-staff` Edge Function and staff invitation acceptance/password flow implemented; production Resend SMTP activation is intentionally deferred until final-domain launch
- Gerrell Jones and Tara Harrison Turner are active super administrators with all 12 application roles; Tara accepted her staff-portal invitation and must complete MFA enrollment before protected access is usable
- Public-site completion is delivered; registration operations, Finance/QuickBooks workflows, data cutover, and later operational modules continue before the deliberately deferred Stripe activation, final-domain DNS, and Resend launch work

## Local frontend

Requires Node.js 22.13 or newer.

```powershell
npm install
npm run dev
```

Validate the production build:

```powershell
npm run build
npm test
```

## Local Supabase

Requires Docker Desktop.

```powershell
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
```

Run the executable security assertions on Windows after the local stack starts:

```powershell
Get-Content -Raw supabase/tests/security.sql |
  docker exec -i supabase_db_alanedb psql -U postgres -d postgres
```

Stop the local stack:

```powershell
npm run supabase:stop
```

## Documentation

- `SITEMAP.md` — audited public-site map
- `docs/phase-1/README.md` — requirements and legacy-system audit
- `docs/phase-2/README.md` — implemented Supabase foundation
- `docs/phase-2/architecture.md` — components, data schemas, and trust boundaries
- `docs/phase-2/deployment-runbook.md` — live `alanedb` deployment and bootstrap sequence
- `docs/phase-2/manual-cutover-plan.md` — no-export cutover and reconciliation process
- `docs/phase-2/transactional-email-runbook.md` — Resend DNS, SMTP, templates, staff invitation flow, and verification checklist

## Production rules

- Production Supabase belongs to the `allenslane` organization and uses East US (North Virginia).
- Customers authenticate with verified email/password.
- Every staff account requires TOTP MFA and an `aal2` session.
- Stripe secrets, Supabase secret/service-role keys, Resend credentials, QuickBooks credentials, and backup keys are never committed or exposed to browser code.
- Canvas remains the read-only historical source; the new system accepts only verified active/opening cutover data.
- Refunds are issued offline by paper check and require an MFA-verified Finance Approver; Gerrell Jones and Tara Harrison Turner currently hold that role as super administrators.
