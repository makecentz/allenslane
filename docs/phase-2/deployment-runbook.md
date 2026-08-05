# Supabase Deployment Runbook

## 1. Create the organization-owned project

- Organization: `allenslane`
- Project: `alanedb`
- Region: East US (North Virginia)
- Plan: paid production plan at minimum
- Add at least two Supabase organization administrators.
- Store the generated database password in the organization password manager; do not email or commit it.

## 2. Configure production Auth before launch

- Enable email/password sign-up.
- Require email confirmation.
- Require at least 12 characters and upper/lowercase letters plus digits.
- Enable authenticator-app/TOTP enrollment and verification.
- Enforce MFA for Supabase organization members when the plan supports it.
- The application requires `aal2` for all staff authorization.
- Configure production site URL and an exact allowlist of HTTPS redirect URLs.
- Configure Resend custom SMTP and branded verification/password-reset templates.
- Add rate limiting and bot protection before public registration opens.

## 3. Link and validate without production data

From an approved administrator workstation:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <project-reference>
npx.cmd supabase db push --dry-run
```

Review the dry-run output before applying migrations. Do not use production customer data in local development.

## 4. Apply migrations

```powershell
npx.cmd supabase db push
```

Confirm all four migration versions are recorded. Verify RLS, Storage buckets, Auth settings, and exposed schemas before creating staff access.

## 5. Bootstrap Gerrell Jones

First create and verify the Auth account for `ecomexpertsllc@gmail.com`. In the Supabase SQL editor, run:

```sql
select private.bootstrap_initial_staff(
  'ecomexpertsllc@gmail.com',
  'Gerrell',
  'Jones',
  array['system_admin', 'finance_approver']::public.staff_role[]
);
```

Gerrell must enroll TOTP before using staff data. Add a different second organization administrator for recovery; do not grant Finance approval merely because that person administers Supabase.

## 6. Configure hosted secrets

Create hosted secrets without committing their values:

- Supabase project URL
- Supabase publishable key
- Supabase server secret key
- Stripe secret key and webhook signing secret
- Resend API key and SMTP credentials
- Mailchimp integration credentials when sync is implemented
- QuickBooks Online OAuth credentials when API integration is approved
- Independent backup destination credentials and encryption key

## 7. Production verification

- Confirm anonymous visitors can read only published catalog/content.
- Confirm customer A cannot read customer B's person, household, order, registration, payment, or membership records.
- Confirm a staff user at `aal1` receives no staff-wide data access.
- Confirm the same staff user at `aal2` receives only permissions assigned to active roles.
- Confirm a system administrator cannot approve a refund without the Finance-approver role.
- Confirm Gerrell can approve a paper-check refund at `aal2` and the audit event is written.
- Confirm uploaded media works and private documents are not public.
- Perform and document one isolated database-and-object restore before accepting live transactions.

## 8. Cutover and rollback

- Load only an approved manual cutover batch.
- Reconcile rosters/waitlists with program owners and opening balances with Finance.
- Keep Canvas writable during the agreed parallel window.
- At cutover, stop legacy writes, perform a final manual reconciliation, then mark Canvas read-only.
- If critical controls fail, stop new writes in the new platform and return operations to Canvas while preserving the failed batch and audit evidence.
