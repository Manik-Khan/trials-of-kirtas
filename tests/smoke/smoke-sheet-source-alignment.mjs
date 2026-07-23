import { readFileSync } from 'fs';
import { toRenderShape } from '../../sheet-mount.js';

let pass = 0, fail = 0;
const ok = (name, condition) => { if (condition) pass++; else { fail++; console.log('  FAIL ' + name); } };

const row = {
  key:'caim', name:'Caim', vitals:{hp:24}, inventory:[],
  structural:{
    name:'Caim', race:'Zariel Tiefling', combat:{hpMax:24,speed:40},
    spells:{level2:[{name:'Hellish Rebuke'}]},
    spellcasting:{groups:[{level:1,spells:[{name:'Searing Smite'}]},{level:2,spells:[{name:'Branding Smite'}]}]},
    features:[{name:'Flurry of Blows',source:'class:Monk'}]
  }
};
const shape = toRenderShape(row);
const spellNames = shape.structural.spellcasting.groups.flatMap(g => g.spells.map(s => s.name));
ok('real full-sheet render shape ignores stale Hellish Rebuke', !spellNames.includes('Hellish Rebuke'));
ok('real full-sheet render shape keeps Branding Smite', spellNames.includes('Branding Smite'));
ok('real full-sheet render shape keeps Caim speed 40', shape.structural.combat.speed === 40);

const party = readFileSync(new URL('../../party.html', import.meta.url), 'utf8');
const float = readFileSync(new URL('../../combat-sheet-float.js', import.meta.url), 'utf8');
const forge = readFileSync(new URL('../../forge/index.html', import.meta.url), 'utf8');
ok('Party imports the full-sheet render shape', party.includes("import { toRenderShape } from './sheet-mount.js?v=src1'"));
ok('Party receives full character-row realtime updates', party.includes("['vitals','inventory','equipment','currency','bio','notes']"));
ok('reopening a mounted sheet refreshes it', float.includes('if (tabs[key]) { activate(key); refresh(key); return; }'));
ok('new Forge tables await live character identity', forge.includes('await loadLiveStats();\n    var savedMap='));
ok('Forge roster uses current live rows', forge.includes('var pcs = forgePartyRows();'));

console.log('smoke-sheet-source-alignment: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
