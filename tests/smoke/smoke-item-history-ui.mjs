// Dependency-free reader contract for the production item-history module.
import { readFileSync } from 'node:fs';
import ItemHistory from '../../item-history.js';

let pass = 0;
let fail = 0;
function ok(condition, name) { if (condition) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }

ok(ItemHistory.VERSION === 'ih-7', 'reader exposes the ih-7 connected-history contract');
ok(ItemHistory.isEnabled('') && ItemHistory.isEnabled('?itemHistory=1'), 'full-sheet default and explicit flag enable the reader');
ok(!ItemHistory.isEnabled('?itemHistory=0'), 'zero remains an explicit rollback switch');
ok(ItemHistory.isStaff({ role: 'dm' }) && ItemHistory.isStaff({ role: 'overseer' }) && !ItemHistory.isStaff({ role: 'player' }), 'only campaign staff receive the staff projection');
ok(ItemHistory.mechanicsText({ description: 'Known rules' }) === 'Known rules', 'known mechanics description becomes readable copy');
ok(ItemHistory.labelKey('mainHand') === 'Main hand', 'equipment slot keys become human-readable labels');
ok(ItemHistory.attunementLabel({ requires_attunement:false }, 'Cosmere Runestar') === 'No attunement required', 'non-attuning items have a distinct marker');
ok(ItemHistory.attunementLabel({ requires_attunement:true, attuned:false }, 'Cosmere Runestar') === 'Requires attunement · not attuned', 'required inactive state is explicit');
ok(ItemHistory.attunementLabel({ requires_attunement:true, attuned:true }, 'Cosmere Runestar') === 'Attuned · Cosmere Runestar', 'active state names the attuned character');

const rows = {
  item_instances: { id: 'item_hexblade', display_name: 'The Runed Longsword', identification: 'unidentified', mechanics: {} },
  item_events: [
    { sequence: 2, id: 'b', occurred_at: '2026-06-02T00:00:00Z', event_type: 'assigned' },
    { sequence: 1, id: 'a', occurred_at: '2026-06-01T00:00:00Z', event_type: 'recovered', moment_id:'moment-a', location_id:'tiersgard', feed_post_id:'12', session_id:'9' }
  ],
  item_secrets: { item_id: 'item_hexblade', true_name: 'The Hexblade', rarity: 'Rare' },
  characters: [{ key: 'cosmere-ae1a', structural: { name: 'Cosmere Runestar' } }, { key: 'liadan', structural: { name: 'Líadan Luchóg' } }]
};
function fakeSb(calls, failures = {}) {
  return { from(table) {
    calls.push('from:' + table);
    const builder = {
      select() { return builder; }, eq() { return builder; }, order() { return builder; },
      maybeSingle() { return Promise.resolve(failures[table] ? { data: null, error: { message: failures[table] } } : { data: rows[table], error: null }); },
      then(resolve, reject) { return Promise.resolve(failures[table] ? { data: null, error: { message: failures[table] } } : { data: rows[table], error: null }).then(resolve, reject); }
    };
    return builder;
  } };
}

const staffCalls = [];
const staffRecord = await ItemHistory.loadItem(fakeSb(staffCalls), 'item_hexblade', true);
ok(staffCalls.includes('from:item_instances') && staffCalls.includes('from:item_events'), 'reader requests public current truth and history');
ok(staffCalls.includes('from:item_secrets'), 'staff reader requests the separate secret row');
ok(staffCalls.includes('from:characters') && staffRecord.characterNames['cosmere-ae1a'] === 'Cosmere Runestar', 'custody keys resolve through character display names');
ok(staffRecord.secret.true_name === 'The Hexblade', 'staff result retains secret truth');
ok(staffRecord.events.map(row => row.id).join(',') === 'a,b', 'events are normalized oldest-first');

const playerCalls = [];
const playerRecord = await ItemHistory.loadItem(fakeSb(playerCalls), 'item_hexblade', false);
ok(!playerCalls.includes('from:item_secrets'), 'player reader never queries item_secrets');
ok(playerRecord.secret === null && playerRecord.secretError === '', 'player result contains no secret projection');

const partialCalls = [];
const partial = await ItemHistory.loadItem(fakeSb(partialCalls, { item_secrets: 'staff policy unavailable' }), 'item_hexblade', true);
ok(partial.item.id === 'item_hexblade' && /staff policy unavailable/.test(partial.secretError), 'a secret read failure narrates without hiding public history');
let publicFailed = false;
try { await ItemHistory.loadItem(fakeSb([], { item_instances: 'public read denied' }), 'item_hexblade', false); } catch (error) { publicFailed = /public read denied/.test(error.message); }
ok(publicFailed, 'a public item failure stays loud');

