# Roles and Permissions

## Authorization principles

- Start with no access and grant only what each role needs.
- Separate viewing financial information from issuing refunds, voids, discounts, or credits.
- Separate content publishing from operational administration.
- Restrict minors, household data, donor records, notes, exports, and correspondence.
- Require audit reasons for refunds, voids, merges, manual credits, role changes, and destructive actions.
- Use database-enforced Supabase Row Level Security in addition to application checks.
- Require authenticator-app MFA for every staff role and enforce an `aal2` session in application, API, and Row Level Security policies before staff data access.
- Keep customer MFA optional for launch; email verification and secure password-reset flows remain required.

## Legacy person classifications are not authorization roles

The Canvas screenshot supplied August 5 shows the labels `Assistant`, `Board Member`, `CommPartner`, `Counselor`, `Donor` (twice), `Former Staff`, `Instructor`, `Intern`, `Model`, `Presenter/Lecturer`, `Vendor`, and `Volunteer`.

These will be migrated as person classifications or relationships, not as access grants. A person may have multiple classifications and separately have zero or more application roles. In particular, `Former Staff` receives no active access by default, `Instructor` does not imply administrative access, and the duplicate `Donor` values require source-ID and usage analysis before normalization. `CommPartner` should display as `Community Partner` after mapping while preserving its legacy value for auditability.

## Proposed roles

| Role | Primary responsibilities |
|---|---|
| Public visitor | View published content, classes, events, and policies. |
| Customer | Manage own account/household, register eligible participants, join waitlists, purchase tickets/memberships, donate, and view own history. |
| Instructor | View assigned classes, schedules, rosters, approved participant details, and send approved class communications. |
| Front desk / cashier | Search customers, assist with registrations and purchases, accept authorized payments, and issue receipts. |
| Registrar / programs | Manage programs, semesters, classes, schedules, instructors, enrollment, waitlists, transfers, and rosters. |
| Events manager | Manage events, ticket levels, capacity, attendees, and event communications. |
| Content editor | Manage editorial pages, profiles, articles, images, productions, exhibitions, sponsors, and drafts. |
| Content publisher | Approve and publish public editorial and catalog content. |
| Development | Manage memberships, donors, campaigns, pledges, acknowledgements, and development reports. |
| Finance | Reconcile transactions, manage accounting mappings, view financial reports, and perform permitted adjustments. |
| Finance approver | Authorize high-risk refunds, voids, manual credits, and sensitive exports above defined thresholds. |
| Reports user | Run only the reports and exports granted to that user's department. |
| Support / operations admin | Manage staff accounts, configuration, facilities, imports, and operational support without automatic finance authority. |
| System administrator | Manage infrastructure and emergency access; use should be rare and audited. |

Gerrell Jones (`ecomexpertsllc@gmail.com`) is the initial Finance approver. Because the same person is also the technical/Supabase contact, every use of Finance-approver or emergency-administration capability must be logged and reviewed. Add a second organization administrator before production so account recovery does not depend on one person.

## Capability matrix

Legend: **M** manage, **V** view, **S** self/assigned only, **A** approval required, blank means no access.

| Capability | Customer | Instructor | Front desk | Registrar | Events | Editor | Publisher | Development | Finance | Finance approver | System admin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Own household/profile | M | S | V | V | V |  |  | V | V | V | M |
| All people/households |  |  | V | V | V |  |  | V | V | V | M |
| Internal notes |  | S | V | M | V |  |  | M | V | V | M |
| Programs/classes | V | S | V | M | V |  | V | V | V | V | M |
| Rosters | S | S | V | M |  |  |  |  |  |  | M |
| Enrollment/waitlists | S | V | M | M |  |  |  |  | V | V | M |
| Events/tickets | S |  | V | V | M |  | V | V | V | V | M |
| Editorial content | V | V | V | V | V | M | M | V | V | V | M |
| Memberships/giving | S |  | V |  |  |  |  | M | V | V | M |
| Checkout/payment intake | S |  | M | M | M |  |  | M | M | M | A |
| Discounts/manual credits |  |  | A | A | A |  |  | A | M | M | A |
| Refunds/voids |  |  |  |  |  |  |  |  |  | M |  |
| Financial reports | S |  |  | V | V |  |  | V | M | M | A |
| Sensitive exports | S | S | A | M | M |  |  | A | A | M | A |
| Staff roles/configuration |  |  |  |  |  |  |  |  |  |  | M |
| Audit log |  |  |  | V | V |  |  | V | V | M | M |

## Decisions needed

- Which staff members need more than one operational role?
- Which actions require a second approver or dollar threshold?
- Can instructors email rosters directly, or only request/send approved templates?
- Which participant fields may instructors see?
- Who can export customer, donor, and minor data?
- Who can merge duplicate people or households?
- How long should former staff access remain recoverable before deletion?
- Should customer guardians be able to invite another adult into a household?
