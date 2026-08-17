-- schema_delta_item_management.sql — atomic identification + public rename; prepared 2026-08-16.
-- Requires the applied provenance/adoption deltas. Transfer remains owned by
-- the already-applied transfer_item RPC. Append-only: do not rewrite earlier deltas.

create or replace function public.identify_item(
  p_item_id text,
  p_event_id text default null,
  p_summary text default '',
  p_occurred_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid            uuid := auth.uid();
  v_item           public.item_instances%rowtype;
  v_secret         public.item_secrets%rowtype;
  v_event          public.item_events%rowtype;
  v_inventory      jsonb;
  v_inventory_next jsonb;
  v_inventory_item jsonb := null;
  v_matches        integer;
  v_old_name       text;
  v_actor_key      text;
  v_event_id       text;
  v_summary        text;
begin
  if v_uid is null then raise exception 'You must be signed in to identify an item.'; end if;
  if not public.is_staff() then raise exception 'Only campaign staff may identify an item.'; end if;
  p_item_id := nullif(btrim(coalesce(p_item_id, '')), '');
  if p_item_id is null then raise exception 'The item id is required.'; end if;

  select * into v_item from public.item_instances where id = p_item_id for update;
  if not found then raise exception 'The tracked item was not found.'; end if;
  if v_item.identification = 'identified' then raise exception 'This item is already identified.'; end if;
  select * into v_secret from public.item_secrets where item_id = p_item_id for update;
  if not found then raise exception 'No prepared staff truth exists for this item.'; end if;
  v_old_name := v_item.display_name;

  if v_item.status = 'held' and v_item.current_bearer_key is not null then
    select inventory into v_inventory
      from public.characters
     where key = v_item.current_bearer_key
     for update;
    if not found then raise exception 'The current bearer no longer exists.'; end if;
    if jsonb_typeof(v_inventory) <> 'array' then raise exception 'The current bearer inventory is malformed.'; end if;
    select count(*)::integer into v_matches
      from jsonb_array_elements(v_inventory) as entry(value)
     where entry.value ->> 'instanceId' = p_item_id;
    if v_matches <> 1 then raise exception 'The current bearer inventory must contain exactly one copy of this tracked item.'; end if;
    select jsonb_agg(
             case when entry.value ->> 'instanceId' = p_item_id
               then entry.value || jsonb_build_object(
                 'name', v_secret.true_name,
                 'rarity', v_secret.rarity,
                 'identification', 'identified',
                 'flavor', v_secret.public_description
               )
               else entry.value end
             order by entry.ordinality
           )
      into v_inventory_next
      from jsonb_array_elements(v_inventory) with ordinality as entry(value, ordinality);
    update public.characters
       set inventory = v_inventory_next,
           updated_at = now()
     where key = v_item.current_bearer_key;
    select entry.value into v_inventory_item
      from jsonb_array_elements(v_inventory_next) as entry(value)
     where entry.value ->> 'instanceId' = p_item_id;
  end if;

  update public.item_instances
     set definition_key = v_secret.definition_key,
         display_name = v_secret.true_name,
         public_description = v_secret.public_description,
         rarity = v_secret.rarity,
         identification = 'identified',
         mechanics = v_secret.mechanics,
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  select character_key into v_actor_key from public.profiles where user_id = v_uid;
  v_event_id := coalesce(nullif(btrim(coalesce(p_event_id, '')), ''), 'itemev_' || gen_random_uuid()::text);
  v_summary := coalesce(nullif(btrim(coalesce(p_summary, '')), ''), v_old_name || ' was identified as ' || v_item.display_name || '.');
  insert into public.item_events (
    id, item_id, event_type, occurred_at, actor_character_key, actor_user_id, summary, data
  ) values (
    v_event_id, p_item_id, 'identified', coalesce(p_occurred_at, now()),
    v_actor_key, v_uid, v_summary,
    jsonb_build_object('oldDisplayName', v_old_name, 'newDisplayName', v_item.display_name)
  ) returning * into v_event;

  return jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'event', to_jsonb(v_event), 'inventoryItem', v_inventory_item);
