# Phase 1 — Requirements and Legacy-System Audit

Status: Phase 1 baseline approved with documented implementation assumptions
Prepared: August 5, 2026

## Objective

Define what the new Allens Lane platform must do before database, authentication, payment, or migration work begins. This phase converts the public-site audit and the Art Center Canvas walkthrough into an agreed system boundary, MVP, permission model, integration inventory, and decision register.

## Evidence reviewed

- Public website and XML sitemap audit in `SITEMAP.md`
- Current frontend clone and its external Canvas links
- 24:44 Art Center Canvas administration walkthrough recorded August 4, 2026
- Canvas legacy person-classification screenshot supplied August 5, 2026
- Public class, event, membership, donation, and newsletter handoffs visible on the existing site

No customer records from the walkthrough are reproduced in these documents.

## Working system boundary

The replacement should be one product with two clearly separated surfaces:

1. **Public website** — marketing pages, program discovery, staff and instructor profiles, articles, theater, exhibitions, rentals, community programs, and published catalog content.
2. **Operations platform** — people and households, classes, registrations, waitlists, events, tickets, payments, memberships, giving, communications, reports, staff permissions, and audit history.

Supabase is the selected data platform for Phase 2 evaluation. The organization owner is **allenslane** and the intended project name is **alanedb**. It is not connected during Phase 1. The Phase 2 design should evaluate Supabase Postgres, Auth, Storage, Row Level Security, database functions, scheduled jobs, and Edge Functions against these requirements.

## Confirmed initial decisions

- Canvas will run alongside the new platform temporarily and become read-only after reconciled migration.
- Stripe will process payments.
- QuickBooks Online is the accounting system.
- Mailchimp and the external theater-ticketing provider will remain in place initially.
- Resend is the recommended transactional-email provider, subject to account and sending-domain approval.
- Namecheap manages DNS for `allenslane.org`.
- Customers will sign in with email and password; staff MFA remains the recommended production control.
- Gerrell Jones (`ecomexpertsllc@gmail.com`) is the named Finance approver and technical/Supabase contact.
- Customer refunds are issued offline by check only. Refund and void actions require the Finance approver; the application must record the adjustment and approval without automatically issuing a Stripe refund.
- Supabase production region is **East US (North Virginia)**.
- MFA is mandatory for every staff account, using an authenticator app and an administrative recovery procedure. Customer MFA is optional and is not required for launch.
- Daily backups are required. The baseline combines Supabase managed daily database backups with an independent encrypted daily backup and separate object-storage protection; retention periods are defined in `retention-backup-policy.md`.
- A Canvas export is not available. Canvas will remain the historical read-only source, while only verified active/opening records are manually entered or imported through reviewed templates. The new schema must preserve legacy identifiers and support a future adapter if an export becomes available.
- The administrator and a staff member with the Finance role will approve permissions and financial reconciliation.
- A usable Canvas export cannot be obtained. This is an accepted constraint rather than a Phase 2 blocker.

## Phase 1 deliverables

- `requirements-inventory.md` — functional and non-functional requirements
- `roles-permissions.md` — proposed staff and customer authorization model
- `data-integrations-migration.md` — source data, integrations, migration risks, and ownership
- `mvp-scope.md` — recommended releases and acceptance gates
- `decision-register.md` — questions that must be resolved before or during Phase 2
- `current-state-system-map.md` — how the public website, Canvas, customers, staff, and external services interact today
- `stakeholder-questionnaire.md` — structured questions for operational, finance, development, and technical owners
- `canvas-export-request.md` — the exact legacy exports needed for schema and migration validation
- `traceability-matrix.md` — maps requirement domains to releases, owners, evidence, and acceptance tests
- `phase-1-signoff.md` — approval checklist and provisional assumptions
- `retention-backup-policy.md` — approved baseline retention, backup, restore-test, deletion, and legal-hold rules

## Definition of Phase 1 complete

Phase 1 is complete when stakeholders have:

- Approved the new-system boundary and first release
- Identified the authoritative source for each migrated data area
- Confirmed staff roles and high-risk financial permissions
- Selected or documented the payment, email, accounting, ticketing, and support integrations
- Defined retention requirements for financial, registration, donor, and communication history
- Agreed whether Canvas will run in parallel, become read-only, or be replaced at launch
- Identified one operational owner and one technical approver for migration sign-off
