// Static safety contract for the prepared staff-only item adoption RPC. Live
// Supabase execution remains the PostgreSQL/runtime gate.
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../schema_delta_item_adoption.sql', import.meta.url), 'utf8');
const body = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');

let pass = 0, fail = 0;
const ok = (name, condition) => {
  if (condition) pass++;
  else { fail++; console.log('  FAIL:', name); }
};
const has = (pattern) => pattern.test(body);

console.log('--- intentional staff adoption ---');
ok('adoption is one SECURITY DEFINER RPC', has(/create or replace function public\.adopt_inventory_item\s*\([\s\S]*?security definer/i));
ok('anonymous callers are rejected', has(/if v_uid is null then[\s\S]*?must be signed in/i));
ok('only live staff authority may adopt', has(/if not public\.is_staff\(\) then[\s\S]*?campaign staff/i));
ok('bearer inventory row locks before inspection', has(/from public\.characters[\s\S]*?where key = p_character_key[\s\S]*?for update/i));
ok('archived characters are rejected', has(/if v_character_deleted then[\s\S]*?archived character/i));
ok('exact expected JSON protects against a stale index', has(/v_original is distinct from p_expected_item[\s\S]*?selected inventory item changed/i));
ok('already-tracked items cannot be adopted twice', has(/instanceId'[\s\S]*?already part of campaign history/i));
ok('stacked items narrate the required split', has(/qty'[\s\S]*?Split this stack to one item/i));
ok('instance and UI id collisions are rejected', has(/instanceId' = v_item_id or entry\.value ->> 'id' = v_item_id/i));

console.log('--- public projection + secret separation ---');
ok('identification accepts only the approved two states', has(/v_identification not in \('unidentified', 'identified'\)/i));
ok('rarity normalization uses the approved palette', ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'].every((rarity) => body.includes(`'${rarity}'`)));
ok('unidentified public state rejects leaked definition/rules', has(/v_identification = 'unidentified'[\s\S]*?v_definition_key is not null[\s\S]*?v_mechanics <> '\{\}'::jsonb[\s\S]*?cannot reveal/i));
ok('unidentified adoption requires a staff secret', has(/v_identification = 'unidentified' and p_secret is null[\s\S]*?requires staff-only secret/i));
ok('unidentified inventory rebuilds from an explicit allowlist', has(/if v_identification = 'unidentified' then[\s\S]*?jsonb_strip_nulls\(jsonb_build_object/i));
ok('staff-authored known physical fields remain possible', has(/p_public -> 'inventoryFields'/i) && has(/\|\| v_inventory_fields/i));
ok('protected identity fields override custom inventory fields', has(/v_inventory_item := v_inventory_item \|\| jsonb_build_object\([\s\S]*?'instanceId', v_item_id/i));
ok('canonical public item is inserted as held by bearer', has(/insert into public\.item_instances[\s\S]*?'held', p_character_key/i));
ok('secret data inserts only on the separate table', has(/if p_secret is not null then[\s\S]*?insert into public\.item_secrets/i));
ok('selected sheet row receives its permanent identity', has(/jsonb_set\([\s\S]*?array\[p_inventory_index::text\][\s\S]*?v_inventory_item/i));

console.log('--- origin + location history starts immediately ---');
ok('recovery and assignment ids cannot collide', has(/v_recovery_event_id = v_assignment_event_id[\s\S]*?must be different/i));
ok('recovery event is appended', has(/insert into public\.item_events[\s\S]*?'recovered'/i));
ok('assignment event is appended', (body.match(/insert into public\.item_events/g) || []).length === 2 && has(/'assigned'/i));
ok('recovery data and column both carry location', has(/jsonb_build_object\('locationId',[\s\S]*?p_context ->> 'locationId'[\s\S]*?p_context ->> 'locationId'/i));
ok('all approved cross-system links are accepted', ['sessionId', 'locationId', 'momentId', 'encounterId', 'journalPageId', 'feedPostId', 'battleMapId'].every((field) => body.includes(`'${field}'`)));
ok('actor identity is server-derived', has(/where user_id = v_uid[\s\S]*?v_actor_character_key, v_uid/i));
ok('server returns item, stamped inventory row, and both events', has(/'item', to_jsonb\(v_item\),[\s\S]*?'inventoryItem', v_inventory_item,[\s\S]*?'recoveryEvent'[\s\S]*?'assignmentEvent'/i));
ok('only authenticated may execute the staff-gated RPC', has(/revoke all on function public\.adopt_inventory_item[\s\S]*?from public, anon;[\s\S]*?grant execute on function public\.adopt_inventory_item[\s\S]*?to authenticated;/i));

console.log(`\nsmoke-item-adoption-sql: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
