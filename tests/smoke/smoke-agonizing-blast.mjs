import { buildSpellAttacks } from '../../weapon-actions.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ForgeKit = require('../../forge/forge-kit-derive.js');
let pass=0,fail=0; const ok=(n,c,d)=>{c?pass++:(fail++,console.log('  FAIL:',n,d!==undefined?JSON.stringify(d):''));};
// warlock, spellAttackBonus 5, profBonus 2 → spellMod = 3 (CHA)
const base={ level:5, proficiencyBonus:2, combat:{spellAttackBonus:5, spellSaveDC:13},
  spellcasting:{groups:[{level:0,heading:'Cantrips',spells:[{name:'Eldritch Blast'}]}]} };
const withAB = Object.assign({}, base, { features:[{name:'Eldritch Invocation: Agonizing Blast'},{name:'Hex Warrior'}] });
const noAB   = Object.assign({}, base, { features:[{name:'Eldritch Invocation: Repelling Blast'}] });
const ebOf = s => buildSpellAttacks(s).find(a=>/eldritch blast/i.test(a.label));
const a1=ebOf(withAB), a2=ebOf(noAB);
ok('EB exists for warlock', !!a1, a1&&a1.label);
ok('Agonizing Blast → EB dmgMod = +3 (CHA)', a1 && a1.dmgMod===3, a1&&{dmgMod:a1.dmgMod});
ok('no Agonizing Blast → EB dmgMod = 0', a2 && a2.dmgMod===0, a2&&{dmgMod:a2.dmgMod});
ok('EB still 1d10 per beam either way', a1&&a1.dmgDice==='1d10'&&a2&&a2.dmgDice==='1d10', {w:a1&&a1.dmgDice,n:a2&&a2.dmgDice});
ok('EB to-hit unchanged (+5)', a1&&a1.hitMod===5);
const liveRow={key:'cosmererunestar-ae1a',name:'Cosmere Runestar',structural:Object.assign({},withAB,{
  name:'Cosmere Runestar',level:4,abilities:{cha:{score:16,mod:3}},combat:Object.assign({},withAB.combat,{hpMax:20,ac:18,speed:30,initiative:2})
}),vitals:{hp:20},inventory:[]};
const forge=ForgeKit.derive(liveRow,{assembledActions:buildSpellAttacks(liveRow.structural)});
const forgeEb=forge.actions.filter(a=>/^Eldritch Blast$/i.test(a.label))[0];
ok('Forge remains on the live derived sheet', forge.derived===true&&forge.fallback==null, {derived:forge.derived,fallback:forge.fallback});
ok('Forge preserves Agonizing Blast after action dedupe', forgeEb&&forgeEb.dmg==='1d10+3', forgeEb);
ok('Forge keeps the character display name separate from its key', forge.name==='Cosmere Runestar'&&forge.key==='cosmererunestar-ae1a', {name:forge.name,key:forge.key});
console.log('\nagonizing: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
