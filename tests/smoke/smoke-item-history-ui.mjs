// Dependency-free reader contract for the flagged production item-history module.
import { readFileSync } from 'node:fs';
import ItemHistory from '../../item-history.js';

let pass = 0;
let fail = 0;
function ok(condition, name) { if (condition) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } }

ok(ItemHistory.VERSION === 'ih-3', 'reader exposes the ih-3 contract');
ok(ItemHistory.isEnabled('?itemHistory=1'), 'explicit itemHistory flag enables the reader');
ok(!ItemHistory.isEnabled('') && !ItemHistory.isEnabled('?itemHistory=0'), 'default and zero keep the reader inert');
ok(ItemHistory.isStaff({ role: 'dm' }) && ItemHistory.isStaff({ role: 'overseer' }) && !ItemHistory.isStaff({ role: 'player' }), 'only campaign staff receive the staff projection');
ok(ItemHistory.mechanicsText({ description: 'Known rules' }) === 'Known rules', 'known mechanics description becomes readable copy');
ok(ItemHistory.labelKey('mainHand') === 'Main hand', 'equipment slot keys become human-readable labels');

const rows = {
  item_instances: { id: 'item_hexblade', display_name: 'The Runed Longsword', identification: 'unidentified', mechanics: {} },
  item_events: [
    { sequence: 2, id: 'b', occurred_at: '2026-06-02T00:00:00Z', event_type: 'assigned' },
    { sequence: 1, id: 'a', occurred_at: '2026-06-01T00:00:00Z', event_type: 'recovered' }
  ],
  item_secrets: { item_id: 'item_hexblade', true_name: 'The Hexblade', rarity: 'Rare' }
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
ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(source), 'reader contains no lifecycle write path');
ok(source.includes("from('item_instances')") && source.includes("from('item_events')") && source.includes("from('item_secrets')"), 'source names only the three durable read tables');
ok(source.includes('Oldest first · append-only'), 'dialog labels chronological append-only history');
ok(source.includes('Rarity unrevealed') && source.includes('Properties unrevealed'), 'unidentified presentation withholds rarity and mechanics');
ok(source.includes('data-ih-view="player"') && source.includes('tok-ih-player'), 'staff can preview the party projection');
ok(source.includes('@media(max-width:700px)') && source.includes('min-height:48px'), 'mobile bottom sheet retains touch-sized controls');
ok(sheet.includes('item-history.js?v=ih3'), 'full sheet loads the cache-stamped reader');
ok(sheet.indexOf('ItemHistory.mount') < sheet.indexOf('ItemAdoption.mount'), 'reader claims tracked details before adoption decorates ordinary items');
ok(!/item-history\.js/.test(readFileSync(new URL('../../sheet-mount.js', import.meta.url), 'utf8')), 'mounted sheet remains untouched');
ok(harness.includes('../../item-history.js?v=ih3') && harness.includes('window.ItemHistory.mount'), 'browser harness uses the production reader module');

console.log(`\nsmoke-item-history-ui: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
