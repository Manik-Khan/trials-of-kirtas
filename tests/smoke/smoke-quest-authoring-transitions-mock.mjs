// Structural contract for the standalone in-game Quest capture mock.

import { readFileSync } from 'node:fs';

const file = '_edits/mock-quest-authoring-transitions.html';
const html = readFileSync(file, 'utf8');
let passed = 0;
let failed = 0;
function ok(condition, label) {
  if (condition) passed += 1;
  else { failed += 1; console.log('  FAIL: ' + label); }
}
function has(value, label) { ok(html.includes(value), label); }

const dataMatch = html.match(/<script id="mock-data" type="application\/json">([\s\S]*?)<\/script>/);
ok(!!dataMatch, 'candidate contract exists');
let data = null;
try { data = JSON.parse(dataMatch ? dataMatch[1] : ''); }
catch (error) { failed += 1; console.log('  FAIL: candidate JSON parses — ' + error.message); }

const scripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*>([\s\S]*?)<\/script>/g)];
ok(scripts.length === 1, 'one self-contained interaction script exists');
try { new Function(scripts[0] ? scripts[0][1] : ''); passed += 1; }
catch (error) { failed += 1; console.log('  FAIL: interaction script parses — ' + error.message); }

ok(!/<script[^>]+src=/.test(html), 'mock loads no scripts');
ok(!/<link[^>]+stylesheet/.test(html), 'mock loads no stylesheets');
ok(!/<img\b/.test(html), 'mock loads no images');
ok(!/\bfetch\s*\(/.test(html), 'mock performs no network reads');
ok(!/supabase|__tok\.sb/i.test(html), 'mock has no database dependency');
ok(!/localStorage|sessionStorage/.test(html), 'mock writes no browser storage');

if (data) {
  ok(data.contract === 'tok-quest-capture/v3-candidate', 'capture contract includes the Chronicle milestone');
  ok(data.boundary === 'standalone-review-only-no-reads-no-writes', 'non-persistent boundary is explicit');
  ok(data.approval === 'm-approved-2026-08-24', 'M approval is recorded');
  ok(data.creators.join(',') === 'player,dm,overseer', 'every authenticated campaign role may create');
  ok(data.triggers.create === '/quest', 'slash quest creates a quest');
  ok(data.triggers.reference === '@quest', 'at quest links an existing quest');
  ok(data.flow.length === 4, 'capture has four small sections');
  ok(data.flow.map(row => row.id).join(',') === 'moment,connections,objective,share', 'flow follows the person at the table');
  ok(data.flow[0].required.includes('description'), 'the moment description is required');
  ok(data.flow[1].optional.includes('giver') && data.flow[1].optional.includes('location'), 'giver and location are optional connections');
  ok(data.flow[2].required.includes('objective'), 'one objective is the only other required fact');
  ok(data.defaults.visibility === 'party' && data.defaults.status === 'active', 'sharing creates an active party quest');
  ok(data.defaults.objectives === 1, 'one objective is enough by default');
  ok(data.result.chronicleMoment === 'current' && data.result.journalLink, 'quest stays attached to Chronicle and Journal');
  ok(data.result.questLog && data.result.realtimeProjection, 'quest projects to the shared log in realtime');
  ok(data.result.chronicleMilestone === 'quest_begun', 'sharing creates one Quest Begun Chronicle milestone');
  ok(data.chronicleProjection.placement === 'after_source_entry', 'Chronicle-origin marker follows its prose');
  ok(data.chronicleProjection.externalPlacement === 'creation_time', 'outside-created quest still lands chronologically');
  ok(data.chronicleProjection.collapsedByDefault, 'existing Chronicle milestones stay compact by default');
  ok(data.chronicleProjection.expandsTo.join(',') === 'description,giver,location,quest_hub_link', 'expanded marker exposes only glanceable quest facts');
  ok(data.principles.includes('one section at a time'), 'progressive capture is explicit');
  ok(data.principles.includes('create during play'), 'in-game creation is explicit');
  ok(data.principles.includes('all authenticated campaign members may create'), 'shared creation authority is explicit');
  ok(data.principles.includes('no staff review gate'), 'staff review is not a player-facing transition');
  ok(data.principles.includes('originating prose remains the story'), 'the Chronicle prose stays canonical narrative');
  ok(data.principles.includes('quest begun is a linked receipt, not copied prose'), 'the marker does not duplicate Chronicle writing');
  ok(data.principles.includes('quests created elsewhere still appear by creation time'), 'Hub and Journal creation share the timeline projection');
  ok(data.principles.includes('database transitions stay hidden'), 'persistence machinery stays behind the interaction');
}

has('Type / for commands', 'Chronicle editor teaches the slash menu');
has('Try /quest', 'the creation path is directly demoable');
has('/quest</b> creates one now', 'slash quest semantics are visible');
has('@quest</b> links one later', 'at quest semantics are visible');
has('Write what just happened', 'the flow begins with play, not planning');
has('A discovered quest may have no quest giver at all', 'found quests do not invent a giver');
has('Type @ to find an NPC', 'giver uses the existing mention model');
has('Type @ to find a place', 'location uses the existing mention model');
has('One clear action is enough', 'small quests remain small');
has('No draft states or transition controls', 'old lifecycle UI is explicitly removed');
has('Add quest to Chronicle', 'one share action finishes capture');
has('Visible in Chronicle and Quest Log', 'the Chronicle and Quest Log share the result');
has('Quest begun', 'Chronicle gives quest creation the approved narrative separator');
has('Started in the Quest Hub · earlier this session', 'Hub-origin example appears at creation time');
has('Begun from this Chronicle entry', 'Chronicle-origin marker states its source');
has('The Bell Beneath', 'existing outside-created quest is visible in the timeline');
has('Old Nan', 'expanded marker shows the quest giver');
has('Barrow Wastes', 'expanded marker shows the location');
has('Open in Quest Hub', 'expanded marker routes to the full quest organizer');
has('data-milestone-toggle', 'milestone details expand in place');
has('aria-expanded="false"', 'milestone begins with accessible collapsed state');
has('function setMilestoneOpen(', 'one interaction controls every Chronicle quest marker');
has("setMilestoneOpen(milestone,true)", 'newly shared quest opens its receipt for immediate confirmation');
has('function start()', 'slash command opens the guided capture');
has('function valid(index)', 'only the current section is validated');
has('window.QuestCaptureMock', 'candidate helpers are exposed');
has('@media(max-width:720px)', 'mobile layout is explicit');
has('min-height:52px', 'mobile controls retain touch size');

ok(!/create_quest_draft|publish_quest|set_quest_active|expected_updated_at/.test(html), 'server transitions are absent from the person-facing mock');
ok(!/reviewed giver|reviewed reward|review blocker/i.test(html), 'staff-review language is absent from capture');
ok(!/data-complete|Completed quest/.test(html), 'completion machinery is not added to this Chronicle slice');

console.log(`\nsmoke-quest-authoring-transitions-mock: ${passed}/${passed + failed} passed${failed ? `  (${failed} FAILED)` : ''}`);
process.exit(failed ? 1 : 0);
