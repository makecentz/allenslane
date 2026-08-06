begin;

-- Content and event mutations are only available through the guarded RPCs below.
-- Public and staff reads continue to use the existing RLS policies.
revoke insert, update, delete on public.content_items from authenticated;
revoke insert, update, delete on public.events from authenticated;

drop policy if exists content_editors_manage on public.content_items;
create policy content_staff_read on public.content_items for select to authenticated
using (private.authorize('content.edit') or private.authorize('content.publish'));

drop policy if exists events_staff_manage on public.events;
create policy events_staff_read on public.events for select to authenticated
using (private.authorize('events.manage'));

create or replace function private.validate_publishing_reason(change_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'An authenticated staff session is required';
  end if;

  if char_length(trim(coalesce(change_reason, ''))) < 10 then
    raise exception using errcode = '22023', message = 'A reason of at least 10 characters is required';
  end if;
end;
$$;

revoke all on function private.validate_publishing_reason(text)
from public, anon, authenticated, service_role;

create or replace function public.save_content_item(
  p_item_id uuid,
  p_content_type text,
  p_slug text,
  p_title text,
  p_summary text,
  p_body jsonb,
  p_hero_image_path text,
  p_hero_image_alt text,
  p_status text,
  p_change_reason text
)
returns public.content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_item public.content_items;
  existing_status text;
  can_publish boolean := private.authorize('content.publish');
begin
  perform private.validate_publishing_reason(p_change_reason);

  if not (private.authorize('content.edit') or can_publish) then
    raise exception using errcode = '42501', message = 'Active MFA-backed Content permission is required';
  end if;

  if p_content_type not in ('page', 'article', 'profile', 'production', 'exhibition', 'sponsor') then
    raise exception using errcode = '22023', message = 'Unsupported content type';
  end if;

  if p_status not in ('draft', 'review', 'published', 'archived') then
    raise exception using errcode = '22023', message = 'Unsupported content status';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception using errcode = '22023', message = 'A title is required';
  end if;

  if lower(trim(coalesce(p_slug, ''))) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Slug must contain lowercase letters, numbers, and single hyphens only';
  end if;

  if p_body is null or jsonb_typeof(p_body) <> 'object' then
    raise exception using errcode = '22023', message = 'Content body must be a JSON object';
  end if;

  if p_item_id is not null then
    select ci.status into existing_status
    from public.content_items ci
    where ci.id = p_item_id;

    if existing_status is null then
      raise exception using errcode = 'P0002', message = 'Content item not found';
    end if;
  end if;

  if not can_publish and (
    p_status in ('published', 'archived') or
    existing_status in ('published', 'archived')
  ) then
    raise exception using errcode = '42501', message = 'Content Publisher permission is required for published or archived records';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_item_id is null then
    insert into public.content_items (
      content_type, slug, title, summary, body, hero_image_path, hero_image_alt,
      status, published_at, created_by, updated_by
    ) values (
      p_content_type,
      lower(trim(p_slug)),
      trim(p_title),
      nullif(trim(coalesce(p_summary, '')), ''),
      p_body,
      nullif(trim(coalesce(p_hero_image_path, '')), ''),
      nullif(trim(coalesce(p_hero_image_alt, '')), ''),
      p_status,
      case when p_status = 'published' then now() else null end,
      (select auth.uid()),
      (select auth.uid())
    ) returning * into saved_item;
  else
    update public.content_items
    set content_type = p_content_type,
        slug = lower(trim(p_slug)),
        title = trim(p_title),
        summary = nullif(trim(coalesce(p_summary, '')), ''),
        body = p_body,
        hero_image_path = nullif(trim(coalesce(p_hero_image_path, '')), ''),
        hero_image_alt = nullif(trim(coalesce(p_hero_image_alt, '')), ''),
        status = p_status,
        published_at = case
          when p_status = 'published' then coalesce(published_at, now())
          when p_status in ('draft', 'review') then null
          else published_at
        end,
        updated_by = (select auth.uid())
    where id = p_item_id
    returning * into saved_item;
  end if;

  return saved_item;
end;
$$;

create or replace function public.save_event(
  p_event_id uuid,
  p_slug text,
  p_title text,
  p_summary text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_facility_id uuid,
  p_external_ticket_url text,
  p_capacity integer,
  p_image_path text,
  p_image_alt text,
  p_status text,
  p_change_reason text
)
returns public.events
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_event public.events;
begin
  perform private.validate_publishing_reason(p_change_reason);

  if not private.authorize('events.manage') then
    raise exception using errcode = '42501', message = 'Active MFA-backed Events Management permission is required';
  end if;

  if p_status not in ('draft', 'published', 'canceled', 'completed', 'archived') then
    raise exception using errcode = '22023', message = 'Unsupported event status';
  end if;

  if trim(coalesce(p_title, '')) = '' or p_starts_at is null then
    raise exception using errcode = '22023', message = 'Event title and start time are required';
  end if;

  if lower(trim(coalesce(p_slug, ''))) !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Slug must contain lowercase letters, numbers, and single hyphens only';
  end if;

  if p_ends_at is not null and p_ends_at < p_starts_at then
    raise exception using errcode = '22023', message = 'Event end time must not precede its start time';
  end if;

  if p_capacity is not null and p_capacity < 0 then
    raise exception using errcode = '22023', message = 'Capacity cannot be negative';
  end if;

  if nullif(trim(coalesce(p_external_ticket_url, '')), '') is not null
     and trim(p_external_ticket_url) !~ '^https://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'External ticket URL must use HTTPS';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names
    where name = coalesce(nullif(trim(p_timezone), ''), 'America/New_York')
  ) then
    raise exception using errcode = '22023', message = 'Unknown event timezone';
  end if;

  if p_facility_id is not null and not exists (
    select 1 from public.facilities f where f.id = p_facility_id
  ) then
    raise exception using errcode = '23503', message = 'Event facility not found';
  end if;

  if p_event_id is not null and not exists (
    select 1 from public.events e where e.id = p_event_id
  ) then
    raise exception using errcode = 'P0002', message = 'Event not found';
  end if;

  perform set_config('app.audit_reason', trim(p_change_reason), true);

  if p_event_id is null then
    insert into public.events (
      slug, title, summary, description, starts_at, ends_at, timezone, facility_id,
      external_ticket_url, capacity, image_path, image_alt, status, published_at,
      created_by, updated_by
    ) values (
      lower(trim(p_slug)),
      trim(p_title),
      nullif(trim(coalesce(p_summary, '')), ''),
      nullif(trim(coalesce(p_description, '')), ''),
      p_starts_at,
      p_ends_at,
      coalesce(nullif(trim(p_timezone), ''), 'America/New_York'),
      p_facility_id,
      nullif(trim(coalesce(p_external_ticket_url, '')), ''),
      p_capacity,
      nullif(trim(coalesce(p_image_path, '')), ''),
      nullif(trim(coalesce(p_image_alt, '')), ''),
      p_status,
      case when p_status = 'published' then now() else null end,
      (select auth.uid()),
      (select auth.uid())
    ) returning * into saved_event;
  else
    update public.events
    set slug = lower(trim(p_slug)),
        title = trim(p_title),
        summary = nullif(trim(coalesce(p_summary, '')), ''),
        description = nullif(trim(coalesce(p_description, '')), ''),
        starts_at = p_starts_at,
        ends_at = p_ends_at,
        timezone = coalesce(nullif(trim(p_timezone), ''), 'America/New_York'),
        facility_id = p_facility_id,
        external_ticket_url = nullif(trim(coalesce(p_external_ticket_url, '')), ''),
        capacity = p_capacity,
        image_path = nullif(trim(coalesce(p_image_path, '')), ''),
        image_alt = nullif(trim(coalesce(p_image_alt, '')), ''),
        status = p_status,
        published_at = case
          when p_status = 'published' then coalesce(published_at, now())
          when p_status = 'draft' then null
          else published_at
        end,
        updated_by = (select auth.uid())
    where id = p_event_id
    returning * into saved_event;
  end if;

  return saved_event;
end;
$$;

drop trigger if exists audit_content_items on public.content_items;
create trigger audit_content_items
after insert or update or delete on public.content_items
for each row execute function private.write_audit_event();

drop trigger if exists audit_event_records on public.events;
create trigger audit_event_records
after insert or update or delete on public.events
for each row execute function private.write_audit_event();

revoke all on function public.save_content_item(uuid, text, text, text, text, jsonb, text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.save_event(uuid, text, text, text, text, timestamptz, timestamptz, text, uuid, text, integer, text, text, text, text)
from public, anon, authenticated, service_role;

grant execute on function public.save_content_item(uuid, text, text, text, text, jsonb, text, text, text, text)
to authenticated;
grant execute on function public.save_event(uuid, text, text, text, text, timestamptz, timestamptz, text, uuid, text, integer, text, text, text, text)
to authenticated;

notify pgrst, 'reload schema';

commit;
