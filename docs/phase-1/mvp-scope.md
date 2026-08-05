# MVP and Release Scope

## Recommended release strategy

Use controlled releases rather than replacing every Canvas function at once.

## Release 1 — Publishing and catalog

Purpose: replace hard-coded frontend content and make program discovery backend-driven without moving money.

Included:

- Staff authentication and limited content roles
- Marketing pages, profiles, articles, theater, exhibitions, sponsors, and media
- Programs, semesters, instructors, facilities, classes, schedules, pricing display, images, status, and publication
- Public class and event listings/detail pages
- Redirects and SEO metadata
- Read-only migration of current catalog data

Not included:

- Customer accounts
- Registration/waitlists
- Checkout or payments
- Membership or donation processing
- Full operational reporting

Acceptance gate:

- Staff can publish current classes and content without developer assistance.
- Published data matches the public catalog and no transaction is accepted by the new platform.

## Release 2 — Accounts, registration, waitlists, and payments

Purpose: move the highest-value customer journey into the new system.

Included:

- Customer email/password authentication and staff authentication with approved privileged-access controls
- People, households, guardians, children, and participant profiles
- Eligibility, capacity, enrollment, waitlists, drops, and transfers
- Cart, member pricing, fees, discounts, scholarships, credits, deposits, payment plans, checkout, receipts, and Finance-approved offline-check refunds
- Customer dashboard and registration history
- Class rosters and operational messages
- Payment webhooks and reconciliation exports
- Migration of active households, registrations, waitlists, balances, credits, and payment obligations

Acceptance gate:

- End-to-end registration, payment, offline-check refund recording/reconciliation, transfer, and waitlist promotion scenarios pass in staging.
- Financial totals reconcile with the payment processor and legacy reports.

## Release 3 — Events, membership, giving, reports, and legacy retirement

Included:

- Event inventory and ticketing, unless retained externally
- Membership purchase, renewal, benefits, and status history
- Donations, campaigns, pledges, recurring gifts, and acknowledgements
- Department reports, dashboards, exports, and activity log
- Communication templates and history
- Remaining approved historical migration
- Staff training, parallel operations, final cutover, and read-only legacy archive

Acceptance gate:

- Stakeholders sign off on migrated counts, financial reconciliation, permissions, reports, and business-continuity procedures.
- Canvas is either formally read-only or decommissioned according to contract and retention requirements.

## Explicitly out of MVP unless approved

- Native mobile applications
- Custom accounting ledger
- Learning-management features
- Complex inventory/point-of-sale beyond required sale items
- Real-time chat
- Fully custom help-desk replacement
- Advanced marketing automation
- Automated deduplication without human review
- Rebuilding external theater ticketing before a retain/replace decision

## Phase 2 entry criteria

- Release 1 scope approved
- Staff roles approved at a working level
- Supabase organization/project ownership identified
- Production region and data-residency requirements confirmed
- Customer email/password authentication approved; staff MFA decision recorded
- Payment and email systems identified, even if final providers are not selected
- At least one representative Canvas export available for schema validation
