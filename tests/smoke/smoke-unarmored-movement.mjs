// Soul Shards smoke for Monk Unarmored Movement. Exercises the real shared
// derive and the Forge output contract; the mounted sheet is browser-checked.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ArmorAC = require('../../armor-ac.js');
const Engine = require('../../soul-shards-engine.js');
const Spellcasting = require('../../soul-shards-spellcasting.js');
const Derive = require('../../soul-shards-derive.js');

let pass = 0, fail = 0;
const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log('  FAIL: ' + label); } };

const MONK = {
  name: 'Monk', source: 'PHB', hd: 8, savingThrows: ['str', 'dex'],
  subclassTitle: 'Monastic Tradition', subclassChoiceLevel: 3,
  featuresByLevel: {
    1: [{ name: 'Unarmored Defense', level: 1, source: 'PHB', entries: ['Defense without armor.'] }],
    2: [{ name: 'Unarmored Movement', level: 2, source: 'PHB', entries: ['Speed increases by 10 feet.'] }]
  }, slotsByLevel: {}, subclasses: []
};
const forged = Derive.deriveStructural({
  name: 'Caim', abilities: { str: 14, dex: 18, con: 14, int: 10, wis: 16, cha: 12 },
  classes: [{ model: MONK, level: 3 }],
  race: { name: 'Tiefling', speed: { walk: 30 }, traits: [] },
  proficiencies: { skills: [], languages: [], tools: [], weapons: [], armor: [] },
  inventory: []
}, { engine: Engine, spellcasting: Spellcasting, armorAC: ArmorAC });
ok(forged.structural.combat.baseSpeed === 30, 'Forge retains Tiefling base speed 30');
ok(forged.structural.combat.speed === 40, 'Forge derives Monk 3 speed 40');
ok(forged.structural.combat.speedIncludesUnarmoredMovement === true, 'Forge marks the derived Monk bonus');

console.log((fail ? 'FAIL' : 'PASS') + ' unarmored-movement: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
