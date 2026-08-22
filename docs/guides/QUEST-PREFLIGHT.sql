-- QUEST-PREFLIGHT.sql — read-only prerequisite / post-apply evidence.
-- Safe to run before or after schema_delta_quests.sql. This script performs no
-- writes and returns one compact JSON object for review.

with installed as (
  select
    to_regclass('public.quests') as quests_table,
    to_regclass('public.quest_secrets') as secrets_table,
    to_regclass('public.quest_objectives') as objectives_table,
    to_regclass('public.quest_objective_evidence') as evidence_table,
    to_regclass('public.quest_rewards') as rewards_table,
    to_regclass('public.campaign_moments') as moments_table,
    to_regprocedure('public.is_member()') as member_gate,
    to_regprocedure('public.is_staff()') as staff_gate
), policy_counts as (
  select
    count(*) filter (where tablename = 'quests') as quest_policies,
    count(*) filter (where tablename = 'quest_secrets') as secret_policies,
    count(*) filter (where tablename = 'quest_objectives') as objective_policies,
    count(*) filter (where tablename = 'quest_objective_evidence') as evidence_policies,
    count(*) filter (where tablename = 'quest_rewards') as reward_policies
  from pg_policies
  where schemaname = 'public'
    and tablename in ('quests','quest_secrets','quest_objectives','quest_objective_evidence','quest_rewards')
), trigger_counts as (
  select
    count(*) filter (where trigger_name = 'quest_objective_evidence_required') as objective_evidence_guards,
    count(*) filter (where trigger_name = 'quest_completion_required') as completion_guards,
    count(*) filter (where trigger_name = 'completed_quest_objective_set') as objective_set_guards,
    count(*) filter (where trigger_name = 'quest_evidence_append_only') as append_only_guards
  from information_schema.triggers
  where event_object_schema = 'public'
    and event_object_table in ('quests','quest_objectives','quest_objective_evidence')
), grant_counts as (
  select count(*) as authenticated_write_grants
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('quests','quest_secrets','quest_objectives','quest_objective_evidence','quest_rewards')
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
    when i.quests_table is null then 'quest_schema_not_installed'
    when i.moments_table is null or i.member_gate is null or i.staff_gate is null then 'quest_prerequisite_missing'
    when p.quest_policies < 1 or p.secret_policies < 1 or p.objective_policies < 1
      or p.evidence_policies < 1 or p.reward_policies < 1 then 'quest_policy_incomplete'
    when t.objective_evidence_guards < 1 or t.completion_guards < 1
      or t.objective_set_guards < 1 or t.append_only_guards < 1
      then 'quest_guard_incomplete'
    when g.authenticated_write_grants > 0
      then 'quest_client_write_grant_present'
    else 'installed_quest_foundation'
  end,
  'tables', jsonb_build_object(
    'quests', i.quests_table,
    'secrets', i.secrets_table,
    'objectives', i.objectives_table,
    'evidence', i.evidence_table,
    'rewards', i.rewards_table,
    'campaign_moments', i.moments_table
  ),
  'policies', to_jsonb(p),
  'guards', to_jsonb(t),
  'authenticated', jsonb_build_object(
    'write_grants', g.authenticated_write_grants,
    'can_select_quests', has_table_privilege('authenticated',i.quests_table,'SELECT'),
    'can_insert_quests', has_table_privilege('authenticated',i.quests_table,'INSERT'),
    'can_update_objectives', has_table_privilege('authenticated',i.objectives_table,'UPDATE'),
    'can_delete_evidence', has_table_privilege('authenticated',i.evidence_table,'DELETE')
  )
)
from installed i cross join policy_counts p cross join trigger_counts t cross join grant_counts g;
