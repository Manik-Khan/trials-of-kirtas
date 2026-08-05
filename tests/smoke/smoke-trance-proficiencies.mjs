// smoke-trance-proficiencies.mjs — elven long-rest choice entitlement + projection.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TP = require('../../trance-proficiencies.js');
const { planRest } = await import('../../sheet-actions.js?smoke=trance');

let pass = 0, fail = 0;
const ok = (label, condition, detail) => { if (condition) pass++; else { fail++; console.error('FAIL:', label, detail || ''); } };

const shadar = TP.specFromRace({ name:'Shadar-Kai', source:'MPMM' });
const astral = TP.specFromRace({ name:'Astral Elf', source:'AAG' });
const oldElf = TP.specFromRace({ name:'Elf', source:'PHB' });
ok('MPMM Trance grants two weapon-or-tool choices', shadar && shadar.choices.length === 2 && shadar.choices.every(c => c.kinds.join(',') === 'weapon,tool'), shadar);
ok('AAG Astral Trance grants one skill plus one weapon-or-tool choice', astral && astral.choices.length === 2 && astral.choices[0].kinds[0] === 'skill' && astral.choices[1].kinds.includes('tool'), astral);
ok('PHB Elf Trance grants no temporary proficiency choice', oldElf === null, oldElf);

const fighter = {
  race:'Shadar-Kai', proficiencyBonus:2,
  proficiencies:{ skills:['Athletics'], weapons:['Simple','Martial'], tools:[] },
  skills:[{name:'Arcana',attr:'int',prof:false,bonus:2},{name:'Perception',attr:'wis',prof:false,bonus:1},{name:'Insight',attr:'wis',prof:false,bonus:1}],
  combat:{hpMax:40}
};
ok('fighter with Simple + Martial has no redundant Trance weapon choices', TP.optionsForKind(shadar, 0, 'weapon', fighter, []).length === 0);
ok('fighter still receives tool choices', TP.optionsForKind(shadar, 0, 'tool', fighter, []).includes("Thieves' Tools"));

const astralPc = Object.assign({}, fighter, { race:'Astral Elf', restProficiencies:astral });
const picks = [{id:'skill',kind:'skill',name:'Arcana'},{id:'memory',kind:'tool',name:"Thieves' Tools"}];
const rested = planRest('long', astralPc, { hp:7, hpTemp:4, conditions:['poisoned'], custom:'kept' }, picks);
ok('long rest stores current Trance picks in vitals', rested.vitals.temporaryProficiencies && rested.vitals.temporaryProficiencies.selections.length === 2, rested.vitals);
ok('long rest preserves unrelated vitals fields', rested.vitals.custom === 'kept' && Array.isArray(rested.vitals.conditions), rested.vitals);
const effective = TP.apply(astralPc, rested.vitals);
const arcana = effective.skills.find(s => s.name === 'Arcana');
ok('temporary skill proficiency adds proficiency bonus to rolls', arcana.prof && arcana.bonus === 4 && arcana.temporaryProficiency === true, arcana);
ok('temporary tool appears only in effective proficiencies', effective.proficiencies.tools.includes("Thieves' Tools") && !astralPc.proficiencies.tools.includes("Thieves' Tools"));
ok('permanent proficiency snapshot stays separate', effective.baseProficiencies.skills.length === 1 && effective.baseProficiencies.skills[0] === 'Athletics', effective.baseProficiencies);

console.log(`\nsmoke-trance-proficiencies: ${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
