-- schema_delta_quest_rich_length_validation.sql
-- Prepared 2026-08-26. Apply after schema_delta_quest_authoring.sql.
--
-- Rich quest prose is stored in a safe JSON envelope. The original authoring
-- RPC measured that storage envelope against the person-facing 500 / 5000
-- character limits, so paragraph breaks and linked mentions could reject a
-- short objective. Keep bounded raw storage, but enforce writing limits against
-- the readable text represented by the envelope.

create or replace function public.quest_rich_visible_length(p_value text)
returns integer
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_prefix constant text := 'tok-quest-rich-v1:';
  v_doc jsonb;
  v_block jsonb;
  v_inline jsonb;
  v_length integer := 0;
  v_has_paragraph boolean := false;
begin
  if left(p_value, length(v_prefix)) <> v_prefix then
    return length(p_value);
  end if;

  begin
    v_doc := substring(p_value from length(v_prefix) + 1)::jsonb;
  exception when others then
    return length(p_value);
  end;

  if jsonb_typeof(v_doc) <> 'object'
     or jsonb_typeof(v_doc -> 'content') <> 'array' then
    return length(p_value);
  end if;

  for v_block in select value from jsonb_array_elements(v_doc -> 'content') loop
    if jsonb_typeof(v_block) <> 'object'
       or v_block ->> 'type' <> 'paragraph' then
      continue;
    end if;
    if v_has_paragraph then v_length := v_length + 1; end if;
    v_has_paragraph := true;
    if jsonb_typeof(v_block -> 'content') <> 'array' then continue; end if;

    for v_inline in select value from jsonb_array_elements(v_block -> 'content') loop
      if v_inline ->> 'type' = 'text' then
        v_length := v_length + length(coalesce(v_inline ->> 'text', ''));
      elsif v_inline ->> 'type' = 'tokMention' then
        v_length := v_length + 1 + length(coalesce(v_inline #>> '{attrs,label}', ''));
      elsif v_inline ->> 'type' = 'hardBreak' then
        v_length := v_length + 1;
      end if;
    end loop;
  end loop;

  return v_length;
exception when others then
  return length(p_value);
end;
$$;

revoke all on function public.quest_rich_visible_length(text) from public, anon, authenticated;

do $$
declare
  v_signature constant regprocedure :=
    'public.create_quest(uuid,text,text,text,text,text,text,text,text,bigint,uuid)'::regprocedure;
  v_definition text;
  v_old_description constant text :=
    'if length(v_description) > 5000 then raise exception ''Keep the quest description under 5000 characters.''; end if;';
  v_new_description constant text :=
    'if length(v_description) > 50000 then raise exception ''Formatted quest description data is too large.''; end if;' || E'\n  ' ||
    'if public.quest_rich_visible_length(v_description) > 5000 then raise exception ''Keep the quest description under 5000 characters.''; end if;';
  v_old_objective constant text :=
    'if length(v_objective_title) > 500 then raise exception ''Keep the first objective under 500 characters.''; end if;';
  v_new_objective constant text :=
    'if length(v_objective_title) > 10000 then raise exception ''Formatted objective data is too large.''; end if;' || E'\n  ' ||
    'if public.quest_rich_visible_length(v_objective_title) > 500 then raise exception ''Keep the first objective under 500 characters.''; end if;';
begin
  select pg_get_functiondef(v_signature) into v_definition;
  if position('quest_rich_visible_length(v_description)' in v_definition) > 0
     and position('quest_rich_visible_length(v_objective_title)' in v_definition) > 0 then
    return;
  end if;
  if position(v_old_description in v_definition) = 0
     or position(v_old_objective in v_definition) = 0 then
    raise exception 'create_quest length guards did not match the installed authoring foundation; no change was applied';
  end if;

  v_definition := replace(v_definition, v_old_description, v_new_description);
  v_definition := replace(v_definition, v_old_objective, v_new_objective);
  execute v_definition;
end;
$$;

do $$
declare
  v_definition text := pg_get_functiondef(
    'public.create_quest(uuid,text,text,text,text,text,text,text,text,bigint,uuid)'::regprocedure
  );
  v_example text := 'tok-quest-rich-v1:{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"We need to reach "},{"type":"tokMention","attrs":{"type":"location","key":"veren-s-watch","label":"Veren''s Watch","resolved":true}},{"type":"text","text":" and find out what happened to it."}]},{"type":"paragraph","content":[]},{"type":"paragraph","content":[{"type":"text","text":"What happened to the guard there?"}]},{"type":"paragraph","content":[]},{"type":"paragraph","content":[{"type":"text","text":"Why has trade stopped?"}]}]}';
begin
  if public.quest_rich_visible_length(v_example) <> 124 then
    raise exception 'rich quest length helper did not count the known objective correctly';
  end if;
  if position('quest_rich_visible_length(v_objective_title)' in v_definition) = 0
     or position('quest_rich_visible_length(v_description)' in v_definition) = 0 then
    raise exception 'create_quest did not adopt readable-text validation';
  end if;
end;
$$;
