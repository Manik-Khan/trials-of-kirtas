-- QUEST-AUTHORING-PREFLIGHT.sql — read-only quest creation evidence.
-- Safe before or after schema_delta_quest_authoring.sql. Performs no writes and
-- returns one compact JSON object for M to paste back after manual application.

with installed as (
  select
    to_regclass('public.quests') as quests_table,
    to_regclass('public.quest_objectives') as objectives_table,
    to_regclass('public.quest_starts') as starts_table,
    to_regclass('public.feed') as feed_table,
    to_regclass('public.journal_pages') as journal_table,
    to_regclass('public.campaign') as campaign_table,
    to_regprocedure('public.create_quest(uuid,text,text,text,text,text,text,text,text,bigint,uuid)') as create_rpc,
    to_regprocedure('public.is_member()') as member_gate
), state as (
  select
    count(*) filter (
      where table_name = 'quests' and column_name = 'giver_id' and is_nullable = 'YES'
    ) as optional_giver_ids,
    count(*) filter (
      where table_name = 'quests' and column_name = 'giver_label' and is_nullable = 'YES'
    ) as optional_giver_labels
  from information_schema.columns
  where table_schema = 'public' and table_name = 'quests'
), policy_counts as (
  select count(*) filter (where tablename = 'quest_starts') as start_policies
  from pg_policies
  where schemaname = 'public' and tablename = 'quest_starts'
), trigger_counts as (
  select count(*) filter (where trigger_name = 'quest_starts_append_only') as start_append_only_guards
  from information_schema.triggers
  where event_object_schema = 'public' and event_object_table = 'quest_starts'
), grant_counts as (
  select count(*) as authenticated_write_grants
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('quests','quest_secrets','quest_objectives',
      'quest_objective_evidence','quest_rewards','quest_starts')
    and (
      has_table_privilege('authenticated',c.oid,'INSERT')
      or has_table_privilege('authenticated',c.oid,'UPDATE')
      or has_table_privilege('authenticated',c.oid,'DELETE')
      or has_table_privilege('authenticated',c.oid,'TRUNCATE')
      or has_table_privilege('authenticated',c.oid,'REFERENCES')
      or has_table_privilege('authenticated',c.oid,'TRIGGER')
      or has_any_column_privilege('authenticated',c.oid,'INSERT')
      or has_any_column_privilege('authenticated',c.oid,'UPDATE')
      or has_any_column_privilege('authenticated',c.oid,'REFERENCES')
    )
)
select jsonb_build_object(
  'status', case
    when i.quests_table is null then 'quest_foundation_not_installed'
    when i.objectives_table is null or i.feed_table is null or i.journal_table is null
      or i.campaign_table is null or i.member_gate is null
      then 'quest_authoring_prerequisite_missing'
    when i.starts_table is null or i.create_rpc is null
      then 'quest_authoring_not_installed'
    when s.optional_giver_ids < 1 or s.optional_giver_labels < 1
      then 'quest_optional_giver_incomplete'
    when p.start_policies < 1 or t.start_append_only_guards < 1
      then 'quest_authoring_guard_incomplete'
    when g.authenticated_write_grants > 0
      then 'quest_client_write_grant_present'
    when not has_function_privilege('authenticated',i.create_rpc,'EXECUTE')
      or has_function_privilege('anon',i.create_rpc,'EXECUTE')
      then 'quest_authoring_execute_incorrect'
    else 'installed_quest_authoring'
  end,
  'tables', jsonb_build_object(
    'quests', i.quests_table,
    'objectives', i.objectives_table,
    'starts', i.starts_table,
    'feed', i.feed_table,
    'journal_pages', i.journal_table,
    'campaign', i.campaign_table
  ),
  'rpc', jsonb_build_object(
    'create_quest', i.create_rpc,
    'authenticated_execute', has_function_privilege('authenticated',i.create_rpc,'EXECUTE'),
    'anonymous_execute', has_function_privilege('anon',i.create_rpc,'EXECUTE')
  ),
  'optional_giver', jsonb_build_object(
    'giver_id_nullable', s.optional_giver_ids = 1,
    'giver_label_nullable', s.optional_giver_labels = 1
  ),
  'policies', to_jsonb(p),
  'guards', to_jsonb(t),
  'authenticated', jsonb_build_object(
    'write_grants', g.authenticated_write_grants,
    'can_select_starts', has_table_privilege('authenticated',i.starts_table,'SELECT'),
    'can_insert_quests', has_table_privilege('authenticated',i.quests_table,'INSERT'),
    'can_insert_starts', has_table_privilege('authenticated',i.starts_table,'INSERT')
  )
)
from installed i cross join state s cross join policy_counts p
cross join trigger_counts t cross join grant_counts g;
