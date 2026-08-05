# Allens L Platform

This repository contains the public Allens L website clone and the Supabase foundation for the future customer and staff operations platform.

## Current status

- Public multi-route frontend clone implemented with Vinext/Next.js
- ChatGPT sign-in removed; public pages open directly
- Phase 1 requirements, permissions, migration, retention, and integration decisions documented in `docs/phase-1/`
- Phase 2 Supabase schema, RLS, staff MFA enforcement, audit trail, Storage policies, manual cutover boundary, and security assertions implemented in `supabase/`
- Live `alanedb` Supabase project connected; six production migrations deployed and verified
- Customer email/password sign-in, sign-up, recovery, onboarding, and account shell implemented at `/account`
- Staff sign-in, mandatory TOTP enrollment/challenge, and permission-aware portal shell implemented at `/staff`
- Read-only Finance overview implemented at `/staff/finance` for authorized `aal2` staff sessions
- Read-only People & Households directory implemented at `/staff/people` with search and data-minimization boundaries
- Controlled Administration & Audit workspace implemented at `/staff/admin` for activating existing accounts, granting or revoking roles, changing staff status, and reviewing audit events
- Tara Harrison Turner accepted the separate Supabase organization Administrator invitation, completing the backup-owner continuity gate
- Production Auth/Resend configuration and remaining write-capable operational modules pending

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

## Production rules

- Production Supabase belongs to the `allenslane` organization and uses East US (North Virginia).
- Customers authenticate with verified email/password.
- Every staff account requires TOTP MFA and an `aal2` session.
- Stripe secrets, Supabase secret/service-role keys, Resend credentials, QuickBooks credentials, and backup keys are never committed or exposed to browser code.
- Canvas remains the read-only historical source; the new system accepts only verified active/opening cutover data.
- Refunds are issued offline by paper check and approved by Gerrell Jones as Finance approver.
