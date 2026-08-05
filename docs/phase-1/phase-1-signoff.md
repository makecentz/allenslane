# Phase 1 Sign-Off

## Current status

The Phase 1 technical baseline is complete. Business sign-off remains provisional until the open ownership, workflow, and integration approvals below are confirmed; the unavailable Canvas export is an accepted constraint and no longer a blocker.

## Approved baseline and working assumptions

Unless stakeholders decide otherwise, planning will use these defaults:

1. Canvas runs in parallel through transactional Release 2 and then becomes read-only after reconciliation.
2. WordPress content is migrated into the new application; it is not retained as a second authoring system.
3. Supabase is the authoritative platform for Postgres data, Auth, Storage, and Row Level Security.
4. Stripe is the payment processor and will use hosted/tokenized components; no raw card data is stored.
5. Mailchimp remains the marketing-email platform; Resend is recommended for Supabase Auth and operational/transactional email.
6. External theater ticketing remains in place until Release 3 unless there is a business reason to replace it sooner.
7. Jira remains an external staff help desk.
8. Production uses organization-owned accounts with at least two administrators.
9. No raw payment-card data is stored or migrated.
10. Canvas production data is never copied into local development; staging uses masked or fabricated records.
11. Customers authenticate with email and password; staff MFA is mandatory.
12. Production uses Supabase East US (North Virginia).
13. Monetary refunds are issued offline by check and recorded in the application/QuickBooks Online; the application does not automatically issue Stripe refunds.
14. Every staff account requires MFA; customers may add MFA later.
15. Canvas history is not migrated without a reliable export. Canvas remains read-only, and only verified active/opening data is entered through a controlled cutover process.
16. Daily backups and the initial retention schedule in `retention-backup-policy.md` are the approved baseline.

## Approval checklist

### Scope and ownership

- [ ] Operational product owner named
- [x] Finance/reconciliation approvers named (Gerrell Jones, `ecomexpertsllc@gmail.com`; Tara Harrison Turner, `tara@allenslane.org`)
- [ ] Marketing/content approver named
- [ ] Development/membership/giving approver named
- [x] Technical/Supabase contact named (Gerrell Jones, `ecomexpertsllc@gmail.com`)
- [ ] Three-release scope approved
- [x] Canvas parallel/read-only/decommission strategy approved

### Systems and integrations

- [x] Payment processor selected (Stripe)
- [x] Accounting system identified (QuickBooks Online); reconciliation/integration process remains pending
- [ ] Transactional-email provider approved (Resend recommended)
- [x] Mailchimp retain/replace decision approved (retain initially)
- [x] Theater ticketing retain/replace decision approved (retain initially)
- [ ] Jira retain/replace decision approved

### Data and policies

- [x] Canvas export constraint accepted; Canvas remains the historical read-only source and verified active/opening records use a manual cutover worksheet
- [x] Source counts waived as a launch prerequisite; manual cutover totals and Finance/program sign-off replace unavailable export totals
- [x] Initial retention, deletion, backup, and restore-test requirements documented; annual legal/insurance review required
- [ ] Refund, transfer, cancellation, credit, and waitlist rules documented by program (offline-check refund method and Finance approval confirmed)
- [ ] Youth/camp waivers, guardian rules, emergency fields, and access restrictions documented
- [ ] Financial roles, thresholds, and approval rules approved

### Phase 2 readiness

- [x] Supabase organization ownership confirmed (`allenslane`; intended project `alanedb`)
- [x] Production region/data-residency requirements confirmed (East US/North Virginia)
- [x] Customer and staff authentication approach approved (customer email/password; mandatory staff MFA)
- [ ] Release 1 entities and workflows approved
- [ ] Acceptance and reconciliation owners agree to the traceability matrix

## Sign-off record

| Area | Approver | Decision | Date | Notes |
|---|---|---|---|---|
| Operational scope |  | Pending |  |  |
| Finance and payments |  | Pending |  |  |
| Content and publishing |  | Pending |  |  |
| Membership and development |  | Pending |  |  |
| Security and technical architecture |  | Pending |  |  |
| Data migration and reconciliation |  | Pending |  |  |
