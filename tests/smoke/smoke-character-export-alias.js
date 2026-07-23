const Export = require('../../netlify/functions/lib/characters-export-core.js');

let pass = 0, fail = 0;
function ok(name, condition) { if (condition) pass++; else { fail++; console.log('  FAIL ' + name); } }

const live = {
  key:'cosmererunestar-ae1a',
  structural:{name:'Cosmere Runestar',spellcasting:{groups:[{level:1,spells:[{name:'Shield',source:'Sorcerer'}]}]}},
  vitals:{hp:30}, inventory:[], equipment:{}, currency:{}, bio:{}, notes:'', updated_at:'2026-07-22T00:00:00Z'
};
const canonical = Export.rowToFile(live);
const alias = Export.rowToAliasFile(live, Export.stableAliasFor(live));

ok('Cosmere renamed row maps to the stable cosmere alias', Export.stableAliasFor(live) === 'cosmere');
ok('canonical backup retains the real Supabase key', canonical.key === 'cosmererunestar-ae1a');
ok('compatibility backup retains the stable filename identity', alias.key === 'cosmere');
ok('compatibility backup records its canonical source key', alias.sourceKey === 'cosmererunestar-ae1a');
ok('compatibility backup carries the current structural data', alias.structural.spellcasting.groups[0].spells[0].name === 'Shield');

console.log('smoke-character-export-alias: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
