# Data, Integrations, and Migration Audit

## Candidate source systems

| System | Likely authoritative data | Current understanding | Required follow-up |
|---|---|---|---|
| Art Center Canvas | Historical people, households, classes, registrations, waitlists, events, orders, memberships, donations, payments, notes, communications, and financial codes | No usable export is available; Canvas remains accessible as the read-only historical source after cutover | Create a staff-verified cutover worksheet for active obligations; do not claim full historical migration; preserve optional future import support |
| WordPress | Pages, articles, staff/instructor profiles, theater, exhibitions, media, SEO metadata, redirects | Public site currently indexed at `allenslane.org` | Obtain WordPress export and media library; identify unpublished/legacy content to exclude |
| Mailchimp | Newsletter subscribers, consent state, audiences/tags, campaign history | Retained initially as marketing-email source | Document consent sync and keep authentication/transactional mail on a separate sending stream/domain |
| Theater ticketing provider | Theater inventory, orders, ticket holders, refunds | Retained initially | Document provider, API/export, deep links, refund ownership, and historical data availability |
| Stripe | Customers, payment methods/tokens, PaymentIntents/Checkout Sessions, charges, disputes, payouts | Selected payment processor; customer refunds will not be issued through Stripe | Define Stripe account owner, hosted checkout strategy, webhooks, in-person needs, and reconciliation keys; never migrate raw card data or automatically call Stripe's refund operation |
| QuickBooks Online | Accounting ledger, classes/accounts, reconciliation, revenue mapping, offline refund-check entries | Selected accounting system | Define reviewed CSV/report import versus API integration, chart-of-accounts mapping, check-refund posting, close process, and ownership |
| Resend | Supabase authentication messages and application transactional email | Recommended; no existing provider | Approve account owner, verify separate sending subdomain, configure SPF/DKIM/DMARC, SMTP for Supabase Auth, API for application messages, and signed webhook processing |
| Namecheap DNS | Public DNS and email-domain authentication records for `allenslane.org` | Confirmed DNS host | Identify the person with production access and establish an approved change/rollback process for SPF, DKIM, DMARC, and application records |
| Jira Service Management | Staff help requests and webpage/report requests | External help desk shown in walkthrough | Decide retain, replace, or link only |
| Google Maps | Directions | Current public external link | Retain simple link unless map embed is required |

## Primary data domains

1. **Identity:** staff users, customers, instructors, guardians, children, roles, account status.
2. **Households:** members, relationships, addresses, shared balances, primary contact, household gifts.
3. **Catalog:** program types, categories, media, levels, semesters, classes, descriptions, images, instructors, facilities.
4. **Scheduling:** meetings, skipped dates, locations, capacity, minimum enrollment, conflicts.
5. **Participation:** registrations, attendees, waitlists, transfers, drops, attendance if retained.
6. **Commerce:** carts, orders, line items, discounts, fees, taxes, credits, scholarships, payments, refunds, disputes.
7. **Membership:** plans, purchases, terms, benefits, status history, renewals.
8. **Giving:** donors, campaigns, gifts, pledges, recurring schedules, acknowledgements, deductible values.
9. **Events:** event records, ticket tiers, inventory, ticket orders, attendance, virtual URLs.
10. **Communications:** templates, recipients, consent, delivery status, correspondence history.
11. **Editorial:** pages, articles, profiles, productions, exhibitions, sponsors, documents, SEO and redirects.
12. **Governance:** staff access, audit events, import batches, support requests, retention and deletion records.

## Migration rules

- Do not import production data directly into the final schema before a profiling export and field mapping are approved.
- Use fabricated fixtures in local development and a masked subset in staging.
- Assign a stable legacy-system ID to every imported entity for traceability and reruns.
- Make imports repeatable and idempotent; record batch ID, source, timestamp, counts, warnings, and failures.
- Preserve financial transaction history without rewriting historical totals.
- Preserve household and participant relationships before migrating registrations.
- Migrate catalog dependencies before registrations: programs → semesters → instructors/facilities → classes → people/households → registrations/waitlists → orders/payments.
- Store redirect mappings for all retained public URLs.
- Deduplicate with review queues rather than automatic destructive merges.
- Reconcile counts and totals by semester, revenue type, payment status, membership status, and campaign.

