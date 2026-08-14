-- schema_delta_item_adoption.sql — staff-only inventory adoption RPC; prepared 2026-08-14, NOT YET APPLIED.
-- Requires schema_delta_item_provenance.sql. Converts one deliberately selected,
-- quantity-one inventory row into a durable item instance; optionally stores an
-- unrevealed secret; and appends recovery + initial-assignment history with the
-- supplied campaign links. The whole operation is one transaction.

create or replace function public.adopt_inventory_item(
  p_character_key   text,
  p_inventory_index integer,
  p_expected_item   jsonb,
  p_public          jsonb default '{}'::jsonb,
  p_secret          jsonb default null,
  p_context         jsonb default '{}'::jsonb,
  p_item_id         text  default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                    uuid := auth.uid();
  v_inventory              jsonb;
  v_inventory_next         jsonb;
  v_original               jsonb;
  v_inventory_item         jsonb;
  v_inventory_fields       jsonb;
  v_character_deleted      boolean;
  v_item_id                text;
  v_ui_id                  text;
  v_display_name           text;
  v_public_description     text;
  v_identification         text;
  v_definition_key         text;
  v_rarity_input           text;
  v_rarity                 text;
  v_mechanics              jsonb;
  v_secret_true_name       text;
  v_secret_definition_key  text;
  v_secret_rarity_input    text;
  v_secret_rarity          text;
  v_secret_description     text;
  v_secret_mechanics       jsonb;
  v_secret_lore            text;
  v_slot                    text;
  v_attuned                 boolean;
  v_actor_character_key    text;
  v_occurred_at             timestamptz;
  v_recovery_event_id       text;
  v_assignment_event_id     text;
  v_recovery_summary        text;
  v_assignment_summary      text;
  v_item                    public.item_instances%rowtype;
  v_recovery_event          public.item_events%rowtype;
  v_assignment_event        public.item_events%rowtype;
begin
  if v_uid is null then
    raise exception 'You must be signed in to track an item.';
  end if;
  if not public.is_staff() then
    raise exception 'Only campaign staff may begin an item history.';
  end if;

  p_character_key := nullif(btrim(coalesce(p_character_key, '')), '');
  if p_character_key is null then raise exception 'The bearer character is required.'; end if;
  if p_inventory_index is null or p_inventory_index < 0 then
    raise exception 'A valid inventory position is required.';
  end if;
  if p_expected_item is null or jsonb_typeof(p_expected_item) <> 'object' then
    raise exception 'The expected inventory item is required for stale-state protection.';
  end if;
  if p_public is null or jsonb_typeof(p_public) <> 'object' then
    raise exception 'Public item details must be a JSON object.';
  end if;
  if p_secret is not null and jsonb_typeof(p_secret) <> 'object' then
    raise exception 'Secret item details must be a JSON object.';
  end if;
  if p_context is null or jsonb_typeof(p_context) <> 'object' then
    raise exception 'Item history context must be a JSON object.';
  end if;

  select inventory, delete_marked
    into v_inventory, v_character_deleted
    from public.characters
   where key = p_character_key
   for update;
  if not found then raise exception 'The bearer character does not exist.'; end if;
  if v_character_deleted then raise exception 'An archived character cannot begin an item history.'; end if;
  if jsonb_typeof(v_inventory) <> 'array' then
    raise exception 'The character inventory is malformed; repair it before tracking an item.';
  end if;
  if p_inventory_index >= jsonb_array_length(v_inventory) then
    raise exception 'That inventory position no longer exists; refresh before tracking.';
  end if;

  v_original := v_inventory -> p_inventory_index;
  if v_original is distinct from p_expected_item then
    raise exception 'The selected inventory item changed; refresh before tracking.';
  end if;
  if nullif(v_original ->> 'instanceId', '') is not null then
    raise exception 'This item is already part of campaign history.';
  end if;
  if coalesce(nullif(v_original ->> 'qty', '')::numeric, 1) <> 1 then
    raise exception 'Split this stack to one item before beginning its history.';
  end if;

  v_item_id := coalesce(nullif(btrim(coalesce(p_item_id, '')), ''), 'item_' || gen_random_uuid()::text);
  if exists (select 1 from public.item_instances where id = v_item_id) then
    raise exception 'Item id % already exists.', v_item_id;
  end if;
  if exists (
    select 1
      from jsonb_array_elements(v_inventory) with ordinality as entry(value, ordinality)
     where entry.ordinality <> p_inventory_index + 1
       and (entry.value ->> 'instanceId' = v_item_id or entry.value ->> 'id' = v_item_id)
  ) then
    raise exception 'Another inventory row already uses item id %.', v_item_id;
  end if;

  v_identification := lower(coalesce(nullif(btrim(p_public ->> 'identification'), ''),
    case when p_secret is null then 'identified' else 'unidentified' end));
  if v_identification not in ('unidentified', 'identified') then
    raise exception 'Identification must be unidentified or identified.';
  end if;

  v_display_name := coalesce(
    nullif(btrim(p_public ->> 'displayName'), ''),
    nullif(btrim(v_original ->> 'name'), '')
  );
  if v_display_name is null then raise exception 'A public item name is required.'; end if;
  v_public_description := coalesce(p_public ->> 'publicDescription', '');
  v_definition_key := nullif(btrim(p_public ->> 'definitionKey'), '');
  v_rarity_input := nullif(lower(btrim(p_public ->> 'rarity')), '');
  v_rarity := case v_rarity_input
    when 'common' then 'Common'
    when 'uncommon' then 'Uncommon'
    when 'rare' then 'Rare'
    when 'very rare' then 'Very Rare'
    when 'legendary' then 'Legendary'
    when 'artifact' then 'Artifact'
    else null
  end;
  if v_rarity_input is not null and v_rarity is null then
    raise exception 'Public rarity must use the campaign rarity vocabulary.';
  end if;
  v_mechanics := coalesce(p_public -> 'mechanics', '{}'::jsonb);
  v_inventory_fields := coalesce(p_public -> 'inventoryFields', '{}'::jsonb);
  if jsonb_typeof(v_mechanics) <> 'object' or jsonb_typeof(v_inventory_fields) <> 'object' then
    raise exception 'Public mechanics and inventory fields must be JSON objects.';
  end if;
  if v_identification = 'unidentified'
     and (v_definition_key is not null or v_rarity is not null or v_mechanics <> '{}'::jsonb) then
    raise exception 'Unidentified public details cannot reveal definition, rarity, or mechanics.';
  end if;

  if v_identification = 'unidentified' and p_secret is null then
    raise exception 'An unidentified tracked item requires staff-only secret details.';
  end if;
  if p_secret is not null then
    v_secret_true_name := coalesce(nullif(btrim(p_secret ->> 'trueName'), ''),
      case when v_identification = 'identified' then v_display_name else null end);
    if v_secret_true_name is null then raise exception 'The secret true name is required.'; end if;
    v_secret_definition_key := coalesce(nullif(btrim(p_secret ->> 'definitionKey'), ''), v_definition_key);
    v_secret_rarity_input := coalesce(nullif(lower(btrim(p_secret ->> 'rarity')), ''), lower(v_rarity));
    v_secret_rarity := case v_secret_rarity_input
      when 'common' then 'Common'
      when 'uncommon' then 'Uncommon'
      when 'rare' then 'Rare'
      when 'very rare' then 'Very Rare'
      when 'legendary' then 'Legendary'
      when 'artifact' then 'Artifact'
      else null
    end;
    if v_secret_rarity is null then raise exception 'The secret rarity is required and must use the campaign vocabulary.'; end if;
    v_secret_description := coalesce(p_secret ->> 'publicDescription', v_public_description);
    v_secret_mechanics := coalesce(p_secret -> 'mechanics', v_mechanics, '{}'::jsonb);
    if jsonb_typeof(v_secret_mechanics) <> 'object' then
      raise exception 'Secret mechanics must be a JSON object.';
    end if;
    v_secret_lore := coalesce(p_secret ->> 'lore', '');
  end if;

  v_ui_id := coalesce(nullif(v_original ->> 'id', ''), v_item_id);
  v_slot := nullif(v_original ->> 'slot', '');
  v_attuned := coalesce(nullif(v_original ->> 'attuned', '')::boolean, false);

  if v_identification = 'unidentified' then
    -- Explicit allowlist: enriched importer rules cannot leak through the smoky
    -- party projection. Staff may add known physical facts via inventoryFields.
    v_inventory_item := jsonb_strip_nulls(jsonb_build_object(
      'id', v_ui_id,
      'name', v_display_name,
      'qty', v_original -> 'qty',
      'weight', v_original -> 'weight',
      'icon', v_original -> 'icon',
      'isContainer', v_original -> 'isContainer',
      'containerId', v_original -> 'containerId',
      'slot', v_original -> 'slot',
      'attuned', v_original -> 'attuned',
      'locked', v_original -> 'locked',
      'flavor', v_public_description
    )) || v_inventory_fields;
  else
    v_inventory_item := v_original || v_inventory_fields;
  end if;
  v_inventory_item := v_inventory_item || jsonb_build_object(
    'id', v_ui_id,
    'instanceId', v_item_id,
    'name', v_display_name,
    'rarity', v_rarity,
    'identification', v_identification,
    '_tracked', true
  );

  insert into public.item_instances (
    id, definition_key, display_name, public_description, rarity,
    identification, mechanics, status, current_bearer_key,
    current_location_id, slot, attuned, created_by
  ) values (
    v_item_id,
    case when v_identification = 'identified' then v_definition_key else null end,
    v_display_name, v_public_description,
    case when v_identification = 'identified' then v_rarity else null end,
    v_identification,
    case when v_identification = 'identified' then v_mechanics else '{}'::jsonb end,
    'held', p_character_key, null, v_slot, v_attuned, v_uid
  ) returning * into v_item;

  if p_secret is not null then
    insert into public.item_secrets (
      item_id, true_name, definition_key, rarity, public_description,
      mechanics, lore, created_by
    ) values (
      v_item_id, v_secret_true_name, v_secret_definition_key, v_secret_rarity,
      v_secret_description, v_secret_mechanics, v_secret_lore, v_uid
    );
  end if;

  v_inventory_next := jsonb_set(
    v_inventory,
    array[p_inventory_index::text],
    v_inventory_item,
    false
  );
  update public.characters
     set inventory = v_inventory_next,
         updated_at = now()
   where key = p_character_key;

  select character_key into v_actor_character_key
    from public.profiles
   where user_id = v_uid;
  v_occurred_at := coalesce(nullif(p_context ->> 'occurredAt', '')::timestamptz, now());
  v_recovery_event_id := coalesce(nullif(btrim(p_context ->> 'recoveryEventId'), ''), 'itemev_' || gen_random_uuid()::text);
  v_assignment_event_id := coalesce(nullif(btrim(p_context ->> 'assignmentEventId'), ''), 'itemev_' || gen_random_uuid()::text);
  if v_recovery_event_id = v_assignment_event_id then
    raise exception 'Recovery and assignment event ids must be different.';
  end if;
  v_recovery_summary := coalesce(nullif(btrim(p_context ->> 'recoverySummary'), ''), 'Recovered ' || v_display_name || '.');
  v_assignment_summary := coalesce(nullif(btrim(p_context ->> 'assignmentSummary'), ''), 'Entrusted ' || v_display_name || ' to ' || p_character_key || '.');

  insert into public.item_events (
    id, item_id, event_type, occurred_at, actor_character_key, actor_user_id,
    summary, data, session_id, location_id, moment_id, encounter_id,
    journal_page_id, feed_post_id, battle_map_id
  ) values (
    v_recovery_event_id, v_item_id, 'recovered', v_occurred_at,
    v_actor_character_key, v_uid, v_recovery_summary,
    jsonb_build_object('locationId', nullif(btrim(p_context ->> 'locationId'), '')),
    nullif(btrim(p_context ->> 'sessionId'), ''),
    nullif(btrim(p_context ->> 'locationId'), ''),
    nullif(btrim(p_context ->> 'momentId'), ''),
    nullif(btrim(p_context ->> 'encounterId'), ''),
    nullif(btrim(p_context ->> 'journalPageId'), ''),
    nullif(btrim(p_context ->> 'feedPostId'), ''),
    nullif(btrim(p_context ->> 'battleMapId'), '')
  ) returning * into v_recovery_event;

  insert into public.item_events (
    id, item_id, event_type, occurred_at, actor_character_key, actor_user_id,
    summary, data, session_id, location_id, moment_id, encounter_id,
    journal_page_id, feed_post_id, battle_map_id
  ) values (
    v_assignment_event_id, v_item_id, 'assigned', v_occurred_at,
    v_actor_character_key, v_uid, v_assignment_summary,
    jsonb_build_object('toCharacterKey', p_character_key),
    nullif(btrim(p_context ->> 'sessionId'), ''),
    nullif(btrim(p_context ->> 'locationId'), ''),
    nullif(btrim(p_context ->> 'momentId'), ''),
    nullif(btrim(p_context ->> 'encounterId'), ''),
    nullif(btrim(p_context ->> 'journalPageId'), ''),
    nullif(btrim(p_context ->> 'feedPostId'), ''),
    nullif(btrim(p_context ->> 'battleMapId'), '')
  ) returning * into v_assignment_event;

  return jsonb_build_object(
    'ok', true,
    'item', to_jsonb(v_item),
    'inventoryItem', v_inventory_item,
    'recoveryEvent', to_jsonb(v_recovery_event),
    'assignmentEvent', to_jsonb(v_assignment_event)
  );
end;
$$;

revoke all on function public.adopt_inventory_item(
  text, integer, jsonb, jsonb, jsonb, jsonb, text
) from public, anon;
grant execute on function public.adopt_inventory_item(
  text, integer, jsonb, jsonb, jsonb, jsonb, text
) to authenticated;

