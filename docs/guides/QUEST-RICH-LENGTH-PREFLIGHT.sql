-- Read-only check after schema_delta_quest_rich_length_validation.sql.
with installed as (
  select
    to_regprocedure('public.quest_rich_visible_length(text)') as length_helper,
    to_regprocedure('public.create_quest(uuid,text,text,text,text,text,text,text,text,bigint,uuid)') as create_rpc
), inspected as (
  select i.*,
    case when i.create_rpc is null then ''
      else pg_get_functiondef(i.create_rpc) end as create_definition
  from installed i
)
select jsonb_build_object(
  'status', case
    when length_helper is null or create_rpc is null then 'quest_rich_length_not_installed'
    when position('quest_rich_visible_length(v_objective_title)' in create_definition) = 0
      or position('quest_rich_visible_length(v_description)' in create_definition) = 0
      then 'create_quest_not_using_readable_length'
    else 'installed_quest_rich_length_validation'
  end,
  'known_answer_expected', 124,
  'authenticated_execute', case when create_rpc is null then null
    else has_function_privilege('authenticated', create_rpc, 'EXECUTE') end,
  'anonymous_execute', case when create_rpc is null then null
    else has_function_privilege('anon', create_rpc, 'EXECUTE') end
)
from inspected;
