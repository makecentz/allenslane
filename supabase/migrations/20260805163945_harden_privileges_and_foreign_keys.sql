begin;

-- Make Data API access opt-in. Older projects may grant broad privileges to
-- anon/authenticated automatically when objects are created.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated, service_role;

revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Anonymous visitors only need published catalog/content reads. RLS policies
-- still decide which rows are visible.
grant select on public.programs, public.terms, public.facilities, public.classes,
  public.class_instructors, public.class_meetings, public.events, public.content_items,
  public.person_classifications, public.membership_plans to anon, authenticated;

-- Signed-in operations remain subject to the per-table RLS policies.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- This RPC validates auth.uid() and creates only the caller's initial profile
-- and household. It is intentionally unavailable to anonymous callers.
grant execute on function public.complete_customer_onboarding(text, text, text, text, text)
  to authenticated;

-- Trigger-only helpers are not client-callable. Policy helper functions keep
-- their explicit authenticated grants from the RLS migration.
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated, service_role;
revoke execute on function private.prevent_audit_mutation() from public, anon, authenticated, service_role;
revoke execute on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke execute on function private.validate_payment_void() from public, anon, authenticated, service_role;
revoke execute on function private.validate_refund_adjustment() from public, anon, authenticated, service_role;
revoke execute on function private.write_audit_event() from public, anon, authenticated, service_role;

-- PostgreSQL does not create indexes for referencing foreign-key columns.
-- Add deterministic covering indexes for every current FK that lacks one.
do $$
declare
  fk record;
begin
  for fk in
    select
      ns.nspname as schema_name,
      tbl.relname as table_name,
      left(con.conname, 50) || '_' || left(md5(ns.nspname || '.' || con.conname), 8) || '_idx' as index_name,
      string_agg(quote_ident(att.attname), ', ' order by key_col.ordinality) as column_list
    from pg_constraint con
    join pg_class tbl on tbl.oid = con.conrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    cross join lateral unnest(con.conkey) with ordinality as key_col(attnum, ordinality)
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key_col.attnum
    where con.contype = 'f'
      and ns.nspname in ('public', 'migration')
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and idx.indisready
          and (idx.indkey::smallint[])[0:cardinality(con.conkey) - 1] = con.conkey
      )
    group by ns.nspname, tbl.relname, con.conname
  loop
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      fk.index_name,
      fk.schema_name,
      fk.table_name,
      fk.column_list
    );
  end loop;
end $$;

commit;
