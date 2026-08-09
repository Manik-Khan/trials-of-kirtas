// Known-answer smoke for the shared Chronicle → NPC / World codex seam.
const Codex = require('../../living-codex.js');
const fs = require('fs');
const path = require('path');

let pass = 0;
let fail = 0;
function test(name, condition) {
  if (condition) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.error('  ✗ ' + name); }
}

console.log('smoke-living-codex');

const characters = [
  { id:'chonkalius-a1b2', label:'Chonkalius', type:'character', curated:true },
];
const npcs = [
  { id:'chonkalius', label:'Chonkalius', type:'npc', curated:false },
  { id:'darius', label:'General Darius', type:'npc', curated:true },
];
const locations = [
  { id:'mortaine', label:'Mortaine', type:'location', origin:'canon', curated:true },
  { id:'goldleaf-tavern', label:'Goldleaf Tavern', type:'location', origin:'journal', curated:true, parentId:'mortaine', mapX:null, mapY:null },
  { id:'mistfall', label:'Mistfall', type:'location', origin:'journal', curated:true, parentId:null, mapX:null, mapY:null },
  { id:'red-watch', label:'Red Watch', type:'location', origin:'journal', curated:true, parentId:null, mapX:42.25, mapY:61.5 },
  { id:'rumor-road', label:'Rumor Road', type:'location', origin:'journal', curated:false, parentId:null, mapX:null, mapY:null },
];

test('slug creates stable hyphen keys', Codex.slug('  Goldleaf Tavern! ') === 'goldleaf-tavern');
test('player character matches an old unresolved NPC key', Codex.samePerson(npcs[0], characters[0]));
test('player characters are removed from the NPC pool', Codex.withoutCharacters(npcs, characters).map(n => n.id).join(',') === 'darius');
test('nested locations stay under their parent', Codex.childrenOf(locations, 'mortaine').map(l => l.id).join(',') === 'goldleaf-tavern');
test('nested locations do not become continent pins', !Codex.mappedTopLevel(locations).some(l => l.id === 'goldleaf-tavern'));
test('placed top-level locations become map pins', Codex.mappedTopLevel(locations).map(l => l.id).join(',') === 'red-watch');
test('confirmed top-level locations without coordinates await placement', Codex.unmappedTopLevel(locations).map(l => l.id).join(',') === 'mistfall');
test('uncurated locations never enter the placement list', !Codex.unmappedTopLevel(locations).some(l => l.id === 'rumor-road'));

const migration = fs.readFileSync(path.resolve(__dirname, '../../journal/sql/schema_delta_living_codex.sql'), 'utf8');
test('migration rewrites old player mentions to character chips', migration.includes('data-mention-type="character"'));
test('character repair matches full names/keys, not ambiguous first names', !migration.includes('split_part('));
test('migration constrains the three location placement states', migration.includes("'nested','unmapped','placed'"));

console.log(`\n${pass}/${pass + fail} pass`);
process.exit(fail ? 1 : 0);
