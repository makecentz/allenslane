# Requirements Traceability Matrix

This matrix connects requirement domains to releases, accountable stakeholders, source evidence, and required acceptance evidence.

| Domain | Requirement IDs | Target release | Business approver | Current evidence | Required acceptance evidence |
|---|---|---:|---|---|---|
| Public publishing | PUB-01–PUB-09 | 1 | Marketing/content owner | Website audit and sitemap | Editorial create/preview/publish/archive tests; URL/redirect inventory |
| People and households | PEO-01–PEO-10 | 2 | Operations/registrar | Canvas walkthrough and legacy-classification screenshot; no export available | Household/guardian scenarios, manual-cutover provenance, duplicate review, privacy tests |
| Classes and scheduling | CLS-01–CLS-12 | 1–2 | Programs owner | Canvas class screens and public class page | Catalog parity, schedule/conflict, pricing, capacity, publication tests |
| Registration/waitlists | REG-01–REG-09 | 2 | Registrar | Canvas history and waitlist screens | Register, waitlist, promote, drop, transfer, scholarship, notification tests |
| Events/tickets | EVT-01–EVT-07 | 1/3 | Events/theater owner | Canvas event screens and external ticket links | Publish, capacity, tier, order, refund, retained-integration tests |
| Payments/commerce | PAY-01–PAY-09 | 2 | Finance approver | Canvas register tape and payment reports | Checkout, webhook, duplicate protection, offline-check refund, approval, and QuickBooks Online reconciliation tests |
| Membership/giving | MEM-01–MEM-03; GIV-01–GIV-04 | 3 | Development owner | Canvas person/giving/membership screens | Renewal/status, pricing eligibility, gift/receipt/history tests |
| Communications | COM-01–COM-06 | 2–3 | Operations/marketing | Canvas email modal and Mailchimp link | Consent, template, delivery, bounce, history, role tests |
| Reports/admin/support | REP-01–REP-04; ADM-01–ADM-03; SUP-01–SUP-02 | 2–3 | Department owners | Canvas reports/dashboard/help desk | Report reconciliation, export authorization, audit, alert tests |
| Security/reliability | NFR-01–NFR-11 | All | Technical and operational owners | Requirements, selected platform, and retention/backup policy | Accessibility, staff `aal2` enforcement, RLS, database-and-object restore, monitoring, security and load evidence |

## Coverage rules

- No implementation story is accepted without at least one requirement ID.
- Every Required requirement must have a named approver and acceptance test before its release begins.
- Every migrated domain must have source totals when obtainable. Manual cutover data requires preparer/verifier attribution, target totals, and business-owner reconciliation evidence.
- Every public write path and privileged staff action must include authorization and audit acceptance tests.
- Decisions that change scope must update the requirements inventory, MVP scope, and this matrix together.
