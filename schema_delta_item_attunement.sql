-- schema_delta_item_attunement.sql — durable attunement rule + atomic bearer state; prepared 2026-08-16.
-- Requires the applied provenance, adoption, and transfer item deltas. Append-only:
-- do not fold this field or either RPC back into an applied migration.

alter table public.item_instances
  add column if not exists requires_attunement boolean not null default false;

-- Preserve any requirement already present on a tracked Gear row. Historical
-- importer values may be boolean true or the string "Requires Attunement".
update public.item_instances
   set requires_attunement = true
 where attuned = true;

update public.item_instances as item
   set requires_attunement = true
 where exists (
   select 1
     from public.characters as character
     cross join lateral jsonb_array_elements(character.inventory) as entry(value)
    where entry.value ->> 'instanceId' = item.id
      and (
        lower(coalesce(entry.value ->> 'reqAttune', '')) in ('true', 'required', 'requires attunement')
        or lower(coalesce(entry.value ->> 'attuned', '')) = 'true'
      )
 );

alter table public.item_instances
  drop constraint if exists item_instances_attunement_check;
alter table public.item_instances
  add constraint item_instances_attunement_check
  check (requires_attunement or attuned = false);

create or replace function public.set_item_attunement_requirement(
  p_item_id text,
  p_requires_attunement boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid            uuid := auth.uid();
  v_item           public.item_instances%rowtype;
  v_inventory      jsonb;
  v_inventory_next jsonb;
  v_inventory_item jsonb;
  v_matches        integer;
begin
  if v_uid is null then raise exception 'You must be signed in to manage an item.'; end if;
  if not public.is_staff() then raise exception 'Only campaign staff may set an item attunement requirement.'; end if;
  p_item_id := nullif(btrim(coalesce(p_item_id, '')), '');
  if p_item_id is null then raise exception 'The item id is required.'; end if;
  if p_requires_attunement is null then raise exception 'Choose whether this item requires attunement.'; end if;

  select * into v_item from public.item_instances where id = p_item_id for update;
  if not found then raise exception 'The tracked item was not found.'; end if;
  if v_item.status <> 'held' or v_item.current_bearer_key is null then
    raise exception 'Only an item held by a character can change its attunement requirement.';
  end if;

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
               'reqAttune', p_requires_attunement,
               'attuned', case when p_requires_attunement then v_item.attuned else false end
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

  update public.item_instances
     set requires_attunement = p_requires_attunement,
         attuned = case when p_requires_attunement then attuned else false end,
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  select entry.value into v_inventory_item
    from jsonb_array_elements(v_inventory_next) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id;

  return jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'inventoryItem', v_inventory_item);
end;
$$;

create or replace function public.set_item_attuned(
  p_item_id text,
  p_expected_bearer_key text,
  p_attuned boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid            uuid := auth.uid();
  v_item           public.item_instances%rowtype;
  v_inventory      jsonb;
  v_inventory_next jsonb;
  v_inventory_item jsonb;
  v_matches        integer;
  v_attuned_count  integer;
begin
  if v_uid is null then raise exception 'You must be signed in to attune an item.'; end if;
  if not public.is_member() then raise exception 'Only an approved campaign member may attune an item.'; end if;
  p_item_id := nullif(btrim(coalesce(p_item_id, '')), '');
  p_expected_bearer_key := nullif(btrim(coalesce(p_expected_bearer_key, '')), '');
  if p_item_id is null then raise exception 'The item id is required.'; end if;
  if p_expected_bearer_key is null then raise exception 'The expected bearer is required.'; end if;
  if p_attuned is null then raise exception 'Choose whether the item is attuned.'; end if;

  select * into v_item from public.item_instances where id = p_item_id for update;
  if not found then raise exception 'The tracked item was not found.'; end if;
  if v_item.status <> 'held' or v_item.current_bearer_key is distinct from p_expected_bearer_key then
    raise exception 'The item bearer changed; refresh before changing attunement.';
  end if;
  if p_attuned and not v_item.requires_attunement then
    raise exception 'This item does not require attunement.';
  end if;

  select inventory into v_inventory
    from public.characters
   where key = p_expected_bearer_key
   for update;
  if not found then raise exception 'The current bearer no longer exists.'; end if;
  if jsonb_typeof(v_inventory) <> 'array' then raise exception 'The current bearer inventory is malformed.'; end if;

  select count(*)::integer into v_matches
    from jsonb_array_elements(v_inventory) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id;
  if v_matches <> 1 then raise exception 'The current bearer inventory must contain exactly one copy of this tracked item.'; end if;

  if p_attuned then
    select count(*)::integer into v_attuned_count
      from jsonb_array_elements(v_inventory) as entry(value)
     where lower(coalesce(entry.value ->> 'attuned', '')) = 'true'
       and entry.value ->> 'instanceId' is distinct from p_item_id;
    if v_attuned_count >= 3 then raise exception 'Attunement limit reached; release one item first.'; end if;
  end if;

  select jsonb_agg(
           case when entry.value ->> 'instanceId' = p_item_id
             then entry.value || jsonb_build_object('reqAttune', true, 'attuned', p_attuned)
             else entry.value end
           order by entry.ordinality
         )
    into v_inventory_next
    from jsonb_array_elements(v_inventory) with ordinality as entry(value, ordinality);

  update public.characters
     set inventory = v_inventory_next,
         updated_at = now()
   where key = p_expected_bearer_key;

  update public.item_instances
     set attuned = p_attuned,
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  select entry.value into v_inventory_item
    from jsonb_array_elements(v_inventory_next) as entry(value)
   where entry.value ->> 'instanceId' = p_item_id;

  return jsonb_build_object('ok', true, 'item', to_jsonb(v_item), 'inventoryItem', v_inventory_item);
end;
$$;

revoke all on function public.set_item_attunement_requirement(text, boolean) from public, anon;
revoke all on function public.set_item_attuned(text, text, boolean) from public, anon;
grant execute on function public.set_item_attunement_requirement(text, boolean) to authenticated;
grant execute on function public.set_item_attuned(text, text, boolean) to authenticated;
