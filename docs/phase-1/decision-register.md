# Decision Register

## Decisions recorded August 5, 2026

| Decision | Resolution | Status |
|---|---|---|
| Canvas transition | Run Canvas in parallel temporarily; make it read-only after reconciled migration. | Approved |
| Payment processing | Use Stripe. | Approved |
| Accounting | Use QuickBooks Online. | Approved; integration method pending |
| Transactional email | Use Resend for Supabase Auth and application email, but configure it only after the permanent domain is ready. | Approved; deferred to final-domain launch |
| Marketing email | Retain Mailchimp initially. | Approved |
| Theater ticketing | Retain the external provider initially. | Approved |
| Supabase ownership | Organization owner: `allenslane`; intended project: `alanedb`. | Approved; connection pending |
| Canvas source data | A usable export cannot be obtained. Canvas remains the read-only historical source; only verified active/opening data is manually migrated. | Approved constraint |
| Permissions and finance approval | Gerrell Jones (`ecomexpertsllc@gmail.com`) is the Finance approver. Refunds and voids are performed by the Finance approver. | Approved |
| Customer authentication | Email and password. | Approved |
| DNS ownership | Namecheap manages `allenslane.org` DNS. | Confirmed; credential/access owner pending |
| Technical contact | Gerrell Jones (`ecomexpertsllc@gmail.com`). | Confirmed |
| Refund method | Refunds are issued offline by check only; no automatic Stripe refund. | Approved; recordkeeping fields and accounting workflow pending |
| Production region | Supabase East US (North Virginia). | Approved |
| Staff MFA | Mandatory for all staff accounts; authenticator-app/TOTP preferred. Customer MFA remains optional. | Approved |
| Backup baseline | Daily managed and independent encrypted backups, with separate protection for Storage objects and quarterly restore tests. | Approved |

Priority meanings:

- **P0** — blocks Phase 2 architecture
- **P1** — blocks the relevant implementation release
- **P2** — can be resolved during implementation

| ID | Priority | Decision | Recommended default |
|---|---|---|---|
| DEC-01 | P0 | Will Canvas be fully replaced, run in parallel, or remain authoritative for transactions? | **Resolved:** parallel temporarily, then read-only after reconciled cutover |
| DEC-02 | P0 | Who owns the Supabase organization and production project? | **Resolved:** `allenslane`; intended project `alanedb`. Add at least two organization administrators before production |
| DEC-03 | P0 | Where must production data be hosted? | **Resolved:** Supabase **East US (North Virginia)** |
| DEC-04 | P0 | What customer sign-in methods are acceptable? | **Resolved for customers:** email and password. Staff MFA remains recommended and must be decided separately |
| DEC-05 | P0 | What history and attachments can Canvas export? | **Resolved constraint:** no usable export is available. Keep Canvas as the read-only historical source and manually migrate only verified active/opening records through controlled templates |
| DEC-06 | P1 | Which payment processor will be used? | **Resolved:** Stripe |
| DEC-07 | P1 | Will theater ticketing remain external? | **Resolved:** retain initially; reconsider for Release 3 |
| DEC-08 | P1 | Will Mailchimp remain the marketing-email system? | **Resolved:** retain initially; use a separate provider for transactional email |
| DEC-09 | P1 | Which accounting system receives reconciliation exports? | **Resolved:** QuickBooks Online. Begin with reviewed exports/imports; decide whether a direct API sync is justified after reconciliation rules are proven |
| DEC-10 | P1 | What are the refund, transfer, credit, cancellation, and waitlist-promotion rules by program? | **Partially resolved:** monetary refunds are issued offline by check only. Program-specific cancellation, transfer, credit, and waitlist rules remain pending |
| DEC-11 | P1 | Which roles may refund, void, discount, credit, export, merge records, or view donor/minor data? | **Partially resolved:** Gerrell Jones is the Finance approver and alone completes refunds/voids. Thresholds and remaining capabilities are pending |
| DEC-12 | P1 | How are household invitations and guardian authority verified? | Primary guardian invites adults; staff override is audited |
| DEC-13 | P1 | Which releases/waivers and emergency fields are required for youth and camp? | Versioned acceptance tied to participant and registration |
| DEC-14 | P1 | What data retention and deletion policies apply? | Written schedule covering finance, minors, donors, communications, and audit logs |
| DEC-15 | P2 | Keep Jira Service Management? | Keep as an external linked help desk unless staff request an integrated queue |
| DEC-16 | P2 | Is public site search required in Release 1? | Defer unless content discovery testing shows a clear need |
| DEC-17 | P2 | Is attendance tracking required? | Include schema support; defer UI unless operationally required |
| DEC-18 | P2 | Are gift certificates, merchandise, rentals, and point-of-sale required? | Scope only after active balances and workflows are audited |
| DEC-19 | P1 | Which provider sends authentication and operational transactional email? | **Resolved:** use Resend with separate authenticated sending subdomains; defer account, DNS, and SMTP activation to the final-domain launch step |
| DEC-20 | P1 | Who controls public DNS and can publish email-authentication records? | **Resolved:** Namecheap hosts DNS. Confirm the individual who can approve and apply DNS changes |
| DEC-21 | P1 | Who is the primary technical/Supabase contact? | **Resolved:** Gerrell Jones (`ecomexpertsllc@gmail.com`) |
| DEC-22 | P0 | Is staff MFA required? | **Resolved:** mandatory for all staff. Enforce `aal2` for staff application access and enable organization-level MFA enforcement when the Supabase plan supports it |
| DEC-23 | P0 | What backup and recovery baseline applies? | **Resolved:** daily Supabase backup plus independent encrypted daily backup, separate Storage-object protection, 35-day independent rolling retention, quarterly restore tests, target RPO 24 hours and target RTO 8 hours |
| DEC-24 | P1 | What application-record retention schedule applies? | **Resolved as an initial policy:** use `retention-backup-policy.md`; review annually and obtain counsel/insurer approval for youth, incident, and waiver periods before launch |
| DEC-25 | P0 | How will migration proceed without a Canvas export? | **Resolved:** clean schema from approved requirements; no speculative legacy schema cloning; manually reconcile active obligations and preserve a versioned import boundary for future data |

Supabase region reference: https://supabase.com/docs/guides/platform/regions

## Stakeholder inputs requested first

1. Name the operational product owner; Gerrell Jones is recorded as both Finance approver and technical/Supabase contact.
2. Add a second organization administrator for production Supabase continuity.
3. At final-domain launch, create the organization-owned Resend account and have the Namecheap DNS owner publish the approved email-authentication records.
4. Choose the initial QuickBooks Online connection method: reviewed reports/CSV, API, or both.
5. Approve the manual cutover worksheet for active registrations, waitlists, balances, credits, memberships, pledges, and payment plans.
6. Approve the detailed role matrix, financial thresholds, retention schedule, and reconciliation process.