end;
$$;

create or replace function public.rename_item(
  p_item_id text,
  p_new_name text,
  p_event_id text default null,
  p_summary text default '',
  p_occurred_at timestamptz default now()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid            uuid := auth.uid();
  v_item           public.item_instances%rowtype;
  v_event          public.item_events%rowtype;
  v_inventory      jsonb;
  v_inventory_next jsonb;
  v_inventory_item jsonb := null;
  v_matches        integer;
  v_old_name       text;
  v_actor_key      text;
  v_event_id       text;
  v_summary        text;
begin
  if v_uid is null then raise exception 'You must be signed in to rename an item.'; end if;
  if not public.is_staff() then raise exception 'Only campaign staff may rename an item.'; end if;
  p_item_id := nullif(btrim(coalesce(p_item_id, '')), '');
  p_new_name := nullif(btrim(coalesce(p_new_name, '')), '');
  if p_item_id is null then raise exception 'The item id is required.'; end if;
  if p_new_name is null then raise exception 'A new public item name is required.'; end if;

  select * into v_item from public.item_instances where id = p_item_id for update;
  if not found then raise exception 'The tracked item was not found.'; end if;
  if v_item.display_name = p_new_name then raise exception 'Choose a different public name.'; end if;
  v_old_name := v_item.display_name;

  if v_item.status = 'held' and v_item.current_bearer_key is not null then
    select inventory into v_inventory
      from public.characters
     where key = v_item.current_bearer_key
     for update;
    if not found then raise exception 'The current bearer no longer exists.'; end if;
    if jsonb_typeof(v_inventory) <> 'array' then raise exception 'The current bearer inventory is malformed.'; end if;
    select count(*)::integer into v_matches
      from jsonb_array_elements(v_inventory) as entry(value)
     where entry.value ->> 'instanceId' = p_item_id;
    if v_matches <> 1 then raise exception 'The current bearer inventory must contain exactly one copy of this tracked item.'; end if;
    select jsonb_agg(
             case when entry.value ->> 'instanceId' = p_item_id
               then entry.value || jsonb_build_object('name', p_new_name)
               else entry.value end
             order by entry.ordinality
           )
      into v_inventory_next
      from jsonb_array_elements(v_inventory) with ordinality as entry(value, ordinality);
    update public.characters
       set inventory = v_inventory_next,
           updated_at = now()
     where key = v_item.current_bearer_key;
    select entry.value into v_inventory_item
      from jsonb_array_elements(v_inventory_next) as entry(value)
     where entry.value ->> 'instanceId' = p_item_id;
  end if;

  update public.item_instances
     set display_name = p_new_name,
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  select character_key into v_actor_key from public.profiles where user_id = v_uid;
  v_event_id := coalesce(nullif(btrim(coalesce(p_event_id, '')), ''), 'itemev_' || gen_random_uuid()::text);
  v_summary := coalesce(nullif(btrim(coalesce(p_summary, '')), ''), v_old_name || ' became known as ' || p_new_name || '.');
  insert into public.item_events (
    id, item_id, event_type, occurred_at, actor_character_key, actor_user_id, summary, data
  ) values (
    v_event_id, p_item_id, 'renamed', coalesce(p_occurred_at, now()),
    v_actor_key, v_uid, v_summary,
    jsonb_build_object('oldDisplayName', v_old_name, 'newDisplayName', p_new_name)
  ) returning * into v_event;

  return jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'event', to_jsonb(v_event), 'inventoryItem', v_inventory_item);
end;
$$;

revoke all on function public.identify_item(text, text, text, timestamptz) from public, anon;
revoke all on function public.rename_item(text, text, text, text, timestamptz) from public, anon;
grant execute on function public.identify_item(text, text, text, timestamptz) to authenticated;
grant execute on function public.rename_item(text, text, text, text, timestamptz) to authenticated;
