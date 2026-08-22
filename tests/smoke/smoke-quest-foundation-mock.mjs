// Structural + contract checks for the standalone shared Quest Log approval mock.
// No DOM dependency: the inline JSON is the candidate quest authority.

import { readFileSync } from 'node:fs';

const file = '_edits/mock-quest-foundation.html';
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
catch (error) { failed += 1; console.log('  FAIL: candidate JSON parses — ' + error.message); }

const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
ok(scripts.length === 1, 'one self-contained interaction script exists');
try { new Function(scripts[0] ? scripts[0][1] : ''); passed += 1; }
catch (error) { failed += 1; console.log('  FAIL: inline interaction script parses — ' + error.message); }

ok(!/<script[^>]+src=/.test(html), 'mock loads no external scripts');
ok(!/<link[^>]+stylesheet/.test(html), 'mock loads no external stylesheets');
ok(!/<img\b/.test(html), 'mock loads no external images');
ok(!/\bfetch\s*\(/.test(html), 'mock performs no network reads');
ok(!/supabase|__tok\.sb/i.test(html), 'mock has no production database dependency');
ok(!/localStorage|sessionStorage/.test(html), 'mock writes no browser storage');

if (data) {
  ok(data.contract === 'tok-quest/v1-candidate', 'candidate names the shared quest contract');
  ok(data.boundary === 'standalone-illustrative-no-reads-no-writes', 'candidate declares its non-persistent boundary');
  ok(Array.isArray(data.quests) && data.quests.length === 3, 'active and completed specimens are present');
  ok(new Set(data.quests.map(row => row.id)).size === data.quests.length, 'quest identities are unique');
  ok(data.quests.every(row => row.visibility === 'party'), 'party sample contains no staff-only quest shell');
  ok(data.quests.every(row => row.giverId && row.giverLabel), 'every quest has stable giver identity and readable copy');
  ok(data.quests.every(row => row.mapTarget && row.mapTarget.locationId), 'every specimen has an explicit public map target');
  ok(data.quests.every(row => Array.isArray(row.objectives) && row.objectives.length), 'every quest has ordered objectives');
  ok(data.quests.every(row => row.objectives.every((obj,index) => obj.order === index + 1)), 'objective order is unambiguous');
  ok(data.quests.some(row => row.status === 'completed'), 'completed quest state is exercised');
  ok(data.quests.some(row => row.objectives.some(obj => obj.state === 'current')), 'current objective state is exercised');
  ok(data.quests.some(row => row.objectives.some(obj => obj.state === 'locked')), 'locked objective state is exercised');
  ok(data.quests.some(row => row.objectives.some(obj => obj.state === 'complete' && obj.evidence.length)), 'completed objectives carry campaign evidence');
  ok(data.quests.some(row => row.objectives.some(obj => obj.state === 'current' && !obj.evidence.length)), 'current objective can honestly lack completion evidence');
  ok(data.quests.some(row => row.objectives.some(obj => obj.evidence.some(ev => ev.momentId && ev.sessionId))), 'evidence reuses moment and session identities');
  ok(data.quests.some(row => row.objectives.some(obj => obj.evidence.some(ev => ev.feedPostId || ev.journalPageId))), 'Chronicle or Journal evidence identity is explicit');
  ok(data.quests.some(row => row.mapTarget.precision === 'approximate' && row.secretTarget && row.secretTarget.precision === 'confirmed'), 'approximate party destination keeps separate exact staff truth');
  ok(data.quests.every(row => Array.isArray(row.rewards) && row.rewards.length), 'every quest has an explicit reward record');
  ok(data.quests.some(row => row.rewards.some(reward => reward.state === 'hidden')), 'hidden reward state is exercised');
  ok(data.quests.some(row => row.rewards.some(reward => reward.state === 'awarded')), 'awarded reward state is exercised');
}

has('Shared campaign quest, not a character\'s private Journal checklist', 'quest ownership boundary is stated');
has('Journal pages may link here but do not own quest state', 'Journal remains a linking consumer');
has('Completion never comes from a checkbox alone.', 'completion requires evidence');
has('Evidence is a link; it is never rewritten into the quest.', 'evidence immutability is narrated');
has('data-audience="player"', 'player preview is present');
has('data-audience="staff"', 'staff preview is present');
has('data-open-author', 'staff authoring entry is present');
has('What does the party know?', 'authoring begins with public truth');
has('What remains behind the screen?', 'authoring separates secret truth');
has('What does the map show?', 'authoring asks for map precision');
has('What must happen?', 'authoring supports multi-step objectives');
has('What do they earn?', 'authoring includes rewards');
has('Nothing in this mock is saved.', 'authoring failure boundary narrates no persistence');
has('data-secret-truth', 'staff secret projection has its own surface');
has('exact-pin', 'staff exact destination has a distinct map layer');
has('approx-region', 'party uncertainty renders as a region');
has('data-selected-objective', 'objective selection owns its evidence panel');
has('data-connection="', 'cross-section evidence controls render from one authority');
has('@media (max-width:720px)', 'mobile layout is explicit');
has('min-height:64px', 'mobile evidence controls exceed the touch minimum');
has('window.QuestFoundationMock', 'pure candidate helpers are exposed for inspection');
has('function partyProjection', 'party projection has an explicit secret-stripping helper');

console.log(`\nsmoke-quest-foundation-mock: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
