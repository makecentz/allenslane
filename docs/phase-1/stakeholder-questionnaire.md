# Stakeholder Questionnaire

Use this document during short interviews with the operational owners. Answers should describe what staff actually do, including exceptions—not only the documented policy.

## Ownership and launch

| Question | Answer | Owner |
|---|---|---|
| Who is the operational product owner with authority to approve workflows? |  |  |
| Who approves financial totals and reconciliation? | Gerrell Jones (`ecomexpertsllc@gmail.com`) | Finance |
| Who owns the Supabase organization and production project? | `allenslane`; intended project name `alanedb` | Allens Lane administrator |
| Who can authorize access to Canvas exports and payment-provider data? | Gerrell Jones (`ecomexpertsllc@gmail.com`) is the technical/Supabase contact; data authorization scope still to confirm | Administrator/technical owner |
| Is there a required launch date or semester boundary? |  |  |
| How long can Canvas and the new system run in parallel? | Yes, temporarily; exact cutover window pending | Operational owner |
| Must Canvas remain accessible as a read-only archive? For how long? | Yes; retain read-only access until every relevant legacy record has passed the approved retention period or a later verified export is archived | Operational/technical owners |

## Programs, classes, and camp

| Question | Answer | Owner |
|---|---|---|
| Which program types have different registration or refund rules? |  |  |
| How are class codes generated, and may they ever change? |  |  |
| What makes someone eligible for a class besides age and capacity? |  |  |
| Can a class have multiple instructors, rooms, or meeting patterns? |  |  |
| How are closures, holidays, make-up dates, and instructor substitutions handled? |  |  |
| What is the exact waitlist-promotion process and response deadline? |  |  |
| What information must instructors see on a roster? |  |  |
| Is attendance tracked now or required later? |  |  |
| Which releases, waivers, medical, accessibility, and emergency fields are required for camp/youth? |  |  |
| Who may override capacity, eligibility, price, or registration dates? |  |  |

## Customers and households

| Question | Answer | Owner |
|---|---|---|
| What defines a household, and can a person belong to more than one? |  |  |
| Who may add or remove another adult/guardian? |  |  |
| How are divorced/separated guardians and restricted access handled? |  |  |
| Which fields are required for adults, minors, donors, members, and instructors? |  |  |
| How are duplicate people and households currently resolved? |  |  |
| May customers update their own legal name, date of birth, or household relationships? |  |  |
| Which notes are private to staff or departments? |  |  |
| Which communication preferences and consent records must be retained? |  |  |

## Pricing, payment, and finance

| Question | Answer | Owner |
|---|---|---|
| Which payment processor and merchant account are used? | Stripe selected; account ownership/configuration pending | Administrator + Finance |
| Are saved payment methods, ACH, cash, checks, or in-person terminals required? |  |  |
| How are deposits and payment plans scheduled and retried? |  |  |
| What are the refund, cancellation, transfer, and credit rules by program? | Monetary refunds are issued offline by check only; remaining rules vary by program and are pending | Finance + programs |
| Who may issue refunds, voids, discounts, scholarships, or manual credits? | Finance approver performs refunds and voids; other actions remain pending | Finance |
| Are approval thresholds or two-person approval required? |  |  |
| How are chargebacks and failed payments handled? |  |  |
| Which accounting system is used, and what export/import format does it require? | QuickBooks Online; reviewed export/import versus API workflow pending | Finance |
| Which GL/account codes must be preserved? |  |  |
| How are daily and monthly totals reconciled? |  |  |
| Are gift certificates, merchandise, rentals, or point-of-sale items in scope? |  |  |

## Membership and development

| Question | Answer | Owner |
|---|---|---|
| What membership levels, terms, household rules, and benefits exist? |  |  |
| When does member pricing become active and expire? |  |  |
| Are memberships automatically renewed? |  |  |
| Which donation types, campaigns, funds, appeals, and pledges are active? |  |  |
| Are recurring gifts processed in Canvas or the payment provider? |  |  |
| Are tribute, memorial, anonymous, restricted, or household gifts required? |  |  |
| What must appear on tax acknowledgements and receipts? |  |  |
| Which donor data and notes are restricted to Development? |  |  |

## Events, theater, and exhibitions

| Question | Answer | Owner |
|---|---|---|
| Which events are ticketed in Canvas versus external ticketing? |  |  |
| Should theater ticketing remain external for the first release? | Yes | Theater/operational owner |
| What ticket tiers, capacity, comps, discounts, and refund rules are required? |  |  |
| Are assigned seats, ticket scanning, or attendance check-in required? |  |  |
| Which event/exhibition data must be represented in financial and development reports? |  |  |

## Communications, reports, and support

| Question | Answer | Owner |
|---|---|---|
| Which system currently sends transactional messages? | No provider currently; Resend recommended | Technical/operational owner |
| Should Mailchimp remain the marketing-email source of truth? | Yes, initially | Marketing owner |
| Which messages are legally or operationally required? |  |  |
| Who may email class rosters, donors, members, or event attendees? |  |  |
| Which reports are used weekly, monthly, seasonally, and annually? |  |  |
| Which exports include sensitive information, and who receives them? |  |  |
| Which dashboards or alerts lead to immediate staff action? |  |  |
| Should Jira Service Management remain the staff help desk? |  |  |

## Security and retention

| Question | Answer | Owner |
|---|---|---|
| How will customers sign in? | Email and password | Technical owner |
| Which Supabase production region should be used? | East US (North Virginia) | Gerrell Jones / Allens Lane administrator |
| Who controls DNS for application and email records? | Namecheap hosts `allenslane.org` DNS; named credential holder/change approver pending | Technical owner |
| Is MFA required for all staff or only privileged roles? | Required for every staff account; authenticator-app/TOTP preferred; customer MFA optional | Technical owner |
| How quickly must departing staff access be revoked? |  |  |
| How long must registrations, payments, donor records, communications, and audit logs be retained? | Initial schedule approved in `retention-backup-policy.md`; annual review and counsel/insurer validation required | Administrator + Finance |
| What is the deletion/anonymization policy for customer requests? |  |  |
| Are there organizational, grant, insurance, or legal requirements for data location or backups? | East US (North Virginia); daily backups required; grant/insurance-specific extensions still require annual review | Administrator + Finance |
| Who responds to a suspected data incident? |  |  |
