// Dependency-free known answers for the standalone tracked-item management mock.
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../_edits/mock-item-history-management.html', import.meta.url), 'utf8');
let pass = 0;
let fail = 0;
function ok(name, condition) {
  if (condition) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

ok('mock is a standalone document', /<!doctype html>/i.test(html) && !/<script[^>]+src=|<link[^>]+href=/i.test(html));
ok('mock labels itself as non-persistent', /No database calls · nothing is saved/.test(html));
ok('staff and player audience lenses exist', /data-view="staff"/.test(html) && /data-view="player"/.test(html));
ok('player view hides staff-only truth and management', /\.player-view \.sidecol\{display:none\}/.test(html) && /class="sidecol staff-only"/.test(html));
ok('unidentified state withholds public rarity', /Rarity unrevealed/.test(html) && /Properties unrevealed/.test(html));
ok('smoky treatment is an explicit visual state', /class="smoke"/.test(html) && /\.hero\.unidentified/.test(html));
ok('identified state publishes name rarity and rules', /The Hexblade · Rare/.test(html) && /Known properties/.test(html));
ok('staff truth includes name rarity rules and lore', /True name/.test(html) && /True rarity/.test(html) && /Rules on identification/.test(html) && /Private lore/.test(html));
ok('history is declared oldest-first and append-only', /Oldest first · append-only/.test(html));
ok('history tab is plain language without an unexplained count', />History<\/button>/.test(html) && !/data-event-count/.test(html));
ok('recovered and assigned origin events are present', /kind:'Recovered'/.test(html) && /kind:'Assigned'/.test(html));
ok('identify action requires reveal confirmation', /data-action="identify"/.test(html) && /this reveals the prepared public truth/.test(html));
ok('rename promises stable permanent identity', /data-action="rename"/.test(html) && /permanent ID preserved/.test(html));
ok('custody presents the character name rather than the database key', /data-bearer>Cosmere Runestar/.test(html) && !/cosmererunestar-ae1a/.test(html));
ok('attunement requirement is an explicit staff choice', /data-action="attunement"/.test(html) && /Does not require attunement/.test(html) && /Requires attunement/.test(html));
ok('attunement presentation distinguishes required inactive and active truth', /No attunement required/.test(html) && /Requires attunement · not attuned/.test(html) && /Attuned · /.test(html));
ok('mock can preview all three attunement outcomes', /data-attune-state="none"/.test(html) && /data-attune-state="unattuned"/.test(html) && /data-attune-state="attuned"/.test(html));
ok('overview does not repeat custody equipment or identity blocks', !/class="facts"/.test(html) && !/data-fact-equipment/.test(html));
ok('overview heading follows the current public item name', /data-overview-name>The Runed Longsword/.test(html) && /querySelector\('\[data-overview-name\]'\)\.textContent=displayName/.test(html));
ok('overview avoids permission and form-label jargon', !/>Party-readable truth</.test(html) && !/>About this item</.test(html) && !/>Description</.test(html));
ok('equipment slot stays a quiet custody detail separate from attunement', /Held · main hand/.test(html) && /data-attunement>No attunement required/.test(html));
ok('bearer owns the attune action while both records stay synchronized', /bearer attunes or releases it from Gear/.test(html) && /durable item and character inventory update together/.test(html));
ok('removing the requirement clears active attunement', /if\(!requiresAttunement\)attuned=false/.test(html) && /frees that character\\'s attunement slot/.test(html));
ok('transfer names atomic custody and inventory movement', /data-action="transfer"/.test(html) && /Custody and the inventory row moved together/.test(html));
ok('transfer narrates cleared bearer-specific state', /slot and attunement were cleared/.test(html) && /container placement/.test(html));
ok('story-changing management appends a history event', /appendEvent\('Identified'/.test(html) && /appendEvent\('Renamed'/.test(html) && /appendEvent\('Transferred'/.test(html));
ok('management outcomes narrate through a live status', /role="status" aria-live="polite"/.test(html));
ok('touch controls meet a 48px minimum target', /--touch:48px/.test(html) && /min-height:var\(--touch\)/.test(html));
ok('mobile layout becomes a bottom sheet', /@media\(max-width:520px\)[\s\S]*?\.veil\{align-items:end/.test(html));
ok('reduced motion is respected', /prefers-reduced-motion:reduce/.test(html));
ok('mock never references Chronicle World quests or evolving-item wiring', !/chronicle\.html|world\.html|quest[_-]|transformed[_-]item/i.test(html));

console.log(`\nsmoke-item-history-management-mock: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
