// Static safety contract for the prepared atomic item-transfer RPC. The live
// Supabase SQL Editor remains the PostgreSQL execution gate.
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../schema_delta_item_transfer.sql', import.meta.url), 'utf8');
const body = sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');

let pass = 0, fail = 0;
const ok = (name, condition) => {
  if (condition) pass++;
  else { fail++; console.log('  FAIL:', name); }
};
const has = (pattern) => pattern.test(body);

console.log('--- server authorization + concurrency ---');
ok('transfer is one SECURITY DEFINER RPC', has(/create or replace function public\.transfer_item\s*\([\s\S]*?security definer/i));
ok('anonymous callers are rejected', has(/if v_uid is null then[\s\S]*?must be signed in/i));
ok('live shared-party membership is enforced', has(/if not public\.is_member\(\) then[\s\S]*?approved campaign member/i));
ok('canonical item row locks before mutation', has(/from public\.item_instances[\s\S]*?where id = p_item_id[\s\S]*?for update/i));
ok('both character rows lock in stable key order', has(/from public\.characters[\s\S]*?where key in \(p_expected_from_character_key, p_to_character_key\)[\s\S]*?order by key[\s\S]*?for update/i));
ok('stale bearer state aborts the trade', has(/current_bearer_key is distinct from p_expected_from_character_key[\s\S]*?refresh before trading/i));
ok('same-character transfers are rejected', has(/p_expected_from_character_key = p_to_character_key[\s\S]*?different character/i));
ok('archived source and destination are rejected', has(/if v_source_deleted then/i) && has(/if v_destination_deleted then/i));

console.log('--- inventory move is identity-safe ---');
ok('source lookup requires permanent instanceId', has(/entry\.value ->> 'instanceId' = p_item_id/i));
ok('missing and duplicate source rows both abort', has(/if v_source_matches = 0 then/i) && has(/if v_source_matches > 1 then/i));
ok('destination rejects instance and UI id collisions', has(/entry\.value ->> 'instanceId' = p_item_id[\s\S]*?entry\.value ->> 'id' = p_item_id/i));
ok('non-empty containers narrate instead of orphaning contents', has(/entry\.value ->> 'containerId' = v_container_key[\s\S]*?Empty this container before transferring it/i));
ok('source inventory removes exactly the instance id', has(/jsonb_agg\(entry\.value order by entry\.ordinality\)[\s\S]*?instanceId' is distinct from p_item_id/i));
ok('destination receives the same moved JSON row', has(/v_destination_inventory \|\| jsonb_build_array\(v_moved\)/i));
ok('stable id is copied from immutable instance id', has(/'id', p_item_id,[\s\S]*?'instanceId', p_item_id/i));
ok('bearer-specific slot, attunement, and container are cleared', has(/'slot', null,[\s\S]*?'attuned', false,[\s\S]*?'containerId', null/i));
ok('both character inventories update inside the RPC', (body.match(/update public\.characters/g) || []).length === 2);

console.log('--- canonical custody + history commit together ---');
ok('canonical item moves to destination and clears map state', has(/update public\.item_instances[\s\S]*?current_bearer_key = p_to_character_key[\s\S]*?current_location_id = null/i));
ok('canonical equipment state also clears', has(/update public\.item_instances[\s\S]*?slot = null[\s\S]*?attuned = false/i));
ok('one transferred event is inserted', has(/insert into public\.item_events[\s\S]*?'transferred'/i));
ok('event records both historical bearers', has(/'fromCharacterKey', p_expected_from_character_key,[\s\S]*?'toCharacterKey', p_to_character_key/i));
ok('event actor is derived from auth instead of caller input', has(/where user_id = v_uid[\s\S]*?v_actor_character_key, v_uid/i));
ok('all campaign link parameters reach the event', ['p_session_id', 'p_location_id', 'p_moment_id', 'p_encounter_id', 'p_journal_page_id', 'p_feed_post_id', 'p_battle_map_id'].every((field) => body.includes(field)));
ok('RPC returns server-confirmed item and event', has(/jsonb_build_object\([\s\S]*?'ok', true,[\s\S]*?'item', to_jsonb\(v_item\),[\s\S]*?'event', to_jsonb\(v_event\)/i));
ok('only authenticated receives execute permission', has(/revoke all on function public\.transfer_item[\s\S]*?from public, anon;[\s\S]*?grant execute on function public\.transfer_item[\s\S]*?to authenticated;/i));

console.log(`\nsmoke-item-transfer-sql: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
