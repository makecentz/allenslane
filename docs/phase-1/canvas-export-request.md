# Canvas Export Request

## Purpose

Request a representative, authorized export before Phase 2 finalizes the Supabase schema. A data dictionary or vendor-provided schema is preferred. If unavailable, request the CSV/Excel exports below plus referenced images/documents.

**Current decision:** a usable Canvas export cannot be obtained. This document is retained as a future acquisition checklist, not a Phase 2 blocker. No field, relationship, count, or history listed below may be assumed to exist. Canvas will remain the read-only historical source, while verified active/opening data is entered through the controlled cutover worksheet described in `data-integrations-migration.md`.

Do not send exports through ordinary email if they contain customer, minor, donor, or financial information. Use an organization-approved secure transfer location.

## Initial sample export

The first sample may be limited to:

- One completed adult semester
- One completed youth/camp week
- One currently active semester
- A small masked or authorized household sample
- Several classes representing different prices, fees, levels, schedules, capacities, and statuses
- At least one registration, transfer/drop, waitlist, membership, donation, event/ticket order, refund, credit, and payment plan

The sample must preserve stable source IDs and relationships.

## Requested files

| File/domain | Minimum fields |
|---|---|
| `people` | person ID, names, preferred name, birth date if authorized, contact details, communication preferences, account/login status, created/updated timestamps, status |
| `households` | household ID, name, primary person ID, address/contact defaults, account status, created/updated timestamps |
| `household_relationships` | household ID, person ID, relationship type, authority/guardian flags, start/end/status |
| `addresses` | address ID, owner ID/type, address fields, address type, preferred flag, validity/status |
| `staff_users_roles` | staff/person ID, authorization role/group IDs and names, status, last login, created/disabled timestamps; no password data; keep separate from person classifications |
| `person_classifications` | classification ID/code, display label, person ID, active/status, start/end dates, created/updated timestamps, source/module, and usage count |
| `instructors` | instructor ID, person ID, public biography, contact visibility, image/media reference, active status |
| `programs_categories` | IDs, names, parent relationships, type, medium, level, age group, display order, active status |
| `semesters` | semester ID, name, program type, registration dates, start/end dates, status |
| `classes` | class ID/code, semester/program/category IDs, title, description, level, ages, capacity, minimum enrollment, location, status, publish flags, pricing, fees, tax/account codes, dates, timestamps |
| `class_instructors` | class ID, instructor ID, role, order |
| `class_meetings` | meeting ID, class ID, date, start/end time, location/facility ID, canceled/skip/make-up status |
| `class_media` | class ID, media ID/path/URL, caption/alt text, display order |
| `facilities_locations` | location/facility ID, name, capacity, status, scheduling metadata |
| `registrations` | registration ID/number, class ID, participant ID, household/customer ID, registration date, status, price/discount/fee/credit/scholarship totals, order reference |
| `registration_status_history` | registration ID, old/new status, action type, reason, related registration, timestamp, staff/source ID |
| `waitlists` | waitlist ID, class ID, participant ID, household ID, added timestamp, position/status, promotion/expiration timestamps |
| `events` | event ID, title, description, dates/times, location, capacity goal, sold count, status, publish flags, virtual URL, image reference, deductible value, GL account |
| `event_ticket_tiers` | tier ID, event ID, label, price, capacity, publish/status |
| `memberships` | membership ID, household/person ID, level/plan, purchase/start/end dates, status, renewal settings, order/payment references |
| `donations_pledges` | gift/pledge ID, donor/household ID, campaign/fund, date, amount, deductible value, recurring/pledge status, notes classification, order/payment reference |
| `orders` | order ID/number, customer/household ID, date, status, subtotal, discounts, credits, scholarships, tax, total, balance, source/channel |
| `order_items` | item ID, order ID, item type/source ID, description, quantity, unit amount, fees, discounts, tax, accounting code |
| `payments` | payment ID, order/customer reference, processor reference, method category, amount, date, status, settlement/batch reference; no raw card data |
| `refunds_voids` | adjustment ID, payment/order reference, type, amount, reason, requester ID/date, Finance approver ID/date, check number, check issued date, QuickBooks reference, status, reconciliation date, timestamp |
| `account_credits_scholarships` | credit ID, household/person ID, source/type, original amount, remaining amount, expiration/status, usage references |
| `communications` | communication ID, sender/source, template/type, subject, recipient references/count, sent timestamp, delivery/logging status; content only if retention permits |
| `notes_correspondence` | note ID, owner/subject ID, department/visibility, type, author, timestamp, content if authorized |
| `financial_codes` | code ID, name, type, active dates/status, mappings used by classes/events/items |
| `audit_activity` | event ID, actor ID, action, entity/type/ID, timestamp, reason, metadata permitted for migration |

## Supporting documentation requested

- Canvas field/data dictionary
- Status and code definitions
- Role/permission definitions
- Report catalog with sample outputs
- API/webhook/import/export documentation
- Image and document export instructions
- Payment integration and token ownership documentation
- Email integration and consent/unsubscribe documentation
- Backup, retention, and contract termination/export terms
- Approximate row and attachment counts for every domain

## Legacy person classifications observed

The supplied screenshot shows these values: `Assistant`, `Board Member`, `CommPartner`, `Counselor`, `Donor`, `Donor` (duplicate), `Former Staff`, `Instructor`, `Intern`, `Model`, `Presenter/Lecturer`, `Vendor`, and `Volunteer`.

Treat these as source classifications until Canvas metadata proves otherwise; they must not automatically grant application access. The export should include stable IDs/codes, not only labels. Migration review must:

- collapse the duplicate `Donor` values only after confirming their source IDs and usage;
- map `CommPartner` to the preferred display label `Community Partner` while retaining the original code for traceability;
- prevent `Former Staff` from receiving active access by default;
- keep `Instructor` as a person/program relationship unless a separate staff authorization role is explicitly assigned; and
- report record counts per source classification before approving the mapping.

## Validation totals to request with each export

- People and household counts
- Active and inactive customer-login counts
- Classes by semester and status
- Registrations and waitlists by semester/status
- Orders, payments, refunds, credits, and outstanding balances by date/status
- Memberships by level/status
- Donations and pledges by campaign/status
- Events, ticket tiers, ticket orders, and tickets sold
- Total revenue by the same accounting groupings used by Finance

These totals become migration reconciliation controls and should be generated from the same source snapshot as the files.
