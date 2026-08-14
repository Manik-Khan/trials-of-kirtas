-- ITEM-TRANSFER-PREFLIGHT.sql — READ ONLY. Run in Supabase SQL Editor and save
-- every result grid before building the atomic item-transfer RPC. This captures
-- the live-only characters authority which README.md says is absent from git.

-- 1. Exact characters/profiles columns, defaults, and nullability.
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('characters', 'profiles')
 order by table_name, ordinal_position;

-- 2. Primary keys, foreign keys, unique/check constraints.
select c.relname as table_name, con.conname,
       pg_get_constraintdef(con.oid, true) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('characters', 'profiles')
 order by c.relname, con.conname;

-- 3. Exact indexes, including partial uniqueness.
select tablename, indexname, indexdef
  from pg_indexes
 where schemaname = 'public'
   and tablename in ('characters', 'profiles')
 order by tablename, indexname;

-- 4. Every RLS policy verb and predicate.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('characters', 'profiles')
 order by tablename, policyname;

-- 5. Guards and other non-internal triggers.
select c.relname as table_name, t.tgname as trigger_name,
       pg_get_triggerdef(t.oid, true) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where not t.tgisinternal
   and n.nspname = 'public'
   and c.relname in ('characters', 'profiles')
 order by c.relname, t.tgname;

-- 6. Exact helper/RPC bodies that currently create or guard characters.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in (
     'characters_guard_columns', 'create_character',
     'is_member', 'is_staff', 'my_profile_id'
   )
 order by p.proname, arguments;

-- 7. API grants and realtime publication membership.
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name in ('characters', 'profiles')
 order by table_name, grantee, privilege_type;

select schemaname, tablename
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and schemaname = 'public'
   and tablename in ('characters', 'profiles')
 order by tablename;

