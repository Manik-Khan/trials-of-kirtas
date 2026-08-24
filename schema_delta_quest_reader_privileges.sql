-- schema_delta_quest_reader_privileges.sql — restore the guarded Quest Log's
-- authenticated role to SELECT-only after Supabase default table grants.
-- Prepared 2026-08-23. Apply after schema_delta_quests.sql.
--
-- The original migration is applied history. This additive correction removes
-- every table/column privilege from authenticated, then grants back only the
-- reader capability required by quests.js.

revoke all privileges on table public.quests, public.quest_secrets,
  public.quest_objectives, public.quest_objective_evidence,
  public.quest_rewards from authenticated;

grant select on table public.quests, public.quest_secrets,
  public.quest_objectives, public.quest_objective_evidence,
  public.quest_rewards to authenticated;
