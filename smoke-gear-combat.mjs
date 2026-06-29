// smoke-gear-combat.mjs
// Layer-1 weapon Combat section in the item editor (editFormHtml): the new fields
// (atkBonus / dmgBonus / extra-damage rider / attack ability) render for weapons only,
// pre-populate from the item, and are absent for non-weapons. Pairs with the
// integration check that buildWeaponActions reads these fields off the item.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'fs';

const GM_SRC = readFileSync(new URL('./gear-manager.js', import.meta.url), 'utf8');
const dom = new JSDOM('<!doctype html><body class="tok-sheet"></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window, d = w.document;
const s = d.createElement('script'); s.textContent = GM_SRC; d.body.appendChild(s);
const GM = w.GearManager;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  FAIL:', m); } };
const has = (h, sub, m) => ok(h.indexOf(sub) >= 0, m);
const hasnt = (h, sub, m) => ok(h.indexOf(sub) < 0, m);

const ST = { picker: false };

console.log('--- isWeaponItem gating ---');
ok(GM.isWeaponItem({ type: 'M' }), 'type M is a weapon');
ok(GM.isWeaponItem({ type: 'R' }), 'type R is a weapon');
ok(GM.isWeaponItem({ weaponCat: 'Martial weapon, melee weapon' }), 'weaponCat with "weapon" is a weapon');
ok(GM.isWeaponItem({ typeLabel: 'Melee Weapon' }), 'typeLabel "Melee Weapon" is a weapon');
ok(!GM.isWeaponItem({ typeLabel: 'Adventuring Gear', weaponCat: 'Adventuring Gear' }), 'adventuring gear is NOT a weapon');
ok(!GM.isWeaponItem(null), 'null is not a weapon');

console.log('--- Combat section renders for a weapon ---');
{
  const h = GM.editFormHtml({ name: 'Longsword', type: 'M' }, ST);
  has(h, 'ge-combat', 'weapon form has the combat block');
  has(h, '>Combat<', 'combat section header present');
  has(h, 'data-ef="atkBonus"', 'bonus-to-hit field present');
  has(h, 'data-ef="dmgBonus"', 'bonus-to-damage field present');
  has(h, 'data-ef="exDice"', 'extra-damage dice field present');
  has(h, 'data-ef="exType"', 'extra-damage type field present');
  has(h, 'data-ef="attackAbil"', 'attack-ability select present');
  has(h, 'value="auto"', 'ability select offers Auto');
  // existing fields still present
  has(h, 'data-ef="name"', 'name field still there');
  has(h, 'data-ef="flavor"', 'flavor field still there');
}

console.log('--- Combat section ABSENT for a non-weapon ---');
{
  const h = GM.editFormHtml({ name: "Explorer's Pack", typeLabel: 'Adventuring Gear' }, ST);
  hasnt(h, 'ge-combat', 'non-weapon form has NO combat block');
  hasnt(h, 'data-ef="atkBonus"', 'non-weapon has no bonus-to-hit field');
  has(h, 'data-ef="name"', 'non-weapon still has the standard fields');
}

console.log('--- existing combat values pre-populate ---');
{
  const h = GM.editFormHtml({ name: 'Rapier, +1', type: 'M', atkBonus: 1, dmgBonus: 1, attackAbil: 'dex', extraDmg: { dice: '2d6', type: 'Fire' } }, ST);
  has(h, 'data-ef="atkBonus" value="1"', 'atkBonus pre-fills to 1');
  has(h, 'data-ef="dmgBonus" value="1"', 'dmgBonus pre-fills to 1');
  has(h, 'value="dex" selected', 'pinned Dex is the selected option');
  has(h, 'data-ef="exDice" value="2d6"', 'rider dice pre-fills');
  has(h, 'data-ef="exType" value="Fire"', 'rider type pre-fills');
}

console.log('--- a negative (cursed) bonus survives into the field ---');
{
  const h = GM.editFormHtml({ name: 'Longsword', type: 'M', atkBonus: -1, dmgBonus: -1 }, ST);
  has(h, 'data-ef="atkBonus" value="-1"', 'cursed -1 to hit renders');
  has(h, 'data-ef="dmgBonus" value="-1"', 'cursed -1 to damage renders');
}

console.log(`\nsmoke-gear-combat: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
