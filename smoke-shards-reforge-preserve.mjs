// smoke-shards-reforge-preserve.mjs
// Pulls the actual spliced code out of shards.html and tests it:
//  - the spell-slots label uses the subclass name for via-subclass casters
//  - a reforge preserves sheet-side structural fields and restores a null portrait
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./shards.html', import.meta.url), 'utf8');
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };

// ---- slots label (extract the real expression line) ----
const pmLine = (html.match(/var poolName = e\.pact[^\n]*/) || [])[0];
ok('poolName line found in shards.html', !!pmLine);
const poolName = new Function('e', pmLine + ' return poolName;');

ok('Eldritch Knight -> "Eldritch Knight Slots"',
   poolName({ pact:false, mode:'known', viaSub:true, subclass:'Eldritch Knight', cls:'Fighter' }) === 'Eldritch Knight Slots');
ok('Arcane Trickster -> "Arcane Trickster Slots"',
   poolName({ pact:false, mode:'known', viaSub:true, subclass:'Arcane Trickster', cls:'Rogue' }) === 'Arcane Trickster Slots');
ok('full Bard (not via-sub) -> "Bard Slots"',
   poolName({ pact:false, mode:'known', viaSub:false, subclass:null, cls:'Bard' }) === 'Bard Slots');
ok('Warlock -> "Pact Magic"',
   poolName({ pact:true, mode:'known', viaSub:false, subclass:null, cls:'Warlock' }) === 'Pact Magic');
ok('prepared/spellbook caster -> "Spell Slots"',
   poolName({ pact:false, mode:'spellbook', viaSub:false, subclass:null, cls:'Wizard' }) === 'Spell Slots');

// ---- reforge merge (extract the real block) ----
const mStart = html.indexOf('var prevStruct = (cur && cur.structural)');
const mEnd = html.indexOf('var patch = { structural: mergedStruct };');
ok('merge block found in shards.html', mStart !== -1 && mEnd !== -1 && mEnd > mStart);
const mergeBlock = html.slice(mStart, mEnd);
const doMerge = new Function('cur', 'structural', mergeBlock + ' return mergedStruct;');

const cur = { structural: {
  portrait: 'https://res.cloudinary.com/df0tgoiyb/image/upload/v1/kirtas/characters/vesperian.png',
  actions: [{ id:'bb_vesperian', label:'Booming Blade', dmgDice:'1d8', critDice:'2d8', hitMod:6 }],
  appearance: { eyes:'Violet', hair:'Midnight' },
  inspiration: true,
  rollerFlags: { advantage:false },
  defaultSlots: [4,3,0,0],
  abilities: { STR:{ score:8, mod:-1 } },
  name: 'Vesperian (old)'
}};
// derived structural: new build fields, no actions/appearance, portrait forced null
const derived = {
  portrait: null,
  abilities: { STR:{ score:10, mod:0 } },
  name: 'Vesperian',
  spellcasting: { groups: [] },
  classLabel: 'Fighter 3',
  _build: { method:'manual' }
};
const merged = doMerge(cur, derived);

ok('portrait restored from existing when derive is null', merged.portrait === cur.structural.portrait);
ok('hand-authored actions preserved (Booming Blade survives)',
   Array.isArray(merged.actions) && merged.actions[0].id === 'bb_vesperian' && merged.actions[0].dmgDice === '1d8');
ok('appearance block preserved', merged.appearance && merged.appearance.eyes === 'Violet');
ok('inspiration preserved', merged.inspiration === true);
ok('rollerFlags preserved', merged.rollerFlags && merged.rollerFlags.advantage === false);
ok('defaultSlots preserved', JSON.stringify(merged.defaultSlots) === JSON.stringify([4,3,0,0]));
// build-derived fields DO get overwritten by the new build
ok('abilities overwritten by the new build', merged.abilities.STR.score === 10);
ok('name overwritten by the new build', merged.name === 'Vesperian');
ok('spellcasting comes from the new build', !!merged.spellcasting && Array.isArray(merged.spellcasting.groups));
ok('_build snapshot comes from the new build', merged._build && merged._build.method === 'manual');

// when the derive DOES carry a portrait, it wins
const merged2 = doMerge(cur, Object.assign({}, derived, { portrait: 'new.png' }));
ok('a non-null derived portrait is not overridden', merged2.portrait === 'new.png');

// degrade safely when the current row failed to load
const merged3 = doMerge(null, derived);
ok('null cur degrades to a plain structural write', merged3 && merged3.name === 'Vesperian' && merged3.portrait === null);

console.log('\nsmoke-shards-reforge-preserve: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
