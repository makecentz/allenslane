begin;

insert into public.role_permissions (role, permission, description)
values ('system_admin', 'integrations.manage', 'Manage encrypted integration credentials and webhook configuration')
on conflict (role, permission) do update
set description = excluded.description;

create table public.integration_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  setting_key text not null unique
    check (setting_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  provider text not null
    check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  label text not null check (char_length(trim(label)) between 3 and 100),
  kind text not null
    check (kind in ('api_key', 'client_id', 'client_secret', 'identifier', 'url', 'webhook_secret')),
  description text not null check (char_length(trim(description)) between 10 and 500),
  is_required boolean not null default false,
  is_active boolean not null default true,
  display_order smallint not null default 100 check (display_order between 0 and 1000),
  callback_url text check (callback_url is null or callback_url ~ '^https://[^[:space:]]+$'),
  external_console_url text check (external_console_url is null or external_console_url ~ '^https://[^[:space:]]+$'),
  storage_source text not null default 'not_configured'
    check (storage_source in ('not_configured', 'edge_environment', 'vault')),
  vault_secret_id uuid unique,
  configured_at timestamptz,
  updated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_settings_configuration_state check (
    (storage_source = 'not_configured' and configured_at is null and vault_secret_id is null)
    or (storage_source = 'edge_environment' and configured_at is not null and vault_secret_id is null)
    or (storage_source = 'vault' and configured_at is not null and vault_secret_id is not null)
  )
);

create index integration_settings_provider_order_idx
  on public.integration_settings (provider, display_order);

alter table public.integration_settings enable row level security;
alter table public.integration_settings force row level security;

create policy integration_settings_system_admin_read
on public.integration_settings for select to authenticated
using ((select private.authorize('integrations.manage')));

revoke all on public.integration_settings from public, anon, authenticated;
grant select on public.integration_settings to authenticated;
grant select, insert, update, delete on public.integration_settings to service_role;

create trigger set_updated_at
before update on public.integration_settings
for each row execute function private.set_updated_at();

create trigger audit_integration_settings
after insert or update or delete on public.integration_settings
for each row execute function private.write_audit_event();

insert into public.integration_settings (
  setting_key, provider, label, kind, description, is_required, display_order,
  callback_url, external_console_url, storage_source, configured_at
) values
  (
    'stripe_secret_key', 'stripe', 'Secret API key', 'api_key',
    'Server-side key used to create secure Stripe Checkout sessions.', true, 10,
    null, 'https://dashboard.stripe.com/apikeys', 'edge_environment', now()
  ),
  (
    'stripe_webhook_secret', 'stripe', 'Webhook signing secret', 'webhook_secret',
    'Signing secret used to reject forged Stripe payment notifications.', true, 20,
    'https://skorvsqsyczkqmavjxzg.supabase.co/functions/v1/stripe-registration-webhook',
    'https://dashboard.stripe.com/webhooks', 'edge_environment', now()
  ),
  (
    'app_url', 'application', 'Public application URL', 'url',
    'Public base URL used for payment success, cancellation, and account return links.', true, 10,
    null, null, 'edge_environment', now()
  ),
  (
    'quickbooks_client_id', 'quickbooks', 'QuickBooks client ID', 'client_id',
    'OAuth application identifier for the planned QuickBooks Online connection.', false, 10,
    null, 'https://developer.intuit.com/app/developer/dashboard', 'not_configured', null
  ),
  (
    'quickbooks_client_secret', 'quickbooks', 'QuickBooks client secret', 'client_secret',
    'OAuth client secret for the planned QuickBooks Online connection.', false, 20,
    null, 'https://developer.intuit.com/app/developer/dashboard', 'not_configured', null
  ),
  (
    'quickbooks_webhook_verifier', 'quickbooks', 'QuickBooks webhook verifier', 'webhook_secret',
    'Verifier token that will authenticate future QuickBooks webhook notifications.', false, 30,
    null, 'https://developer.intuit.com/app/developer/dashboard', 'not_configured', null
  ),
  (
    'mailchimp_api_key', 'mailchimp', 'Mailchimp API key', 'api_key',
    'Server-side key reserved for future Mailchimp audience synchronization.', false, 10,
    null, 'https://admin.mailchimp.com/account/api/', 'not_configured', null
  ),
  (
    'mailchimp_audience_id', 'mailchimp', 'Mailchimp audience ID', 'identifier',
    'Audience identifier used for the Allens Lane email newsletter list.', false, 20,
    null, 'https://admin.mailchimp.com/lists/', 'not_configured', null
  ),
  (
    'resend_api_key', 'resend', 'Resend API key', 'api_key',
    'Transactional-email credential reserved for the final email-delivery phase.', false, 10,
    null, 'https://resend.com/api-keys', 'not_configured', null
  ),
  (
    'transactional_from_email', 'resend', 'Transactional sender email', 'identifier',
    'Verified From address to use when transactional email is enabled.', false, 20,
    null, 'https://resend.com/domains', 'not_configured', null
  );