const source = readFileSync(new URL('../../item-history.js', import.meta.url), 'utf8');
const sheet = readFileSync(new URL('../../sheet-v2.html', import.meta.url), 'utf8');
const harness = readFileSync(new URL('../fixtures/item-history-harness.html', import.meta.url), 'utf8');
let rpcPayload = null;
const requirement = await ItemHistory.setRequirement({ rpc: async (name, payload) => { rpcPayload = { name, payload }; return { data:{ ok:true, item:{ id:'item_hexblade', requires_attunement:false } }, error:null }; } }, 'item_hexblade', false);
ok(rpcPayload.name === 'set_item_attunement_requirement' && rpcPayload.payload.p_requires_attunement === false && requirement.ok, 'staff requirement client uses the narrow atomic RPC');
const managementCalls = [];
const managementSb = { rpc: async (name, payload) => { managementCalls.push({ name, payload }); return { data:{ ok:true, item:{ id:'item_hexblade' }, event:{ id:'event' } }, error:null }; } };
await ItemHistory.identifyItem(managementSb, 'item_hexblade', 'Revealed.');
await ItemHistory.renameItem(managementSb, 'item_hexblade', 'Duskbrand', 'Renamed.');
await ItemHistory.transferItem(managementSb, 'item_hexblade', 'cosmere-ae1a', 'liadan', 'Entrusted.');
ok(managementCalls.map(row => row.name).join(',') === 'identify_item,rename_item,transfer_item', 'approved management actions use their narrow RPC boundaries');
ok(managementCalls[2].payload.p_expected_from_character_key === 'cosmere-ae1a' && managementCalls[2].payload.p_to_character_key === 'liadan', 'transfer sends stale-bearer protection and the real destination key');
ok(source.includes("from('item_instances')") && source.includes("from('item_events')") && source.includes("from('item_secrets')") && source.includes("from('characters')"), 'reader loads durable truth plus human character names');
ok(source.includes('Oldest first · append-only'), 'dialog labels chronological append-only history');
ok(source.includes('data-ih-tab="history" aria-selected="false">History</button>') && !source.includes("'History ' + record.events.length"), 'history tab uses a plain label without an unexplained count');
ok(source.includes('Rarity unrevealed') && source.includes('Properties unrevealed'), 'unidentified presentation withholds rarity and mechanics');
ok(source.includes("'<section class=\"tok-ih-panel on\"") && !source.includes('<div class="tok-ih-facts">'), 'overview uses the item name and omits the old three fact blocks');
ok(source.includes('No attunement required') && source.includes('Requires attunement · not attuned'), 'attunement is presented independently from equipment');
ok(source.includes('data-ih-action="identify"') && source.includes('data-ih-action="rename"') && source.includes('data-ih-action="transfer"'), 'staff management exposes identify rename and real transfer actions');
ok(source.includes('moves the real inventory row and canonical custody together'), 'transfer confirmation narrates its atomic effect');
ok(source.includes('data-ih-view="player"') && source.includes('tok-ih-player'), 'staff can preview the party projection');
ok(ItemHistory.eventConnectionsHtml(rows.item_events[1]).includes('world.html?campaignLinks=1&amp;moment=moment-a'), 'linked item event opens the same World moment');
ok(ItemHistory.eventConnectionsHtml({ moment_id:'moment-unlocated' }).includes('No location recorded'), 'unlocated item history narrates the unavailable map link');
ok(source.includes('data-item-history-open') && source.includes("get('item')"), 'a campaign link can reopen the permanent item identity on its current bearer sheet');
ok(source.includes('@media(max-width:700px)') && source.includes('min-height:48px'), 'mobile bottom sheet retains touch-sized controls');
ok(sheet.includes('campaign-moments.js?v=cm1') && sheet.includes('item-history.js?v=ih10'), 'full sheet loads cache-stamped campaign and item readers');
ok(sheet.includes("root.dataset.itemHistoryActive = new URLSearchParams(location.search).get('itemHistory') === '0' ? '0' : '1'"), 'full sheet promotes item history while retaining a rollback switch');
ok(sheet.indexOf('ItemHistory.mount') < sheet.indexOf('ItemAdoption.mount'), 'reader claims tracked details before adoption decorates ordinary items');
ok(!/item-history\.js/.test(readFileSync(new URL('../../sheet-mount.js', import.meta.url), 'utf8')), 'mounted sheet remains untouched');
ok(harness.includes('../../campaign-moments.js?v=cm1') && harness.includes('../../item-history.js?v=ih10') && harness.includes('window.ItemHistory.mount'), 'browser harness uses the production connected-history modules');

console.log(`\nsmoke-item-history-ui: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
