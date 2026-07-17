// smoke-equip-slots.mjs
// ---------------------------------------------------------------------------
// Pins equip-slots.js: the item -> slot-category classifier (5etools type codes
// + the wondrous name heuristic), the 8-slot taxonomy, slotsFor/canEquip,
// wornInSlot, and the first-time backfill (best-fit, respects pre-set slots).
// ---------------------------------------------------------------------------
await import('../../equip-slots.js');
const ES = globalThis.EquipSlots;

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };
const eq = (a, b, l) => ok(a === b, l + (a === b ? '' : '  (got ' + JSON.stringify(a) + ', exp ' + JSON.stringify(b) + ')'));

ok(ES && typeof ES.classifyItem === 'function', 'EquipSlots.classifyItem exposed');

// ── classify by 5etools type code ──
eq(ES.classifyItem({ type: 'LA' }), 'armor',  'LA -> armor');
eq(ES.classifyItem({ type: 'MA' }), 'armor',  'MA -> armor');
eq(ES.classifyItem({ type: 'HA|XPHB' }), 'armor', 'HA with source suffix -> armor');
eq(ES.classifyItem({ type: 'S' }),  'shield', 'S -> shield');
eq(ES.classifyItem({ type: 'RG' }), 'ring',   'RG -> ring');
eq(ES.classifyItem({ type: 'ST' }), 'staff',  'ST -> staff');
eq(ES.classifyItem({ type: 'M' }),  'weapon', 'M -> weapon');
eq(ES.classifyItem({ type: 'R' }),  'weapon', 'R -> weapon');
eq(ES.classifyItem({ weaponCategory: 'martial' }), 'weapon', 'weaponCategory -> weapon');
eq(ES.classifyItem({ dmg1: '1d8' }), 'weapon', 'dmg1 -> weapon');

// ── wondrous catch-all -> name heuristic ──
eq(ES.classifyItem({ type: 'W', name: 'Cloak of Protection' }), 'cloak',  'wondrous cloak');
eq(ES.classifyItem({ type: 'W', name: 'Mantle of Spell Resistance' }), 'cloak', 'mantle -> cloak');
eq(ES.classifyItem({ type: 'W', name: 'Amulet of Health' }), 'amulet', 'wondrous amulet');
eq(ES.classifyItem({ type: 'W', name: 'Periapt of Wound Closure' }), 'amulet', 'periapt -> amulet');
eq(ES.classifyItem({ type: 'W', name: 'Helm of Telepathy' }), 'head', 'helm -> head');
eq(ES.classifyItem({ type: 'W', name: 'Circlet of Blasting' }), 'head', 'circlet -> head');
eq(ES.classifyItem({ type: 'W', name: 'Ring of the Ram' }), 'ring', 'wondrous-typed ring by name -> ring');
eq(ES.classifyItem({ type: 'W', name: 'Boots of Speed' }), null, 'boots -> null (no feet slot yet)');
eq(ES.classifyItem({ type: 'W', name: 'Ioun Stone of Mastery' }), null, 'ioun stone -> null');
eq(ES.classifyItem({ name: 'Strange Cloak' }), 'cloak', 'untyped homebrew + name -> cloak');

// ── non-equippable categories ──
eq(ES.classifyItem({ type: 'WD', name: 'Wand of Web' }), null, 'wand -> null (carried, still attunable)');
eq(ES.classifyItem({ type: 'RD', name: 'Rod of the Pact Keeper' }), null, 'rod -> null');
eq(ES.classifyItem({ type: 'P', name: 'Potion of Healing' }), null, 'potion -> null');
eq(ES.classifyItem({ type: 'G', name: "Explorer's Pack" }), null, 'gear -> null');
ok(ES.classifyItem(null) === null, 'null item -> null');

