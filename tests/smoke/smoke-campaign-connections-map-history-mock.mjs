// smoke-campaign-connections-map-history-mock.mjs
// Structural + contract checks for the standalone Party's Path approval mock.
// No DOM dependency: the inline JSON is the candidate contract authority.

import { readFileSync } from 'node:fs';

const file = '_edits/mock-campaign-connections-map-history.html';
const html = readFileSync(file, 'utf8');
let passed = 0;
let failed = 0;

function ok(condition, label) {
  if (condition) passed += 1;
  else { failed += 1; console.log('  FAIL: ' + label); }
}

function has(value, label) { ok(html.includes(value), label); }

const dataMatch = html.match(/<script id="mock-data" type="application\/json">([\s\S]*?)<\/script>/);
ok(!!dataMatch, 'inline candidate contract exists');
let data = null;
try { data = JSON.parse(dataMatch ? dataMatch[1] : ''); }
catch (error) { console.log('  FAIL: candidate JSON parses — ' + error.message); failed += 1; }

const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
ok(scripts.length === 1, 'one self-contained interaction script exists');
try { new Function(scripts[0] ? scripts[0][1] : ''); passed += 1; }
catch (error) { console.log('  FAIL: inline interaction script parses — ' + error.message); failed += 1; }

ok(!/<script[^>]+src=/.test(html), 'mock loads no external scripts');
ok(!/<link[^>]+stylesheet/.test(html), 'mock loads no external stylesheets');
ok(!/<img\b/.test(html), 'mock loads no external images');
ok(!/\bfetch\s*\(/.test(html), 'mock performs no network reads');
ok(!/supabase|__tok\.sb/i.test(html), 'mock has no production database dependency');
ok(!/localStorage|sessionStorage/.test(html), 'mock writes no browser storage');

if (data) {
  ok(data.contract === 'tok-campaign-moment/v1-legacy-link-candidate', 'candidate names the shared moment plus legacy-link contract');
  ok(Array.isArray(data.moments) && data.moments.length === 7, 'seven linked and unlinked moments exercise the corrected flow');
  const ids = data.moments.map(row => row.id);
  ok(new Set(ids).size === ids.length, 'campaign moment identities are unique');
  const orders = data.moments.map(row => row.order);
  ok(new Set(orders).size === orders.length, 'history order is unambiguous');
  ok(orders.every((order, index) => !index || order > orders[index - 1]), 'moments are stored oldest first');
  ok(data.moments.every(row => row.public === true), 'party path sample contains only public moments');

  const itemMoments = data.moments.filter(row => row.itemEventId);
  ok(itemMoments.length === 3, 'three item events prove cross-section history');
  ok(itemMoments.every(row => row.itemId && row.itemEventId), 'item links retain item and event identity separately');
  ok(itemMoments.every(row => row.itemLinkId), 'legacy item events use an explicit association identity');
  ok(data.itemEventLinks.length === itemMoments.length, 'every displayed legacy item event has one association row');
  ok(data.itemEventLinks.every(link => data.moments.some(row => row.id === link.momentId && row.itemEventId === link.itemEventId)), 'association rows resolve both immutable identities');
  ok(Object.values(data.itemEvents).every(row => row.momentId === null), 'source item events remain byte-for-byte unclaimed by a moment');

  const satchel = data.moments.find(row => row.id === 'moment-s8-unopened-satchel');
  ok(!!satchel && satchel.contentsState === 'unopened', 'the chieftain satchel remains explicitly unopened');
  ok(satchel.sessionId === '8' && satchel.locationId === 'veren-s-watch', 'satchel uses its real session and Living Codex location');
  ok(satchel.feedPostId === '449', 'satchel links the exact Chronicle row');
  ok(!!satchel.encounterId && !!satchel.battleMapId, 'satchel retains its typed encounter and scene evidence');
  ok(satchel.itemId === null && satchel.itemEventId === null, 'unopened contents do not invent a durable item');
  ok(satchel.also.includes('battle'), 'one satchel fact may appear in treasure and battle filters without duplication');

  const recovered = data.moments.find(row => row.id === 'moment-s8-skyblinder-recovered');
  ok(!!recovered, 'separate Skyblinder recovery moment exists');
  ok(recovered.sessionId === '8' && recovered.locationId === 'veren-s-watch', 'Skyblinder retains its real recovery context');
  ok(!!recovered.itemEventId && !!recovered.itemLinkId, 'Skyblinder reaches immutable item history through the legacy bridge');
  ok(recovered.feedPostId === null && recovered.encounterId === null && recovered.battleMapId === null, 'Skyblinder receives no guessed satchel, encounter, or scene link');
  ok(satchel.id !== recovered.id, 'satchel and Skyblinder remain separate campaign facts');

  const noMap = data.moments.find(row => row.id === 'moment-hexblade-backstory');
  ok(noMap.locationId === null, 'backstory event remains explicitly unlocated');
  ok(noMap.feedPostId === null, 'backstory event remains explicitly unlinked from Chronicle');

  const approx = data.locations['barrow-wastes'];
  ok(approx.precision === 'approximate', 'uncertain player knowledge remains approximate');
  ok(Number.isFinite(approx.x) && Number.isFinite(approx.y), 'approximate region has a public map center');
  ok(!!approx.secretLabel && Number.isFinite(approx.secretX) && Number.isFinite(approx.secretY), 'staff truth can retain a separate exact destination');
  ok(data.moments.find(row => row.locationId === 'barrow-wastes').partyPresent === false, 'an approximate rumor does not forge a traveled route');
  const nested = data.locations['gold-leaf'];
  ok(nested.precision === 'nested' && nested.parentId === 'tiersgard', 'nested place points to its top-level map parent');
  ok(nested.x == null && nested.y == null, 'nested place does not invent a second continent pin');
  ok(!!data.locations[nested.parentId], 'nested location parent resolves');

  ok(data.current.locationId === 'tiersgard', 'current party position is explicit current truth');
  ok(!data.moments.some(row => row.id === data.current.locationId), 'current truth is not forged into historical event identity');
  ok(data.item.id === 'item_876939c0-74c5-4cd2-9c45-35308cec409b' && data.item.bearer === 'Vesperian Vale', 'current item custody matches live truth and remains separate from event locations');
}

['data-view-tab="world"','data-view-tab="chronicle"','data-view-tab="item"','data-view-tab="fight"'].forEach((value) => has(value, value + ' section is present'));
['data-filter="journey"','data-filter="discovery"','data-filter="battle"','data-filter="treasure"','data-filter="npc"'].forEach((value) => has(value, value + ' history filter is present'));
has('The selected moment follows you between sections.', 'cross-section selection behavior is narrated');
has('Missing links stay missing; the interface never invents them.', 'missing-link behavior is narrated');
has('The unopened satchel and Skyblinder Staff are separate facts.', 'field correction is explicit at the top level');
has('The satchel is unopened, so no durable item exists yet.', 'unopened contents narrate why Item History is unavailable');
has('Legacy link · the original item event remains unchanged.', 'legacy association narrates item-event immutability');
has('No location was recorded; World does not guess one.', 'unlocated item event narrates why it has no pin');
has('Current truth', 'item view distinguishes current custody from history');
has('Append-only · oldest first', 'item chronology remains append-only and oldest-first');
has('data-secret-pin', 'staff-only exact destination has a distinct visual layer');
has('data-audience="player"', 'player preview is present');
has('data-audience="staff"', 'staff preview is present');
has('@media (max-width:760px)', 'mobile layout is explicit');
has('min-height:62px', 'mobile connection targets exceed the touch minimum');
has("window.PartyPathMock", 'pure candidate helpers are exposed for inspection');
has("loc.parentId", 'map projection resolves nested places through their parent');
has("function mapClusters", 'co-located moments cluster at one map home');
has("if(!moment.partyPresent", 'only witnessed party presence contributes to the traveled line');
has("moment.also", 'filter projection supports one fact in multiple lenses');
has("moment.staffTruth", 'staff truth is separate from party narration');

console.log(`\nsmoke-campaign-connections-map-history-mock: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
