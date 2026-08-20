-- CAMPAIGN-MOMENT-PREFLIGHT.sql — READ ONLY. Run the entire file in the
-- Supabase SQL Editor before schema_delta_campaign_moments.sql, then rerun it
-- after application. It returns one JSON cell named campaign_moment_preflight.

with
required_relations(table_name) as (
  values
    ('feed'), ('journal_pages'), ('encounters'), ('scenes'),
    ('forge_sessions'), ('entities'), ('item_events'), ('item_instances')
),
relation_state as (
  select r.table_name,
         to_regclass(format('public.%I', r.table_name)) is not null as present
    from required_relations r
),
required_columns(table_name, column_name, expected_udt) as (
  values
    ('feed', 'id', 'int8'),
    ('feed', 'session', 'int4'),
    ('feed', 'encounter_id', 'uuid'),
    ('journal_pages', 'id', 'uuid'),
    ('journal_pages', 'shared_feed_id', 'int8'),
    ('encounters', 'id', 'uuid'),
    ('encounters', 'map_ref', 'text'),
    ('scenes', 'id', 'uuid'),
    ('scenes', 'key', 'text'),
    ('forge_sessions', 'id', 'uuid'),
    ('entities', 'id', 'text'),
    ('entities', 'type', 'text'),
    ('entities', 'parent_id', 'text'),
    ('entities', 'map_x', 'numeric'),
    ('entities', 'map_y', 'numeric'),
    ('item_events', 'id', 'text'),
    ('item_events', 'item_id', 'text'),
    ('item_events', 'moment_id', 'text'),
    ('item_instances', 'id', 'text')
),
column_state as (
  select r.table_name, r.column_name, r.expected_udt,
         c.udt_name as actual_udt,
         c.column_name is not null and c.udt_name = r.expected_udt as compatible
    from required_columns r
    left join information_schema.columns c
      on c.table_schema = 'public'
     and c.table_name = r.table_name
     and c.column_name = r.column_name
),
required_helpers(function_name) as (
  values ('is_member'), ('is_staff')
),
helper_state as (
  select r.function_name,
         exists (
           select 1
             from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public'
              and p.proname = r.function_name
              and pg_get_function_identity_arguments(p.oid) = ''
         ) as present
    from required_helpers r
),
campaign_relations as (
  select v.table_name,
         to_regclass(format('public.%I', v.table_name)) is not null as present
    from (values ('campaign_moments'), ('campaign_moment_secrets')) v(table_name)
),
campaign_policies as (
  select tablename, policyname, cmd, roles, qual
    from pg_policies
   where schemaname = 'public'
     and tablename in ('campaign_moments', 'campaign_moment_secrets')
),
campaign_grants as (
  select table_name, grantee, privilege_type
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('campaign_moments', 'campaign_moment_secrets')
),
campaign_realtime as (
  select tablename
    from pg_publication_tables
   where pubname = 'supabase_realtime'
     and schemaname = 'public'
     and tablename = 'campaign_moments'
),
readiness as (
  select
    not exists (select 1 from relation_state where not present)
      and not exists (select 1 from column_state where not compatible)
      and not exists (select 1 from helper_state where not present) as prerequisites_ready,
    (select bool_or(present) from campaign_relations) as any_campaign_contract_present,
    (select bool_and(present) from campaign_relations) as campaign_contract_installed
)
select jsonb_pretty(jsonb_build_object(
  'status', case
    when not readiness.prerequisites_ready then 'blocked_prerequisites'
    when readiness.any_campaign_contract_present and not readiness.campaign_contract_installed
      then 'blocked_partial_contract'
    when readiness.campaign_contract_installed then 'installed_review_security'
    else 'ready_to_apply'
  end,
  'prerequisites_ready', readiness.prerequisites_ready,
  'campaign_contract_installed', readiness.campaign_contract_installed,
  'relations', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.table_name) from relation_state r),
    '[]'::jsonb
  ),
  'columns', coalesce(
    (select jsonb_agg(to_jsonb(c) order by c.table_name, c.column_name) from column_state c),
    '[]'::jsonb
  ),
  'helpers', coalesce(
    (select jsonb_agg(to_jsonb(h) order by h.function_name) from helper_state h),
    '[]'::jsonb
  ),
  'campaign_relations', coalesce(
    (select jsonb_agg(to_jsonb(c) order by c.table_name) from campaign_relations c),
    '[]'::jsonb
  ),
  'campaign_policies', coalesce(
    (select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname) from campaign_policies p),
    '[]'::jsonb
  ),
  'campaign_grants', coalesce(
    (select jsonb_agg(to_jsonb(g) order by g.table_name, g.grantee, g.privilege_type) from campaign_grants g),
    '[]'::jsonb
  ),
  'campaign_realtime', coalesce(
    (select jsonb_agg(to_jsonb(r) order by r.tablename) from campaign_realtime r),
    '[]'::jsonb
  )
)) as campaign_moment_preflight
from readiness;