// ── slot taxonomy ──
eq(ES.SLOTS.length, 8, 'eight slots');
eq(ES.SLOTS.filter(s => s.ac).map(s => s.key).join(','), 'ARMOUR,OFFHAND', 'AC-feeding slots are Armour + Off Hand');
eq(ES.slotsFor('ring').join(','), 'RING1,RING2', 'ring -> two ring slots');
eq(ES.slotsFor('weapon').join(','), 'MAINHAND,OFFHAND', 'weapon -> main + off hand');
eq(ES.slotsFor('cloak').join(','), 'CLOAK', 'cloak -> Cloak');
eq(ES.slotsFor('boots' /* unknown */).length, 0, 'unknown cat -> no slot');
ok(ES.canEquip({ type: 'HA' }) === true, 'armour is equippable');
ok(ES.canEquip({ type: 'WD', name: 'Wand' }) === false, 'wand is not equippable');

// ── wornInSlot ──
const inv0 = [{ name: 'Plate', slot: 'ARMOUR' }, { name: 'Shield', slot: 'OFFHAND' }];
eq((ES.wornInSlot(inv0, 'ARMOUR') || {}).name, 'Plate', 'wornInSlot finds the ARMOUR item');
ok(ES.wornInSlot(inv0, 'HEAD') === null, 'empty slot -> null');

// ── backfill: un-slotted bag -> best-fit, best armour wins ARMOUR ──
const bag = [
  { id: 'leather', name: 'Leather', type: 'LA', ac: 11 },
  { id: 'plate',   name: 'Plate',   type: 'HA', ac: 18 },
  { id: 'shield',  name: 'Shield',  type: 'S',  ac: 2 },
  { id: 'sword',   name: 'Longsword', type: 'M' },
  { id: 'dagger',  name: 'Dagger',  type: 'M' },
  { id: 'r1',      name: 'Ring of Protection',  type: 'RG' },
  { id: 'r2',      name: 'Ring of Jumping',     type: 'RG' },
  { id: 'r3',      name: 'Ring of Free Action', type: 'RG' },
  { id: 'cloak',   name: 'Cloak of Protection', type: 'W' },
  { id: 'wand',    name: 'Wand of Web', type: 'WD' }
];
const bf = ES.backfillSlots(bag);
const sl = id => (bf.filter(x => x.id === id)[0] || {}).slot;
eq(sl('plate'), 'ARMOUR', 'backfill: best armour (Plate 18 > Leather 11) -> ARMOUR');
ok(sl('leather') == null, 'backfill: lesser armour stays carried');
eq(sl('shield'), 'OFFHAND', 'backfill: shield -> Off Hand');
eq(sl('sword'),  'MAINHAND', 'backfill: first weapon -> Main Hand');
ok(sl('dagger') == null, 'backfill: 2nd weapon has no hand free (Off Hand took the shield)');
eq(sl('r1'), 'RING1', 'backfill: ring 1 -> Ring 1');
eq(sl('r2'), 'RING2', 'backfill: ring 2 -> Ring 2');
ok(sl('r3') == null, 'backfill: 3rd ring has no slot');
eq(sl('cloak'), 'CLOAK', 'backfill: cloak -> Cloak');
ok(sl('wand') == null, 'backfill: wand never slots');
ok(bag.every(it => it.slot === undefined), 'backfill does not mutate the input bag');

// backfill respects a pre-set slot and won’t double-fill it
const pre = [{ id: 'a', name: 'Plate', type: 'HA', ac: 18, slot: 'ARMOUR' }, { id: 'b', name: 'Chain Mail', type: 'HA', ac: 16 }];
const bf2 = ES.backfillSlots(pre);
ok((bf2.filter(x => x.id === 'a')[0] || {}).slot === 'ARMOUR' && (bf2.filter(x => x.id === 'b')[0] || {}).slot == null,
   'backfill keeps a pre-slotted armour and leaves the spare carried');

console.log((fail === 0 ? 'PASS' : 'FAIL') + ' smoke-equip-slots: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
