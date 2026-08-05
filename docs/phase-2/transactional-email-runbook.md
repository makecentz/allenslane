# Transactional Email and Staff Invitations

Status: Invitation workflow deployed; Resend domain and SMTP activation pending
Prepared: August 5, 2026

## Implemented application flow

1. An MFA-verified administrator opens `/staff/admin` and supplies the staff member's name, email, initial role, and an audit reason.
2. The browser invokes the protected `invite-staff` Supabase Edge Function with the administrator's access token.
3. The function verifies the token, requires `aal2`, confirms an active staff account, and checks `staff.manage`.
4. Finance roles additionally require `finance.approve`; System Administrator invitations require an existing System Administrator.
5. Supabase Auth sends an invitation that returns to `/account?invite=1`.
6. The existing guarded database RPC activates the staff record and role assignment with the supplied audit reason.
7. The recipient accepts the invitation, creates a 12-character-or-longer password, then enrolls TOTP before staff access is granted.

The Edge Function has `verify_jwt` enabled, uses an exact browser-origin allowlist, and keeps the Supabase service-role credential inside the Supabase runtime.

## Resend production setup

Allens Lane must create or select the organization-owned Resend account before production email is enabled.

1. In Resend, add `allenslane.org` and copy the provided SPF and DKIM records.
2. Add those records in Namecheap DNS without deleting the existing website or Mailchimp records.
3. Wait until Resend marks the domain verified.
4. Create a sending-only Resend API key named `alanedb-auth-production` and store it in the organization password manager.
5. In Supabase Dashboard, open **Project Settings → Authentication → SMTP Settings** and enable custom SMTP with:

   - Host: `smtp.resend.com`
   - Port: `465` for implicit TLS, or `587` for STARTTLS
   - Username: `resend`
   - Password: the Resend API key
   - Sender email: `accounts@allenslane.org`
   - Sender name: `Allens Lane Art Center`

6. Copy the subjects and HTML from `supabase/templates/` into the hosted Supabase Auth email-template settings.
7. Keep the temporary application URL in the Auth redirect allowlist until final DNS cutover.

Supabase keeps hosted templates read-only while its default mail service is active, so the branded templates can be applied only after custom SMTP is enabled.

Never commit the Resend API key or paste it into browser-visible code.

## Required verification

- Send a test invitation to an approved Allens Lane test mailbox.
- Confirm the message passes SPF and DKIM and does not land in spam.
- Confirm the invitation opens `/account?invite=1` on the temporary domain.
- Confirm a 12-character password is required.
- Confirm the invited account cannot open staff modules until TOTP reaches `aal2`.
- Confirm the assigned role and audit reason appear in `/staff/admin`.
- Test confirmation and password-recovery emails.
- Enable Supabase leaked-password protection before public launch.

## Failure handling

- If the email already has an Auth account, use **Activate an existing account** instead of sending an invitation.
- If email delivery succeeds but role activation fails, use the same existing-account action to finish setup.
- Do not repeatedly retry a failed invitation; check Supabase Auth logs and Resend delivery events first.
- Keep Canvas access unchanged during this setup and testing period.