## No-export migration strategy

Because a usable Canvas export is unavailable, the first release will use a clean domain model derived from approved workflows rather than attempting to reproduce an unknown legacy schema.

1. Canvas remains authoritative for pre-cutover history and becomes read-only after reconciliation.
2. Staff manually prepare a controlled cutover worksheet containing only current/upcoming catalog records and active obligations: registrations, waitlists, balances, credits, scholarships, memberships, pledges, payment plans, and necessary people/household links.
3. Every entered/imported row includes `legacy_source`, `legacy_id` or a documented human reference, `cutover_batch_id`, verification status, verifier, and verification timestamp.
4. Finance signs off opening balances and active payment obligations; program owners sign off rosters and waitlists.
5. Customer passwords are never migrated. Customers activate the new account through an email-verification and password-creation/reset flow.
6. Historical Canvas links/references may be stored on new records, but unavailable history is not fabricated.
7. A versioned staging/import boundary remains in the schema so a later CSV/API export can be profiled, mapped, tested, and imported without redesigning production tables.
8. The launch report explicitly states which records were migrated, manually entered, left in Canvas, rejected, or unresolved.

## Supabase responsibilities proposed for Phase 2

| Supabase capability | Proposed use |
|---|---|
| Postgres | Source of truth for operational and editorial records |
| Auth | Customer and staff identity, email/password sign-in, sessions, verification, and password reset |
| Row Level Security | Household self-service and departmental staff access boundaries |
| Storage | Catalog, profile, event, exhibition, sponsor, and document media |
| Database functions/triggers | Capacity checks, waitlist ordering, totals, audit events, and safe transactional operations |
| Edge Functions/server API | Payment webhooks, transactional email, protected exports, scheduled integrations, and privileged workflows |
| Realtime | Optional admin status updates; not required for MVP |
| Scheduled jobs | Reminders, renewal notices, failed-payment follow-up, publishing, and operational alerts |

## Transactional-email recommendation

Recommend **Resend** for the first implementation:

- Configure Resend SMTP credentials in Supabase Auth for invitations, verification, magic links, and password recovery.
- Use the Resend API for registration confirmations, waitlist notices, receipts, payment failures, class reminders, membership notices, and donor acknowledgements.
- Process delivery, bounce, complaint, failure, and suppression webhooks idempotently and store the provider message ID.
- Use an authentication subdomain such as `auth.allenslane.org` and a separate transactional subdomain such as `notify.allenslane.org`; keep Mailchimp marketing reputation separate.
- Configure SPF, DKIM, and DMARC before production sending.
- Use a non-production email sandbox or restricted recipient allowlist during development.

Official references:

- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Resend domain verification: https://resend.com/docs/dashboard/domains/introduction
- Resend webhook events: https://resend.com/docs/webhooks/event-types

## Offline refund and void workflow

- A monetary refund is issued outside the application by paper check only.
- The Finance approver is the only role that may complete refunds and voids.
- The application records the original order/payment, amount, reason, request date, approval actor/date, check number, check issued date, QuickBooks reference, status, and reconciliation date.
- A requested refund progresses through explicit states such as `requested`, `approved`, `check_issued`, `reconciled`, `declined`, or `canceled`.
- The application must not invoke a Stripe refund automatically. Any exceptional processor-side correction requires a separately documented and audited process.
- Refund, void, and accounting records are immutable after reconciliation; corrections use linked reversal/adjustment entries.

## Data requested before migration design can finish

These items are no longer launch prerequisites when they cannot be exported. They remain a future-migration wish list and must never be inferred or fabricated:

- Canvas data dictionary or representative exports for every major module
- Approximate record and attachment counts
- Earliest financial and registration history that must remain available
- Duplicate-person and duplicate-household rate
- Active customer-login count
- Active registrations, waitlists, payment plans, memberships, pledges, and recurring donations at cutover
- Unapplied credits, scholarships, gift certificates, and outstanding balances
- Payment provider customer/token export capabilities
- Current email-consent source and unsubscribe process
- Current GL/account-code list and reconciliation reports
- Required legal and organizational retention periods
