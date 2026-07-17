import { buildSpellAttacks } from '../../weapon-actions.js';
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
console.log('\nagonizing: '+pass+' passed, '+fail+' failed'); if(fail)process.exit(1);
