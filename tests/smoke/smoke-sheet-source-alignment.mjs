import { readFileSync } from 'fs';
import { createRequire } from 'module';
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

const require = createRequire(import.meta.url);
globalThis.ArmorAC = require('../../armor-ac.js');
globalThis.EquipSlots = require('../../equip-slots.js');
const vesperianRow = {
  key:'vesperian', name:'Vesperian Vale',
  structural:{
    name:'Vesperian Vale', classLabel:'Fighter 4', abilities:{dex:{score:18,mod:4}},
    proficiencies:{armor:['Shields']}, combat:{hpMax:40,speed:30,initiative:4}
  },
  vitals:{hp:40,mageArmor:true},
  inventory:[{name:'Shield',type:'S',ac:2,slot:'OFFHAND'}]
};
const vesperian = toRenderShape(vesperianRow);
ok('real Party projection derives Vesperian Mage Armor plus Shield as AC 19', vesperian.structural.combat.ac === 19);
ok('real Party projection names the Vesperian AC source', vesperian.structural.combat.acSource === 'Mage Armor + Shield');

const party = readFileSync(new URL('../../party.html', import.meta.url), 'utf8');
const float = readFileSync(new URL('../../combat-sheet-float.js', import.meta.url), 'utf8');
const forge = readFileSync(new URL('../../forge/index.html', import.meta.url), 'utf8');
const fmtMatch = party.match(/    function fmtCt\(t\) \{[\s\S]*?^    \}/m);
const partyFmtCt = fmtMatch ? Function(fmtMatch[0] + '\nreturn fmtCt;')() : null;
ok('Party imports the full-sheet render shape', party.includes("import { toRenderShape } from './sheet-mount.js?v=src1'"));
ok('Party receives full character-row realtime updates', party.includes("['vitals','inventory','equipment','currency','bio','notes']"));
const armorInclude = party.indexOf('<script src="armor-ac.js?v=um1"></script>');
const slotsInclude = party.indexOf('<script src="equip-slots.js?v=cc2"></script>');
const projectionImport = party.indexOf("import { toRenderShape } from './sheet-mount.js?v=src1'");
const forgePartyCardMatch = forge.match(/  function partyCard\(c\)\{[\s\S]*?^  \}/m);
const forgePartyCard = forgePartyCardMatch
  ? Function('window', forgePartyCardMatch[0] + '\nreturn partyCard;')({
      CharacterCombat: require('../../character-combat.js')
    })
  : null;
const forgeVesperianCard = forgePartyCard && forgePartyCard(vesperianRow);
ok('Party loads the live AC authority before projecting cards', armorInclude >= 0 && armorInclude < projectionImport);
ok('Party loads the equipment-slot authority before projecting cards', slotsInclude >= 0 && slotsInclude < projectionImport);
ok('Forge extracts its real party-card projection', typeof forgePartyCard === 'function');
ok('Forge party card derives Vesperian Mage Armor plus Shield as AC 19', forgeVesperianCard && forgeVesperianCard.ac === 19);
ok('Party extracts its real casting-time formatter', typeof partyFmtCt === 'function');
ok('Party formats a raw bonus-action casting time', partyFmtCt && partyFmtCt([{number:1,unit:'bonus'}]) === '1 bonus action');
ok('Party formats plural raw casting times', partyFmtCt && partyFmtCt([{number:2,unit:'action'}]) === '2 actions');
ok('Party spell rows use the casting-time formatter', party.includes('esc(fmtCt(s2.time || s2.castingTime))'));
ok('reopening a mounted sheet refreshes it', float.includes('if (tabs[key]) { activate(key); refresh(key); return; }'));
ok('new Forge tables await live character identity', forge.includes('await loadLiveStats();\n    var savedMap='));
ok('Forge roster uses current live rows', forge.includes('var pcs = forgePartyRows();'));

console.log('smoke-sheet-source-alignment: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
