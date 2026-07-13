#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const CharacterCombat = require(path.join(__dirname, '..', '..', 'character-combat.js'));
const ArmorAC = require(path.join(__dirname, '..', '..', 'armor-ac.js'));
const EquipSlots = require(path.join(__dirname, '..', '..', 'equip-slots.js'));
const ForgeKitDerive = require(path.join(__dirname, '..', 'forge-kit-derive.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓', name); }
  catch (err) { console.error('✗', name); throw err; }
}

const liadan = {
  key: 'liadan',
  name: 'Líadan Luchóg',
  updatedAt: '2026-07-13T02:56:00Z',
  structural: {
    classLabel: 'Bard 3 / Cleric 1',
    level: 4,
    abilities: {
      str: { score: 6, mod: -2 },
      dex: { score: 12, mod: 1 },
      wis: { score: 13, mod: 1 },
      cha: { score: 15, mod: 2 }
    },
    proficiencies: { armor: ['Light Armor', 'Medium Armor', 'Shields'] },
    combat: { ac: 12, acSource: 'stale cache', speed: 25, initiative: 1, hpMax: 31 }
  },
  vitals: { hp: 31, maxHp: 31 },
  inventory: [
    { name: 'Scale Mail', type: 'MA' },
    { name: 'Shield', type: 'S' },
    { name: 'Dagger', type: 'M' }
  ]
};

test('database vitals are the HP authority', () => {
  const out = CharacterCombat.derive(liadan, { ArmorAC, EquipSlots });
  assert.strictEqual(out.hp, 31);
  assert.strictEqual(out.maxHp, 31);
  assert.strictEqual(out.source, 'character-database');
});

test('inventory-derived AC beats stale structural.combat.ac', () => {
  const out = CharacterCombat.derive(liadan, { ArmorAC, EquipSlots });
  assert.strictEqual(out.ac, 17); // scale mail 14 + Dex 1 + shield 2
  assert.notStrictEqual(out.ac, liadan.structural.combat.ac);
  assert.match(out.acSource, /Scale Mail.*Shield/i);
});

test('projection matches the sheet first-time slot backfill', () => {
  const out = CharacterCombat.derive(liadan, { ArmorAC, EquipSlots });
  assert.strictEqual(out.inventory.find(x => x.name === 'Scale Mail').slot, 'ARMOUR');
  assert.strictEqual(out.inventory.find(x => x.name === 'Shield').slot, 'OFFHAND');
});

test('speed is derived from the same armor consequence', () => {
  const out = CharacterCombat.derive(liadan, { ArmorAC, EquipSlots });
  assert.strictEqual(out.speed, 25);
  assert.strictEqual(out.speedPenalty, 0);
});

test('missing ArmorAC fails closed instead of returning cached AC', () => {
  assert.throws(
    () => CharacterCombat.derive(liadan, { ArmorAC: {}, EquipSlots }),
    err => err && err.code === 'CHARACTER_COMBAT_DEPENDENCY' && err.dependency === 'ArmorAC'
  );
});

test('missing EquipSlots fails closed instead of changing projection semantics', () => {
  assert.throws(
    () => CharacterCombat.derive(liadan, { ArmorAC, EquipSlots: {} }),
    err => err && err.code === 'CHARACTER_COMBAT_DEPENDENCY' && err.dependency === 'EquipSlots'
  );
});

test('invalid armor projection fails closed', () => {
  const badArmor = {
    classifyArmor: ArmorAC.classifyArmor,
    deriveAC() { return { ac: NaN, source: 'broken test double' }; }
  };
  assert.throws(
    () => CharacterCombat.derive(liadan, { ArmorAC: badArmor, EquipSlots }),
    err => err && err.code === 'CHARACTER_COMBAT_AC'
  );
});


test('ForgeKit consumes the shared database projection', () => {
  const kit = ForgeKitDerive.derive(liadan, {});
  assert.strictEqual(kit.hp, 31);
  assert.strictEqual(kit.maxHp, 31);
  assert.strictEqual(kit.ac, 17);
  assert.match(kit.acSource, /Scale Mail.*Shield/i);
});

test('one projection failure becomes a disabled error kit without poisoning the next character', () => {
  const savedCombat = globalThis.CharacterCombat;
  const savedError = console.error;
  try {
    console.error = function () {};
    globalThis.CharacterCombat = { derive() { throw new Error('forced per-character failure'); } };
    const broken = ForgeKitDerive.derive(liadan, {});
    assert.strictEqual(broken.fallback, 'error');
    assert.strictEqual(broken.unavailable, true);
    assert.strictEqual(broken.ac, 0);
    assert.strictEqual(broken.hp, 0);
    assert.match(broken.loadError, /Líadan.*forced per-character failure/);
  } finally {
    globalThis.CharacterCombat = savedCombat;
    console.error = savedError;
  }
  const healthy = ForgeKitDerive.derive(liadan, {});
  assert.strictEqual(healthy.ac, 17);
  assert.strictEqual(healthy.hp, 31);
});

console.log(`\n${passed} character-combat smokes green.`);
