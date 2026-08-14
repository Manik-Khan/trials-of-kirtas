-- schema_delta_item_transfer.sql — atomic notable-item trade RPC; prepared 2026-08-14, NOT YET APPLIED.
-- Requires schema_delta_item_provenance.sql. The characters/profiles authority
-- was captured from live with ITEM-TRANSFER-PREFLIGHT.sql on 2026-08-14:
-- characters.key PK; inventory jsonb NOT NULL default []; delete_marked boolean;
-- approved members share UPDATE through characters_party_update; the live
-- characters_guard trigger pins key/owner/created_at; both tables are realtime.
-- Append-only: do not fold this function back into the provenance migration.

create or replace function public.transfer_item(
  p_item_id                    text,
  p_expected_from_character_key text,
  p_to_character_key          text,
  p_event_id                  text        default null,
  p_occurred_at               timestamptz default now(),
  p_summary                   text        default '',
  p_session_id                text        default null,
  p_location_id               text        default null,
  p_moment_id                 text        default null,
  p_encounter_id              text        default null,
  p_journal_page_id           text        default null,
  p_feed_post_id              text        default null,
  p_battle_map_id             text        default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid                   uuid := auth.uid();
  v_item                  public.item_instances%rowtype;
  v_event                 public.item_events%rowtype;
  v_source_inventory      jsonb;
  v_destination_inventory jsonb;
  v_source_next           jsonb;
  v_destination_next      jsonb;
  v_moved                 jsonb;
  v_source_deleted        boolean;
  v_destination_deleted   boolean;
  v_source_matches        integer;
  v_destination_matches   integer;
  v_container_key         text;
  v_child_count           integer;
  v_actor_character_key   text;
  v_event_id              text;
  v_summary               text;
begin
  if v_uid is null then
    raise exception 'You must be signed in to transfer an item.';
  end if;
  if not public.is_member() then
    raise exception 'Only an approved campaign member may transfer an item.';
  end if;

  p_item_id := nullif(btrim(coalesce(p_item_id, '')), '');
  p_expected_from_character_key := nullif(btrim(coalesce(p_expected_from_character_key, '')), '');
  p_to_character_key := nullif(btrim(coalesce(p_to_character_key, '')), '');
  if p_item_id is null then raise exception 'The item id is required.'; end if;
  if p_expected_from_character_key is null then raise exception 'The current bearer is required.'; end if;
  if p_to_character_key is null then raise exception 'The destination character is required.'; end if;
  if p_expected_from_character_key = p_to_character_key then
    raise exception 'The destination must be a different character.';
  end if;

  -- The canonical item is the concurrency spine. A stale client cannot move it
  -- after somebody else has already changed custody.
  select * into v_item
    from public.item_instances
   where id = p_item_id
   for update;
  if not found then raise exception 'Item % was not found.', p_item_id; end if;
  if v_item.status <> 'held' then
    raise exception 'Item % is not currently held and cannot be traded.', p_item_id;
  end if;
  if v_item.current_bearer_key is distinct from p_expected_from_character_key then
    raise exception 'The item bearer changed; refresh before trading.';
  end if;

  -- Lock both character rows in stable key order so simultaneous opposite-way
  -- trades cannot deadlock or overwrite one another's inventory arrays.
  perform 1
    from public.characters
   where key in (p_expected_from_character_key, p_to_character_key)
   order by key
   for update;

  select inventory, delete_marked
    into v_source_inventory, v_source_deleted
    from public.characters
   where key = p_expected_from_character_key;
  if not found then raise exception 'The current bearer no longer exists.'; end if;

  select inventory, delete_marked
    into v_destination_inventory, v_destination_deleted
    from public.characters
   where key = p_to_character_key;
  if not found then raise exception 'The destination character does not exist.'; end if;
  if v_source_deleted then raise exception 'The current bearer is archived and cannot trade items.'; end if;
  if v_destination_deleted then raise exception 'The destination character is archived and cannot receive items.'; end if;
  if jsonb_typeof(v_source_inventory) <> 'array' or jsonb_typeof(v_destination_inventory) <> 'array' then
    raise exception 'A character inventory is malformed; repair it before trading.';
  end if;

  select count(*)::integer
    into v_source_matches
    from jsonb_array_elements(v_source_inventory) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id;
  if v_source_matches = 0 then
    raise exception 'The item is not in the current bearer inventory; refresh before trading.';
  end if;
  if v_source_matches > 1 then
    raise exception 'The current bearer inventory contains duplicate copies of this item.';
  end if;

  select entry.value
    into v_moved
    from jsonb_array_elements(v_source_inventory) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id;

  -- Stable UI identity follows the permanent instance id. A destination-side
  -- id collision would make the gear manager address the wrong row.
  select count(*)::integer
    into v_destination_matches
    from jsonb_array_elements(v_destination_inventory) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id
      or entry.value ->> 'id' = p_item_id;
  if v_destination_matches > 0 then
    raise exception 'The destination inventory already contains this item id.';
  end if;

  -- A bag cannot leave its contents behind with orphaned containerId values.
  -- Empty it on the sheet first; the UI can narrate this exception directly.
  v_container_key := nullif(v_moved ->> 'id', '');
  if v_container_key is not null then
    select count(*)::integer
      into v_child_count
      from jsonb_array_elements(v_source_inventory) as entry(value)
     where entry.value ->> 'containerId' = v_container_key
       and entry.value ->> 'instanceId' is distinct from p_item_id;
    if v_child_count > 0 then
      raise exception 'Empty this container before transferring it.';
    end if;
  end if;

  select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
    into v_source_next
    from jsonb_array_elements(v_source_inventory) with ordinality as entry(value, ordinality)
   where entry.value ->> 'instanceId' is distinct from p_item_id;

  v_moved := v_moved || jsonb_build_object(
    'id', p_item_id,
    'instanceId', p_item_id,
    'slot', null,
    'attuned', false,
    'containerId', null
  );
  v_destination_next := v_destination_inventory || jsonb_build_array(v_moved);

  update public.characters
     set inventory = v_source_next,
         updated_at = now()
   where key = p_expected_from_character_key;

  update public.characters
     set inventory = v_destination_next,
         updated_at = now()
   where key = p_to_character_key;

  update public.item_instances
     set current_bearer_key = p_to_character_key,
         current_location_id = null,
         status = 'held',
         slot = null,
         attuned = false,
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  select character_key into v_actor_character_key
    from public.profiles
   where user_id = v_uid;
  v_event_id := coalesce(nullif(btrim(coalesce(p_event_id, '')), ''), 'itemev_' || gen_random_uuid()::text);
  v_summary := coalesce(nullif(btrim(coalesce(p_summary, '')), ''),
    'Transferred from ' || p_expected_from_character_key || ' to ' || p_to_character_key || '.');

  insert into public.item_events (
    id, item_id, event_type, occurred_at, actor_character_key, actor_user_id,
    summary, data, session_id, location_id, moment_id, encounter_id,
    journal_page_id, feed_post_id, battle_map_id
  ) values (
    v_event_id, p_item_id, 'transferred', coalesce(p_occurred_at, now()),
    v_actor_character_key, v_uid, v_summary,
    jsonb_build_object(
      'fromCharacterKey', p_expected_from_character_key,
      'toCharacterKey', p_to_character_key
    ),
    nullif(btrim(coalesce(p_session_id, '')), ''),
    nullif(btrim(coalesce(p_location_id, '')), ''),
    nullif(btrim(coalesce(p_moment_id, '')), ''),
    nullif(btrim(coalesce(p_encounter_id, '')), ''),
    nullif(btrim(coalesce(p_journal_page_id, '')), ''),
    nullif(btrim(coalesce(p_feed_post_id, '')), ''),
    nullif(btrim(coalesce(p_battle_map_id, '')), '')
  ) returning * into v_event;

  return jsonb_build_object(
    'ok', true,
    'item', to_jsonb(v_item),
    'event', to_jsonb(v_event),
    'fromCharacterKey', p_expected_from_character_key,
    'toCharacterKey', p_to_character_key
  );
end;
$$;

revoke all on function public.transfer_item(
  text, text, text, text, timestamptz, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.transfer_item(
  text, text, text, text, timestamptz, text, text, text, text, text, text, text, text
) to authenticated;

