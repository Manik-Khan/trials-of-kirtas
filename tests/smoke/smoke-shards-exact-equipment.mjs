// Exact starting-weapon choices: exercise the real ItemsUI inventory compiler.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CharacterReadiness = require('../../character-readiness.js');
const html = readFileSync(new URL('../../shards.html', import.meta.url), 'utf8');
const start = html.indexOf('var ItemsUI = (function () {');
const end = html.indexOf('// ── Proficiencies step', start);
if (start < 0 || end < 0) throw new Error('ItemsUI source not found');
const source = html.slice(start, end);
const draft = { equipment: { mode: 'gear', picks: {}, exact: {}, gold: null } };
const SoulShardsData = {
  loadClass: async () => ({ name: 'Barbarian' }),
  loadBackgrounds: async () => [],
  backgroundEquipment: () => [],
  parseStartingEquipment: () => ({
    groups: [{ kind: 'fixed', source: 'class', items: [{ name: 'any martial melee weapon', qty: 2, category: 'weaponMartialMelee' }] }],
    goldAlternative: null
  })
};
const ItemsUI = new Function(
  'draft', 'SoulShardsData', 'CharacterReadiness', 'CHARACTER_READINESS_ON', 'chosenClass', 'saveDraft', 'q',
  source + '\nreturn ItemsUI;'
)(draft, SoulShardsData, CharacterReadiness, true, () => ({ n: 'Barbarian' }), () => {}, () => null);

let pass = 0, fail = 0;
function ok(label, condition) {
  condition ? pass++ : fail++;
  console.log((condition ? '  ok   ' : '  FAIL ') + label);
}

await ItemsUI.ensureLoaded();
let gear = ItemsUI.inventoryForCharacter();
ok('one unresolved row is emitted for each required weapon', gear.inventory.length === 2);
ok('unpicked categories remain explicit blockers', gear.inventory.every(row => row.unresolved && row.category === 'weaponMartialMelee'));

draft.equipment.exact['0:0:0'] = 'Glaive';
draft.equipment.exact['0:0:1'] = 'Halberd';
gear = ItemsUI.inventoryForCharacter();
ok('exact picks replace category placeholders', gear.inventory.map(row => row.name).join('|') === 'Glaive|Halberd');
ok('exact picks contain no unresolved metadata', gear.inventory.every(row => !row.unresolved && !row.category));

draft.equipment.exact['0:0:1'] = 'Longbow';
gear = ItemsUI.inventoryForCharacter();
ok('a stale pick from another category cannot leak through', gear.inventory[1].unresolved === true);

const reconcileStart = html.indexOf('function reconcileStartingChoices(inventory, nextInventory){');
const reconcileEnd = html.indexOf('\n}\nfunction forgeCommit', reconcileStart) + 2;
const reconcileStartingChoices = new Function(
  'CharacterReadiness',
  'return (' + html.slice(reconcileStart, reconcileEnd) + ');'
)(CharacterReadiness);
const reconciled = reconcileStartingChoices(
  [{ name: 'Potion of Healing' }, { name: 'any martial melee weapon (your choice)', qty: 2 }],
  [{ name: 'Glaive', qty: 1, startingChoice: 'weaponMartialMelee' }, { name: 'Halberd', qty: 1, startingChoice: 'weaponMartialMelee' }, { name: 'Explorer Pack' }]
);
ok('reforge replaces only old category placeholders', reconciled.changed && reconciled.inventory.map(row => row.name).join('|') === 'Potion of Healing|Glaive|Halberd');
ok('reforge keeps unrelated played gear', reconciled.inventory[0].name === 'Potion of Healing');

const legacyDraft = { equipment: { mode: 'gear', picks: {}, gold: null } };
const LegacyItemsUI = new Function(
  'draft', 'SoulShardsData', 'CharacterReadiness', 'CHARACTER_READINESS_ON', 'chosenClass', 'saveDraft', 'q',
  source + '\nreturn ItemsUI;'
)(legacyDraft, SoulShardsData, CharacterReadiness, false, () => ({ n: 'Barbarian' }), () => {}, () => null);
await LegacyItemsUI.ensureLoaded();
const legacyGear = LegacyItemsUI.inventoryForCharacter();
ok('flag off preserves the current placeholder path', legacyGear.inventory.length === 1 &&
  legacyGear.inventory[0].qty === 2 && /your choice/.test(legacyGear.inventory[0].name));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
