-- Security hardening: deny all direct anon/authenticated access to every table.
--
-- All database access in this app goes through Next.js API routes using the
-- service-role key, which bypasses RLS. Enabling RLS without policies plus
-- revoking grants means the publishable (anon) key cannot read or write anything
-- through PostgREST. Idempotent; tables that do not exist are skipped.

do $$
declare
  t text;
  tables text[] := array[
    'news_items',
    'news_entities',
    'news_story_members',
    'entities',
    'entity_aliases',
    'user_favorites',
    'user_seen_news',
    'user_events',
    'push_subscriptions',
    'push_delivery_log',
    'favorite_delivery_audit'
  ];
begin
  foreach t in array tables loop
    if to_regclass(format('public.%I', t)) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on table public.%I from anon, authenticated', t);
      raise notice 'RLS enabled and anon/authenticated revoked on public.%', t;
    else
      raise notice 'Skipped missing table public.%', t;
    end if;
  end loop;
end $$;

-- search_entities RPC is only called from server routes (service role).
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'search_entities'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end $$;

-- Backup schema from the 2026-09-19 catalog rebuild contains copies of user_favorites
-- (device ids). Lock it down; drop it entirely once the backup is no longer needed.
do $$
declare
  r record;
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'catalog_rebuild_backup') then
    revoke all on schema catalog_rebuild_backup from anon, authenticated;
    for r in
      select tablename from pg_tables where schemaname = 'catalog_rebuild_backup'
    loop
      execute format('alter table catalog_rebuild_backup.%I enable row level security', r.tablename);
      execute format('revoke all on table catalog_rebuild_backup.%I from anon, authenticated', r.tablename);
    end loop;
  end if;
end $$;

-- Future tables created in public should not be granted to anon/authenticated by default.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- Verification (run manually):
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
--   select table_name, grantee, privilege_type from information_schema.role_table_grants
--     where table_schema = 'public' and grantee in ('anon','authenticated');
