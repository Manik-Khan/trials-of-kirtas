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
  ok(data.contract === 'tok-campaign-moment/v1-candidate', 'candidate names one shared campaign-moment contract');
  ok(Array.isArray(data.moments) && data.moments.length === 6, 'six linked and unlinked moments exercise the flow');
  const ids = data.moments.map(row => row.id);
  ok(new Set(ids).size === ids.length, 'campaign moment identities are unique');
  const orders = data.moments.map(row => row.order);
  ok(new Set(orders).size === orders.length, 'history order is unambiguous');
  ok(orders.every((order, index) => !index || order > orders[index - 1]), 'moments are stored oldest first');
  ok(data.moments.every(row => row.public === true), 'party path sample contains only public moments');

  const itemMoments = data.moments.filter(row => row.itemEventId);
  ok(itemMoments.length === 3, 'three item events prove cross-section history');
  ok(itemMoments.every(row => row.momentId === row.id), 'item events point to the same campaign-moment identity');
  ok(itemMoments.every(row => row.itemId && row.itemEventId), 'item links retain item and event identity separately');

  const battle = data.moments.find(row => row.id === 'moment-skyblinder-recovered');
  ok(!!battle, 'recovery moment exists');
  ok(battle.sessionId === '9', 'recovery links its canonical session');
  ok(battle.locationId === 'verens-watch', 'recovery links its canonical World location');
  ok(!!battle.feedPostId, 'recovery links its Chronicle row');
  ok(!!battle.journalPageId, 'recovery links its Journal evidence');
  ok(!!battle.encounterId, 'recovery links its encounter separately');
  ok(!!battle.battleMapId, 'recovery links its battle map separately');
  ok(battle.also.includes('treasure'), 'one fact may appear in battle and treasure filters without duplication');
  ok(battle.partyPresent === true, 'confirmed battle contributes to the traveled path');

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
  ok(data.item.id === 'item-skyblinder' && data.item.bearer === 'Líadan Luchóg', 'current item custody remains separate from event locations');
}

['data-view-tab="world"','data-view-tab="chronicle"','data-view-tab="item"','data-view-tab="fight"'].forEach((value) => has(value, value + ' section is present'));
['data-filter="journey"','data-filter="discovery"','data-filter="battle"','data-filter="treasure"','data-filter="npc"'].forEach((value) => has(value, value + ' history filter is present'));
has('The selected moment follows you between sections.', 'cross-section selection behavior is narrated');
has('Missing links stay missing; the interface never invents them.', 'missing-link behavior is narrated');
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
