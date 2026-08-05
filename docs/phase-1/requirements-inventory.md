# Requirements Inventory

Requirement status terms:

- **Observed** — demonstrated in the Canvas walkthrough or current website
- **Required** — recommended for the replacement MVP
- **Later** — useful after the first operational release
- **Decision** — stakeholder confirmation is still required

## Public website and publishing

| ID | Requirement | Status |
|---|---|---|
| PUB-01 | Staff can publish and unpublish standard pages without a code deployment. | Required |
| PUB-02 | Staff can manage homepage announcements, featured programs, sponsor logos, and calls to action. | Required |
| PUB-03 | Staff can manage staff profiles, instructor profiles, theater productions, exhibitions, articles, and downloadable documents. | Required |
| PUB-04 | Published classes and events appear automatically on public listings and detail pages. | Required |
| PUB-05 | Draft, scheduled, published, canceled, full, waitlist-only, and archived states display correctly. | Required |
| PUB-06 | Staff can preview catalog changes before publication. | Observed |
| PUB-07 | Historical productions, exhibitions, articles, and past programs remain searchable and do not compete with current content. | Required |
| PUB-08 | Public pages retain stable URLs and redirects from replaced WordPress and Canvas URLs. | Required |
| PUB-09 | Site search covers public editorial content, classes, instructors, events, productions, and exhibitions. | Later |

## People, households, and customer accounts

| ID | Requirement | Status |
|---|---|---|
| PEO-01 | Store an individual separately from a household/account. | Required |
| PEO-02 | Support parent, guardian, child, spouse/partner, donor, participant, instructor, and staff relationships. | Required |
| PEO-03 | Store names, preferred name, contact details, addresses, date of birth, communication preferences, and internal notes. | Observed |
| PEO-04 | Allow multiple addresses and a preferred phone/address. | Observed |
| PEO-05 | Track release/waiver status, accessibility information, and emergency contacts where relevant. | Required |
| PEO-06 | Customers can activate an account, reset credentials, and manage their household. | Observed |
| PEO-07 | Staff can search, create, merge, and update people while preventing accidental duplicates. | Required |
| PEO-08 | Customer profiles show registrations, purchases, tickets, giving, memberships, notes, and correspondence. | Observed |
| PEO-09 | Access to minors, financial history, internal notes, and donor records is permission-restricted. | Required |
| PEO-10 | Customers authenticate through Supabase using email and password, including verification and password-reset flows. | Confirmed |

## Programs, classes, semesters, and scheduling

| ID | Requirement | Status |
|---|---|---|
| CLS-01 | Manage program types, categories, media, levels, keywords, and age groups. | Observed |
| CLS-02 | Manage semesters/sessions and unique class codes. | Observed |
| CLS-03 | Create, copy, edit, cancel, archive, and publish classes. | Observed |
| CLS-04 | Assign one or more instructors. | Observed |
| CLS-05 | Store catalog title, rich description, images, supply information, policies, and optional supply URL. | Observed |
| CLS-06 | Configure member/non-member tuition, per-diem pricing, fees, deposits, payment counts, promo codes, tax treatment, and accounting codes. | Observed |
| CLS-07 | Store minimum/maximum age, prerequisites, capacity, registration dates, and access groups. | Required |
| CLS-08 | Configure multiple meeting dates/times, locations, skipped dates, and schedule exceptions. | Observed |
| CLS-09 | Prevent instructor, room, and facility conflicts. | Required |
| CLS-10 | Track enrolled count, waitlist count, committed instructional hours, minimum enrollment, and class status. | Observed |
| CLS-11 | Produce rosters and exports and allow class-specific email communication. | Observed |
| CLS-12 | Public class details show status, image, category, code, instructor, schedule, location, level, ages, price, fees, description, and registration action. | Observed |

## Registration and waitlists

| ID | Requirement | Status |
|---|---|---|
| REG-01 | Register an eligible household participant into an available class. | Required |
| REG-02 | Enforce capacity, age, registration window, access-group, and prerequisite rules. | Required |
| REG-03 | Join and manage ordered waitlists with timestamp and contact details. | Observed |
| REG-04 | Promote a waitlisted participant without overselling capacity. | Required |
| REG-05 | Staff can drop, transfer, and reassign registrations with an audit trail. | Observed |
| REG-06 | Preserve complete registration history and allow printable/exportable records. | Observed |
| REG-07 | Support scholarships, account credits, member pricing, discounts, deposits, and payment plans. | Required |
| REG-08 | Define cancellation, refund, credit, and transfer policies for each program type. | Decision |
| REG-09 | Send registration, waitlist, promotion, transfer, cancellation, and reminder messages. | Required |

## Events and ticketing

| ID | Requirement | Status |
|---|---|---|
| EVT-01 | Create, edit, copy, publish, cancel, and archive events. | Observed |
| EVT-02 | Store event copy, schedule, venue, image, capacity goal, tickets sold, display group, and relationships to other records. | Observed |
| EVT-03 | Configure multiple ticket levels, prices, labels, and individual publish controls. | Observed |
| EVT-04 | Support virtual attendance and external event URLs. | Observed |
| EVT-05 | Store deductible cost and general-ledger assignment where applicable. | Observed |
| EVT-06 | Decide whether theater ticketing remains external or moves into the new platform. | Decision |
| EVT-07 | Prevent ticket overselling and preserve ticket purchase history. | Required |

