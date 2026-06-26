// smoke-weapon-actions.mjs
// Exercises buildWeaponActions: versatile weapons emit a one-handed AND a two-handed
// entry with the larger die; finesse picks the better of Str/Dex; ranged uses Dex;
// proficiency resolves from Simple/Martial categories AND specific (plural) class profs;
// inventory decoration ("+1", "(your choice)", magic names) still matches the base weapon.
import { buildWeaponActions, normalizeWeaponName, WEAPONS } from './weapon-actions.js';

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n); } };
const find = (acts, label) => acts.find(a => a.label === label);

// Fighter: Str 16 (+3), Dex 12 (+1), PB +2, proficient with all martial+simple
const fighter = { abilities: { str: { mod: 3 }, dex: { mod: 1 } }, proficiencyBonus: 2, proficiencies: { weapons: ['Simple Weapons', 'Martial Weapons'] } };
const fActs = buildWeaponActions([{ name: 'Longsword', qty: 1 }, { name: 'Greatsword', qty: 1 }, { name: 'Shortbow', qty: 1 }], fighter);

ok('versatile Longsword emits TWO actions', !!find(fActs, 'Longsword') && !!find(fActs, 'Longsword (Two-Handed)'));
ok('one-handed Longsword = 1d8', find(fActs, 'Longsword').dmgDice === '1d8');
ok('two-handed Longsword = 1d10', find(fActs, 'Longsword (Two-Handed)').dmgDice === '1d10');
ok('Longsword uses Str (not finesse)', find(fActs, 'Longsword').ability === 'str');
ok('Longsword type is attack + slashing', find(fActs, 'Longsword').type === 'attack' && find(fActs, 'Longsword').dmgType === 'Slashing');
ok('Greatsword = 2d6, single action (not versatile)', find(fActs, 'Greatsword').dmgDice === '2d6' && !find(fActs, 'Greatsword (Two-Handed)'));
ok('Shortbow uses Dex (ranged)', find(fActs, 'Shortbow').ability === 'dex');
ok('Fighter is proficient with martial weapons', find(fActs, 'Longsword').proficient === true);
ok('attack carries dmgAbility + atkBonus 0 (sheet shape)', find(fActs, 'Greatsword').dmgAbility === true && find(fActs, 'Greatsword').atkBonus === 0);

// Rogue-ish: Dex 16 (+3) > Str 10 (0) — finesse weapons should pick Dex
const rogue = { abilities: { str: { mod: 0 }, dex: { mod: 3 } }, proficiencyBonus: 2, proficiencies: { weapons: ['Simple Weapons', 'Rapiers', 'Shortswords', 'Hand Crossbows'] } };
const rActs = buildWeaponActions([{ name: 'Rapier', qty: 1 }, { name: 'Dagger', qty: 1 }], rogue);
ok('finesse Rapier picks Dex (better mod)', find(rActs, 'Rapier').ability === 'dex');
ok('Rapier proficient via specific (plural) prof', find(rActs, 'Rapier').proficient === true);
ok('simple Dagger proficient via Simple Weapons', find(rActs, 'Dagger').proficient === true);

// Wizard: dagger proficiency comes plural ("Daggers"); NOT proficient with martial Longsword
const wizard = { abilities: { str: { mod: 0 }, dex: { mod: 2 } }, proficiencyBonus: 2, proficiencies: { weapons: ['Daggers', 'Quarterstaffs', 'Light Crossbows'] } };
const wActs = buildWeaponActions([{ name: 'Dagger', qty: 1 }, { name: 'Quarterstaff', qty: 1 }, { name: 'Longsword', qty: 1 }], wizard);
ok('Wizard proficient with Dagger (plural "Daggers" matches)', find(wActs, 'Dagger').proficient === true);
ok('Wizard proficient with Quarterstaff (plural matches)', find(wActs, 'Quarterstaff').proficient === true);
ok('Wizard NOT proficient with Longsword (martial)', find(wActs, 'Longsword').proficient === false);
ok('Quarterstaff versatile -> 1d6 / 1d8', find(wActs, 'Quarterstaff').dmgDice === '1d6' && find(wActs, 'Quarterstaff (Two-Handed)').dmgDice === '1d8');

// name normalization: decoration shouldn't block the match
ok('"+1 Longsword" -> longsword', normalizeWeaponName('+1 Longsword') === 'longsword');
ok('"Longsword (your choice)" -> longsword', normalizeWeaponName('Longsword (your choice)') === 'longsword');
ok('"Longsword of Warning" -> longsword', normalizeWeaponName('Longsword of Warning') === 'longsword');
ok('a +1 weapon still yields an attack', !!find(buildWeaponActions([{ name: '+1 Longsword', qty: 1 }], fighter), 'Longsword'));

// non-weapons and damage-less weapons are ignored
const mixed = buildWeaponActions([{ name: 'Backpack', qty: 1 }, { name: 'Net', qty: 1 }, { name: 'Rations (1 day)', qty: 5 }, { name: 'Greatsword', qty: 1 }], fighter);
ok('non-weapons / Net produce no attacks; only Greatsword', mixed.length === 1 && mixed[0].label === 'Greatsword');

// duplicate weapons collapse to one entry
const dupes = buildWeaponActions([{ name: 'Dagger', qty: 1 }, { name: 'Dagger', qty: 1 }], fighter);
ok('duplicate weapons -> single attack entry', dupes.filter(a => a.label === 'Dagger').length === 1);

// empty inventory -> no actions, no throw
ok('empty inventory -> []', buildWeaponActions([], fighter).length === 0 && buildWeaponActions(null, fighter).length === 0);

// legacy characters store proficiencies.weapons as a comma-separated STRING, not an array
const legacy = { abilities: { str: { mod: 3 }, dex: { mod: 1 } }, proficiencyBonus: 2, proficiencies: { weapons: 'Longsword, Martial Weapons, Simple Weapons' } };
const legActs = buildWeaponActions([{ name: 'Longsword', qty: 1 }, { name: 'Dagger', qty: 1 }], legacy);
ok('legacy string weapons proficiency does not throw + resolves', legActs.length >= 2);
ok('legacy: martial Longsword proficient via string', find(legActs, 'Longsword').proficient === true);
ok('legacy: simple Dagger proficient via string', find(legActs, 'Dagger').proficient === true);

console.log(`\nweapon actions: ${pass}/${pass + fail} checks pass` + (fail ? ` — ${fail} FAILED` : ' \u2713'));
process.exit(fail ? 1 : 0);