create or replace function public.save_integration_setting(
  p_setting_key text,
  p_value text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  current_user_id uuid := (select auth.uid());
  setting_record record;
  saved_secret_id uuid;
  normalized_value text := trim(coalesce(p_value, ''));
  vault_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not private.authorize('integrations.manage') then
    raise exception 'System Administrator permission and MFA are required'
      using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 10 then
    raise exception 'An operational reason of at least 10 characters is required';
  end if;
  if char_length(normalized_value) < 3 or char_length(normalized_value) > 8192 then
    raise exception 'The integration value is missing or outside the allowed length';
  end if;

  select s.* into setting_record
  from public.integration_settings s
  where s.setting_key = lower(trim(coalesce(p_setting_key, '')))
    and s.is_active
  for update;

  if setting_record.id is null then
    raise exception 'Integration setting not found';
  end if;

  case setting_record.setting_key
    when 'stripe_secret_key' then
      if normalized_value !~ '^sk_(test|live)_[A-Za-z0-9]+$' then
        raise exception 'Enter a valid Stripe secret API key';
      end if;
    when 'stripe_webhook_secret' then
      if normalized_value !~ '^whsec_[A-Za-z0-9]+$' then
        raise exception 'Enter a valid Stripe webhook signing secret';
      end if;
    when 'app_url' then
      if normalized_value !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[^[:space:]]*)?$' then
        raise exception 'Enter a valid HTTPS application URL';
      end if;
      normalized_value := regexp_replace(normalized_value, '/+$', '');
    when 'mailchimp_api_key' then
      if normalized_value !~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$' then
        raise exception 'Enter a valid Mailchimp API key';
      end if;
    when 'mailchimp_audience_id' then
      if normalized_value !~ '^[A-Za-z0-9_-]{6,64}$' then
        raise exception 'Enter a valid Mailchimp audience ID';
      end if;
    when 'resend_api_key' then
      if normalized_value !~ '^re_[A-Za-z0-9_]+$' then
        raise exception 'Enter a valid Resend API key';
      end if;
    when 'transactional_from_email' then
      if normalized_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception 'Enter a valid transactional sender email';
      end if;
    else
      if setting_record.kind in ('api_key', 'client_id', 'client_secret', 'webhook_secret')
         and char_length(normalized_value) < 10 then
        raise exception 'This integration value must contain at least 10 characters';
      end if;
  end case;

  vault_name := 'allenslane.' || setting_record.setting_key;
  select s.id into saved_secret_id
  from vault.secrets s
  where s.name = vault_name;

  if saved_secret_id is null then
    select vault.create_secret(
      normalized_value,
      vault_name,
      'Managed by the Allens Lane System Administrator dashboard'
    ) into saved_secret_id;
  else
    perform vault.update_secret(
      saved_secret_id,
      normalized_value,
      vault_name,
      'Managed by the Allens Lane System Administrator dashboard'
    );
  end if;

  perform set_config('app.audit_reason', trim(p_reason), true);

  update public.integration_settings
  set storage_source = 'vault',
      vault_secret_id = saved_secret_id,
      configured_at = now(),
      updated_by = current_user_id
  where id = setting_record.id;

  return true;
end;
$$;

create or replace function public.get_integration_secret(p_setting_key text)
returns text
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select ds.decrypted_secret
  from public.integration_settings s
  join vault.decrypted_secrets ds on ds.id = s.vault_secret_id
  where s.setting_key = lower(trim(p_setting_key))
    and s.is_active
    and s.storage_source = 'vault';
$$;

revoke all on function public.save_integration_setting(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_integration_setting(text, text, text)
  to authenticated;

revoke all on function public.get_integration_secret(text)
  from public, anon, authenticated, service_role;
grant execute on function public.get_integration_secret(text)
  to service_role;

commit;
