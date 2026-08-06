# Supabase Deployment Runbook

## 1. Create the organization-owned project

- Organization: `allenslane`
- Project: `alanedb`
- Region: East US (North Virginia)
- Plan: paid production plan at minimum
- Add at least two Supabase organization administrators. Tara Harrison Turner (`tara@allenslane.org`) accepted the Administrator invitation on August 5, 2026, completing this continuity gate.
- Store the generated database password in the organization password manager; do not email or commit it.

## 2. Configure production Auth before launch

- Enable email/password sign-up.
- Require email confirmation.
- Require at least 12 characters and upper/lowercase letters plus digits.
- Completed August 5, 2026: the hosted Email provider enforces a 12-character minimum, upper/lowercase letters plus digits, and secure password changes.
- Leaked-password protection requires upgrading the current Free project to Pro or above; enable it immediately after the production-plan upgrade.
- Enable authenticator-app/TOTP enrollment and verification.
- Enforce MFA for Supabase organization members when the plan supports it.
- The application requires `aal2` for all staff authorization.
- Configure production site URL and an exact allowlist of HTTPS redirect URLs.
- Temporary production Site URL configured on August 5, 2026: `https://allens-lane-art-center-clone.ecomexperts.chatgpt.site/`.
- Temporary allowed redirects: the Site URL root, `/account?confirmed=1`, `/account?recovery=1`, and `/account?invite=1` on that host.
- Keep `http://localhost:3000/account` only for local Auth testing. Add `https://allenslane.org/account` when DNS cutover is approved, then remove the temporary host after the final domain is verified.
- During temporary-domain development, retain the current Supabase email configuration for controlled testing. Resend, custom SMTP, branded hosted templates, and email-domain DNS are deliberately deferred to the final-domain launch step in section 9.
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

Confirm all six migration versions are recorded. Verify RLS, guarded staff-access RPCs, least-privilege Data API grants, foreign-key indexes, Storage buckets, Auth settings, and exposed schemas before creating staff access.

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

Completed August 5, 2026: the verified Auth account was activated with the `system_admin` and `finance_approver` roles. TOTP enrollment remains required before protected staff access.

Gerrell enrolled application TOTP on August 5, 2026. Tara Harrison Turner accepted both the separate Supabase organization Administrator invitation for recovery and her application invitation. On the same date, Gerrell and Tara were assigned all 12 application roles as super administrators through the audited staff-access workflow. Tara must still enroll application TOTP before her staff permissions are usable. Enable dashboard-account MFA for both organization administrators.

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
- Confirm Gerrell and, after invitation acceptance and TOTP enrollment, Tara can each approve a paper-check refund at `aal2` and the audit event is written.
- Confirm uploaded media works and private documents are not public.
- Perform and document one isolated database-and-object restore before accepting live transactions.

## 8. Cutover and rollback

- Load only an approved manual cutover batch.
- Reconcile rosters/waitlists with program owners and opening balances with Finance.
- Keep Canvas writable during the agreed parallel window.
- At cutover, stop legacy writes, perform a final manual reconciliation, then mark Canvas read-only.
- If critical controls fail, stop new writes in the new platform and return operations to Canvas while preserving the failed batch and audit evidence.

## 9. Final-domain and transactional-email launch

Complete this only after the application, operational modules, and permanent public domain are approved:

- Point the permanent domain to the approved production site and add its exact Auth redirect URLs.
- Create or select the organization-owned Resend account.
- Verify the approved Allens Lane sending subdomain through Namecheap DNS without disturbing Mailchimp records.
- Configure Resend custom SMTP in Supabase and apply the branded hosted Auth templates.
- Run the delivery, invitation, confirmation, recovery, SPF, DKIM, spam-placement, and redirect checks in `transactional-email-runbook.md`.
- Remove the temporary host from Supabase Auth only after permanent-domain testing succeeds.
