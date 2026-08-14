-- ITEM-TRANSFER-PREFLIGHT.sql — READ ONLY. Run the entire file in Supabase SQL
-- Editor. It returns ONE row named item_transfer_preflight; copy that JSON cell
-- (or download the result as CSV) before building the atomic item-transfer RPC.
-- This captures the live-only characters authority absent from git.

with
column_rows as (
  select table_name, ordinal_position, column_name, data_type, udt_name,
         is_nullable, column_default
    from information_schema.columns
   where table_schema = 'public'
     and table_name in ('characters', 'profiles')
),
constraint_rows as (
  select c.relname as table_name, con.conname,
         pg_get_constraintdef(con.oid, true) as definition
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('characters', 'profiles')
),
index_rows as (
  select tablename, indexname, indexdef
    from pg_indexes
   where schemaname = 'public'
     and tablename in ('characters', 'profiles')
),
policy_rows as (
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
   where schemaname = 'public'
     and tablename in ('characters', 'profiles')
),
trigger_rows as (
  select c.relname as table_name, t.tgname as trigger_name,
         pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal
     and n.nspname = 'public'
     and c.relname in ('characters', 'profiles')
),
function_rows as (
  select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
         pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'characters_guard_columns', 'create_character',
       'is_member', 'is_staff', 'my_profile_id'
     )
),
grant_rows as (
  select grantee, table_name, privilege_type
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('characters', 'profiles')
),
realtime_rows as (
  select schemaname, tablename
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename in ('characters', 'profiles')
)
select jsonb_pretty(jsonb_build_object(
  'columns', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.table_name, r.ordinal_position) from column_rows r),
    '[]'::jsonb
  ),
  'constraints', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.table_name, r.conname) from constraint_rows r),
    '[]'::jsonb
  ),
  'indexes', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.tablename, r.indexname) from index_rows r),
    '[]'::jsonb
  ),
  'policies', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.tablename, r.policyname) from policy_rows r),
    '[]'::jsonb
  ),
  'triggers', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.table_name, r.trigger_name) from trigger_rows r),
    '[]'::jsonb
  ),
  'functions', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.proname, r.arguments) from function_rows r),
    '[]'::jsonb
  ),
  'grants', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.table_name, r.grantee, r.privilege_type) from grant_rows r),
    '[]'::jsonb
  ),
  'realtime', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.tablename) from realtime_rows r),
    '[]'::jsonb
  )
)) as item_transfer_preflight;

