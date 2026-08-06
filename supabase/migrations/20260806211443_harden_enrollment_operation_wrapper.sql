begin;

-- Keep the privileged implementation outside the exposed API schema. The
-- public wrapper validates identity, MFA-backed authorization, arguments, and
-- the returned mutation result before exposing the operation through RPC.
alter function public.manage_enrollment_record(text, uuid, text, text, integer)
  rename to manage_enrollment_record_impl;
alter function public.manage_enrollment_record_impl(text, uuid, text, text, integer)
  set schema private;

revoke all on function private.manage_enrollment_record_impl(text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;

create or replace function public.manage_enrollment_record(
  p_record_type text,
  p_record_id uuid,
  p_action text,
  p_reason text,
  p_offer_hours integer default 48
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not private.authorize('registrations.manage') then
    raise exception 'An active MFA-backed Registration Manager role is required';
  end if;
  if p_offer_hours is null or p_offer_hours not between 1 and 168 then
    raise exception 'Waitlist offers must remain open for 1 to 168 hours';
  end if;

  result := private.manage_enrollment_record_impl(
    p_record_type,
    p_record_id,
    p_action,
    p_reason,
    p_offer_hours
  );

  if nullif(result ->> 'status', '') is null then
    raise exception 'The enrollment record changed before the action completed';
  end if;

  return result;
end;
$$;

revoke all on function public.manage_enrollment_record(text, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.manage_enrollment_record(text, uuid, text, text, integer)
  to authenticated;

commit;
