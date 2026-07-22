// Mage Armor known-answer smoke: casting state, AC selection, shared combat
// projection, and long-rest cleanup all use the real sheet functions.
import { createRequire } from 'module';
import { mageArmorActive, planRest, setMageArmor } from '../../sheet-actions.js';

const require = createRequire(import.meta.url);
const ArmorAC = require('../../armor-ac.js');
const CharacterCombat = require('../../character-combat.js');
const EquipSlots = require('../../equip-slots.js');

let pass = 0, fail = 0;
const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + label); } };
const structural = {
  classLabel: 'Wizard 3',
  abilities: { str: { score: 8, mod: -1 }, dex: { score: 16, mod: 3 }, con: { mod: 1 }, wis: { mod: 0 } },
  proficiencies: { armor: ['Shields'] },
  combat: { ac: 13, speed: 30, initiative: 3, hpMax: 18 }
};

{
  const r = ArmorAC.deriveAC([], structural, { mageArmor: true });
  ok(r.ac === 16, 'Mage Armor = 13 + Dex 3');
  ok(r.source === 'Mage Armor', 'AC source names Mage Armor');
}

{
  const r = ArmorAC.deriveAC([{ name: 'Shield', type: 'S', ac: 2 }], structural, { mageArmor: true });
  ok(r.ac === 18, 'Mage Armor can add a worn shield');
  ok(r.source === 'Mage Armor + Shield', 'source includes Mage Armor + Shield');
}

{
  const r = ArmorAC.deriveAC([{ name: 'Leather', type: 'LA', ac: 11 }], structural, { mageArmor: true });
  ok(r.ac === 14, 'worn body armor suppresses Mage Armor');
  ok(r.source === 'Leather', 'worn armor remains the named AC source');
}

{
  const monk = Object.assign({}, structural, { classLabel: 'Monk 3', abilities: Object.assign({}, structural.abilities, { wis: { mod: 4 } }) });
  const r = ArmorAC.deriveAC([], monk, { mageArmor: true });
  ok(r.ac === 17, 'better Unarmored Defense wins over Mage Armor');
  ok(/Monk/.test(r.source), 'winning Monk calculation remains the source');
}

{
  const row = { structural, vitals: { hp: 18, mageArmor: true }, inventory: [] };
  const r = CharacterCombat.derive(row, { ArmorAC, EquipSlots });
  ok(r.ac === 16, 'shared CharacterCombat projection carries Mage Armor into a new encounter');
  ok(r.acSource === 'Mage Armor', 'shared projection names Mage Armor');
}

{
  const before = { hp: 8, hpTemp: 2, conditions: ['prone'], pipState: { spell_1: 1 } };
  const active = setMageArmor(before, true);
  ok(mageArmorActive(active), 'casting sets the saved Mage Armor flag');
  ok(active.hp === 8 && active.conditions[0] === 'prone' && !before.mageArmor, 'cast preserves vitals and does not mutate the input');
  const dismissed = setMageArmor(active, false);
  ok(!mageArmorActive(dismissed) && dismissed.hp === 8, 'dismiss clears only Mage Armor');
}

{
  const rested = planRest('long', structural, { hp: 4, mageArmor: true, pipState: { spell_1: 1 } }).vitals;
  ok(!mageArmorActive(rested), 'long rest ends Mage Armor');
}

console.log((fail ? '\u2717' : '\u2713') + ' mage-armor: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
