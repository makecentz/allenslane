# Manual Cutover Plan

## Purpose

Canvas cannot provide a reliable export. The cutover therefore moves only verified records needed to operate after launch. Historical records remain in read-only Canvas and are never reconstructed from guesses.

## Templates

| Template | Contents | Business verifier |
|---|---|---|
| `people-households.csv` | People required by active obligations, household links, guardianship, contact, and source references | Operations/registrar |
| `classes.csv` | Current/upcoming terms, programs, classes, instructors, schedule, capacity, and prices | Programs owner |
| `registrations.csv` | Active registrations and waiver references | Registrar |
| `waitlists.csv` | Current waitlist order and status | Registrar |
| `opening-balances.csv` | Open balances, credits, scholarships, gift certificates, and payment obligations | Gerrell Jones / Finance |
| `memberships-pledges.csv` | Active memberships, active pledges, and required donor links | Development + Finance |
| `reconciliation-controls.csv` | Expected counts and totals used to approve a batch | Domain owner + Finance where monetary |

## Rules

1. Use one stable human-verifiable `source_reference` for every row.
2. Do not include passwords, raw card data, full Stripe secrets, or unnecessary medical details.
3. Prepare and verify rows by different people when possible.
4. Reject unresolved duplicates; do not auto-merge them.
5. Opening financial balances require Gerrell Jones's approval.
6. Registration and waitlist totals require the registrar/program owner's approval.
7. Every import is dry-run validated before application.
8. Applied rows record target table/ID and remain traceable to the batch.
9. Corrections create a new batch or audited adjustment; approved source files are not silently overwritten.
10. The cutover report lists prepared, valid, warning, rejected, applied, and unresolved counts by domain.

## Minimum launch controls

- Number of current/upcoming classes by status
- Registered participants per class
- Waitlist participants per class in exact order
- Total open customer balances
- Total active credits, scholarships, and gift certificates
- Active memberships by plan
- Active pledges/payment plans and total remaining amount
- Active customer accounts to invite

The batch is approved only when every control either matches or has an accepted written variance.