## Cart, orders, and payments

| ID | Requirement | Status |
|---|---|---|
| PAY-01 | One cart can contain tuition, fees, memberships, donations, pledges, tickets, and other sale items. | Observed |
| PAY-02 | Calculate item totals, tax, discounts, credits, scholarships, and total due consistently. | Observed |
| PAY-03 | Support online customer checkout and authorized staff-assisted checkout. | Required |
| PAY-04 | Record payment, offline-check refund, void, failure, and scheduled-payment activity in an immutable audit trail. | Required |
| PAY-05 | Restrict refund and void completion to the Finance approver; separately authorize discounts and manual credits. | Confirmed |
| PAY-06 | Send receipts and failure/retry notifications. | Required |
| PAY-07 | Avoid storing raw card data; use the selected payment provider's hosted/tokenized components. | Required |
| PAY-08 | Use Stripe for payment processing, but issue customer refunds offline by check; reconcile the adjustment and check in QuickBooks Online without an automatic Stripe refund call. | Confirmed |
| PAY-09 | Map revenue, fees, discounts, donations, memberships, and tax to finance/accounting codes. | Observed |

## Membership and giving

| ID | Requirement | Status |
|---|---|---|
| MEM-01 | Manage individual and household membership levels, terms, benefits, status, and renewal dates. | Required |
| MEM-02 | Support purchase, renewal, upgrade, downgrade, cancellation, and administrative status changes. | Observed |
| MEM-03 | Apply membership pricing only when eligibility is active and valid. | Required |
| GIV-01 | Record one-time and recurring donations, pledges, campaigns, gift dates, donor/household attribution, notes, and deductible values. | Observed |
| GIV-02 | Support tribute/memorial gifts and donor acknowledgement requirements. | Decision |
| GIV-03 | Generate donor receipts and preserve giving history. | Required |
| GIV-04 | Restrict donor details and development notes to approved staff. | Required |

## Communications

| ID | Requirement | Status |
|---|---|---|
| COM-01 | Send messages to class rosters, waitlists, event attendees, members, donors, and filtered lists. | Observed |
| COM-02 | Support templates and one-off messages with subject, from identity, optional BCC, and merge fields. | Observed |
| COM-03 | Log the full message, a note, or no customer-visible content according to policy. | Observed |
| COM-04 | Record delivery status, bounce/failure information, and opt-out state. | Required |
| COM-05 | Separate operational messages from marketing consent and newsletter subscriptions. | Required |
| COM-06 | Decide whether Mailchimp remains the marketing-email system. | Decision |

## Reporting, administration, and support

| ID | Requirement | Status |
|---|---|---|
| REP-01 | Provide registration, attendance/roster, sales, transaction, financial, development, exhibition, and membership reports. | Observed |
| REP-02 | Filter by year, semester, date, program, class, event, instructor, status, and financial code. | Required |
| REP-03 | Export permitted results to CSV/Excel and generate printable views. | Observed |
| REP-04 | Dashboard flags under-enrolled classes, scheduled payments, payment failures, and other actionable exceptions. | Observed |
| ADM-01 | Every privileged create/update/delete/refund/void/export action is attributed to a staff user. | Required |
| ADM-02 | Maintain an activity log with timestamps, affected record, before/after data where appropriate, and reason. | Observed |
| ADM-03 | Administrative tables support search, filters, sorting, pagination, and saved views. | Required |
| SUP-01 | Staff can reach a help center and submit questions, incidents, webpage changes, and report requests. | Observed |
| SUP-02 | Decide whether Jira Service Management remains the support platform. | Decision |

## Non-functional requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-01 | Public pages meet WCAG 2.2 AA expectations. | Required |
| NFR-02 | Customer and admin flows are usable on current desktop, tablet, and mobile browsers. | Required |
| NFR-03 | Sensitive and financial data is encrypted in transit and at rest. | Required |
| NFR-04 | Supabase Row Level Security is enabled for exposed tables; service-role access remains server-only. | Required |
| NFR-05 | Run managed and independent encrypted daily backups, protect Storage objects separately, retain independent daily sets for 35 days, and test restores quarterly under `retention-backup-policy.md`. | Confirmed |
| NFR-06 | Production, staging, and local development use separate data and credentials. | Required |
| NFR-07 | Payment and registration mutations are idempotent and safe against duplicate submissions. | Required |
| NFR-08 | Inventory/capacity updates are transactional to prevent overselling. | Required |
| NFR-09 | Personally identifiable information is minimized in logs, exports, and development fixtures. | Required |
| NFR-10 | Critical operational actions have monitoring and error alerts. | Required |
| NFR-11 | Require authenticator-app MFA and an `aal2` session for every staff account; customer MFA is optional. | Confirmed |
