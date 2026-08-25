// Structural contract for the standalone Quest Hub / World / rail mock.

import { readFileSync } from 'node:fs';

const file = '_edits/mock-quest-hub-world-rail.html';
const html = readFileSync(file, 'utf8');
let pass = 0;
let fail = 0;
function ok(condition, label) {
  if (condition) pass += 1;
  else { fail += 1; console.log('  FAIL: ' + label); }
}
function has(value, label) { ok(html.includes(value), label); }

const match = html.match(/<script id="mock-data" type="application\/json">([\s\S]*?)<\/script>/);
ok(!!match, 'projection contract exists');
let data = null;
try { data = JSON.parse(match ? match[1] : ''); }
catch (error) { fail += 1; console.log('  FAIL: projection JSON parses — ' + error.message); }

const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
ok(scripts.length === 1, 'one self-contained interaction script exists');
try { new Function(scripts[0] ? scripts[0][1] : ''); pass += 1; }
catch (error) { fail += 1; console.log('  FAIL: interaction script parses — ' + error.message); }

ok(!/<script[^>]+src=/.test(html), 'mock loads no scripts');
ok(!/<link[^>]+stylesheet/.test(html), 'mock loads no stylesheets');
ok(!/<img\b/.test(html), 'mock loads no images');
ok(!/\bfetch\s*\(/.test(html), 'mock performs no network reads');
ok(!/supabase|__tok\.sb/i.test(html), 'mock has no database dependency');
ok(!/localStorage|sessionStorage/.test(html), 'mock writes no browser storage');

if (data) {
  ok(data.contract === 'tok-quest-hub-projections/v1-candidate', 'projection contract is named');
  ok(data.boundary === 'standalone-review-only-no-reads-no-writes', 'review-only boundary is explicit');
  ok(data.approval === 'm-approved-2026-08-24', 'M approval is recorded');
  ok(data.creators.join(',') === 'player,dm,overseer', 'Hub capture is available to every authenticated campaign role');
  ok(data.locations.length === 3, 'three illustrative World locations exist');
  ok(data.quests.length === 4, 'four illustrative quests cover the visual states');
  ok(data.quests.every(row => row.id && row.title && row.objective), 'each quest has one stable identity and visible objective');
  ok(data.quests.some(row => row.locationId === null), 'an unlocated quest remains valid');
  ok(data.quests.some(row => row.giverId === null), 'a quest without a giver remains valid');
  ok(data.quests.some(row => row.status === 'completed'), 'completed presentation exists');
  ok(data.quests.some(row => row.pinned), 'pinned rail presentation exists');
  ok(data.quests.filter(row => row.locationId).every(row => data.locations.some(loc => loc.id === row.locationId)), 'every location link resolves to one World identity');
  const bell = data.quests.find(row => row.title === 'The Bell Beneath');
  ok(!!bell && !!bell.description, 'Bell Beneath carries a rail-readable description');
  ok(!!bell && bell.giverId === 'old-nan', 'Bell Beneath carries a stable quest-giver identity');
  ok(data.npcs.find(row => row.id === bell.giverId)?.label === 'Old Nan', 'Bell Beneath resolves the plain Old Nan label');
  ok(!!bell && data.locations.find(loc => loc.id === bell.locationId)?.label === 'Barrow Wastes', 'Bell Beneath resolves its World location');
  ok(data.projections.hub && data.projections.world && data.projections.rail, 'Hub, World, and rail are explicit projections');
  ok(data.rules.includes('one canonical quest identity'), 'one quest identity is authority');
  ok(data.rules.includes('no copied quest records'), 'consumer copies are forbidden');
  ok(data.rules.includes('all authenticated campaign members may create'), 'shared creation authority is explicit');
  ok(data.rules.includes('location is optional'), 'location never blocks a quest');
  ok(data.rules.includes('hub uses the approved capture flow'), 'Hub reuses slash capture');
  ok(data.rules.includes('rail stays concise'), 'rail scope is intentionally small');
  ok(data.rules.includes('illustrative records only'), 'sample records are not seeds');
}

has('See what matters now', 'Hub leads with simple visual purpose');
has('Search quests, objectives, or locations', 'one search covers quests and places');
has('+ Add quest', 'Hub can start quest capture');
has('Same approved capture', 'Hub does not invent another authoring flow');
has('no Chronicle moment is assumed', 'Hub-origin capture stays honest');
has('View on World', 'Hub groups can open their World location');
has('Select a place to see the quests connected to it', 'World explains location-to-quest lookup');
has('connected quests are in the right rail', 'World uses the global right edge');
has('Pinned', 'rail exposes pinned quests');
has('Current objectives', 'rail exposes concise current work');
has('<dt>Quest Giver</dt>', 'expanded rail quest uses the short Quest Giver label');
has("expanded?'Close details':'Details'", 'rail makes its expandable detail explicit');
has('No quest giver recorded', 'expanded rail quest narrates an optional missing giver');
has('No location recorded', 'expanded rail quest narrates an optional missing location');
has('Open in Quest Hub', 'expanded rail detail offers the full organizer');
has('Open Quest Hub', 'rail routes to the full organizer');
has('function visibleQuests()', 'search and status filtering share one projection');
has('function showWorld(locationId)', 'quest and location selection share one World path');
has('function renderRail()', 'rail derives from canonical mock rows');
has("row.status==='active'&&!row.pinned", 'rail avoids repeating pinned quests in current objectives');
has("one('[data-pinned-section]').hidden=!!loc", 'World context replaces the generic pinned section');
has("expandedRailQuest===row.id", 'rail detail expands one quest at a time');
has("button.dataset.railToggle", 'rail quest click toggles details in place');
has("button.dataset.openQuest", 'expanded rail detail can open its Hub record');
has('function showEntityTooltip(button)', 'linked NPC and location records supply tooltip content');
has("button.addEventListener('mouseenter'", 'entity tooltip opens on hover');
has("button.addEventListener('focus'", 'entity tooltip opens from the keyboard');
has('entity descriptions stay with NPC and location records', 'quest rows do not own copied entity prose');
ok(!html.includes('@Old Nan'), 'Quest Giver omits mention syntax');
ok(!html.includes('Quest giver or start'), 'retired giver-or-start label is absent');
has('window.QuestHubProjectionMock', 'projection helpers are exposed');
has('@media(max-width:720px)', 'phone layout is explicit');
has('min-height:52px', 'phone controls retain touch size');
has('.capture-close,.capture footer button{min-height:52px}', 'phone capture keeps controls large without shrinking its writing field');

ok(!/staff review|review blocker|private draft|publish quest|expected_updated_at/i.test(html), 'person-facing lifecycle machinery is absent');
ok(!/position:fixed[^}]*left:0[^}]*width:var\(--rail\)/.test(html), 'global rail remains on the right edge');

console.log(`\nsmoke-quest-hub-world-rail-mock: ${pass}/${pass + fail} passed${fail ? `  (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
