# Initial Data Retention and Backup Policy

Status: Approved implementation baseline; review annually and before production launch
Owner: Allens Lane administrator and Finance approver
Prepared: August 5, 2026

## Policy distinction

Retention controls how long business records remain available. Backups provide disaster recovery and are not a permanent archive. Deleting a record from production does not immediately remove it from existing rolling backups; it expires when the applicable backup window closes.

This is a conservative implementation policy, not legal advice. Allens Lane should have counsel, its insurer, and grant/contract owners validate youth, incident, waiver, donor, employment, and grant-specific periods before launch. A legal hold overrides scheduled deletion.

## Application retention schedule

| Record category | Initial retention rule | End-of-period action |
|---|---|---|
| Filed tax returns, exemption documents, governing documents, board minutes, annual audited/reviewed statements | Permanent | Preserve in an organization-controlled archive |
| Orders, payments, Stripe references, offline refund checks, voids, deposits, payouts, QuickBooks mappings, reconciliation, donor gifts, acknowledgements, membership purchases, credits, scholarships, and financial audit events | 7 years after the fiscal year closes | Delete or irreversibly anonymize nonessential personal fields; retain required accounting evidence |
| Adult registrations, attendance, waivers, releases, transfers, waitlists, and program participation | 7 years after the program ends | Delete or anonymize unless tied to a financial record, incident, or legal hold |
| Minor registrations, guardian consent, waivers, releases, and participation | Until the participant's 25th birthday or 7 years after the program ends, whichever is later | Delete or anonymize unless an incident, insurer rule, contract, or legal hold requires longer |
| Emergency, medical, medication, accommodation, and authorized-pickup details | Active program plus 90 days | Delete sensitive details unless needed for an incident/legal hold; preserve only the minimum proof of required consent |
| Incident and safety records | 7 years after closure; for an incident involving a minor, until age 25 or 7 years after closure, whichever is later | Review with insurer/counsel before destruction |
| Customer/household profile without a transaction or active relationship | While active plus 2 years | Anonymize/delete, except minimal identity linked to records retained under another category |
| Staff authorization history and privileged audit events | 7 years after access ends/event occurs | Delete after confirming no investigation or legal hold |
| General security, access, and application logs | 2 years | Delete automatically; preserve incident-related extracts under the incident rule |
| Transactional-email delivery metadata | 2 years | Delete; retain official correspondence under its business-record category |
| Routine transactional-email body content | 1 year | Delete unless attached to a dispute, incident, gift acknowledgement, or legal hold |
| Marketing consent and unsubscribe/suppression evidence | While subscribed; retain the minimum suppression record after opt-out | Keep only email or irreversible lookup value, status, source, and timestamps needed to prevent re-subscription without consent |
| Support requests | 3 years after closure | Delete/anonymize unless financial, safety, personnel, or legal relevance requires reclassification |
| Public content and media | While published plus 3 years | Archive or delete; retain releases according to the adult/minor rules above |

## Backup and recovery baseline

1. Use a paid Supabase production plan with managed daily database backups.
2. Create an independent encrypted logical database backup every day in organization-owned storage with a 35-day rolling retention window.
3. Back up uploaded Storage objects separately every day. Supabase database backups include Storage metadata but not the underlying uploaded objects.
4. Keep encryption keys and backup credentials outside the application database and restrict them to named administrators.
5. Produce a daily automated success/failure alert and investigate failures the same business day.
6. Test a database-and-object restore at least quarterly in an isolated environment; record date, operator, backup used, result, duration, and corrective work.
7. Use a target recovery point objective (RPO) of 24 hours and recovery time objective (RTO) of 8 hours for the initial release.
8. Before transactional registration opens, reassess whether 24 hours of possible data loss is acceptable. Enable 7-day point-in-time recovery if operations require a smaller RPO.
9. Never use backups to bypass an approved deletion or legal-hold process. Expired backup sets are deleted automatically and are not retained as shadow archives.
10. Export annual financial/audit records to the organization-controlled records archive; do not retain full annual database snapshots merely to satisfy financial retention.

## MFA and recovery controls

- Every staff account must enroll an authenticator-app/TOTP factor before receiving application access.
- Staff authorization requires an `aal2` session, enforced in the application, server API, and Row Level Security policies.
- Supabase organization-level MFA enforcement should be enabled when supported by the selected plan.
- Each organization administrator registers a separately secured backup factor. Supabase recovery and emergency-access events are logged and reviewed.
- At least two organization administrators are required before launch; Finance approval remains a separate application capability even when a person also has technical administration access.

## No-export legacy rule

Canvas is the historical system of record for data that cannot be exported. Its read-only availability is part of the retention plan. The new application stores only verified active/opening records and clearly labels manual cutover provenance. If a reliable export becomes available later, it follows a new profiling, mapping, test-import, reconciliation, and approval cycle.

## Review and legal holds

- Review this schedule every year and after a security incident, major system change, insurer change, or material legal/regulatory change.
- Finance owns financial holds; the administrator owns operational/security holds; counsel approves legal holds.
- A hold suspends deletion only for the relevant records and is itself audited.
- When a retention period expires with no hold, deletion/anonymization runs through an auditable scheduled process.

## Official implementation references

- Supabase database backups: https://supabase.com/docs/guides/platform/backups
- Supabase application MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase organization MFA enforcement: https://supabase.com/docs/guides/platform/mfa/org-mfa-enforcement
- IRS exempt-organization recordkeeping: https://www.irs.gov/charities-non-profits/eo-operational-requirements-recordkeeping-requirements-for-exempt-organizations
- IRS Form 990 recordkeeping guidance: https://www.irs.gov/instructions/i990
