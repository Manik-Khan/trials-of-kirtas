// smoke-spell-attacks.mjs — exercises the live spell-damage derivation in weapon-actions.js
import { buildSpellAttacks, assembleActions } from '/mnt/user-data/outputs/weapon-actions.js';

let pass = 0, fail = 0;
const ok = (n, c, d) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + n + (d !== undefined ? '  -> ' + JSON.stringify(d) : '')); } };
const byLabel = (list, lbl) => list.find(a => a.label === lbl);
const find = (list, idStart) => list.find(a => a.id && a.id.indexOf(idStart) === 0);

const baseStructural = (level) => ({
  level, proficiencyBonus: level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : 3,
  combat: { spellAttackBonus: 7, spellSaveDC: 15 },
  spellcasting: { groups: [
    { level: 0, spells: [{ name: 'Fire Bolt' }, { name: 'Sacred Flame' }, { name: 'Eldritch Blast' }, { name: 'Toll the Dead' }, { name: 'Light' }] },
    { level: 1, spells: [{ name: 'Magic Missile' }, { name: 'Inflict Wounds' }, { name: 'Shield' }] },
    { level: 2, spells: [{ name: 'Spiritual Weapon' }, { name: 'Scorching Ray' }] },
    { level: 3, spells: [{ name: 'Fireball' }, { name: 'Counterspell' }] }
  ] },
  actions: []
});

// ---- level 5 baseline ----
let A = buildSpellAttacks(baseStructural(5));

// cantrip attack: Fire Bolt 2d10 at L5, crit doubles, real spell attack
const fb = byLabel(A, 'Fire Bolt');
ok('Fire Bolt is an attack-cantrip', !!fb && fb.type === 'attack-cantrip', fb);
ok('Fire Bolt 2d10 at L5', fb && fb.dmgDice === '2d10', fb && fb.dmgDice);
ok('Fire Bolt crit doubles to 4d10', fb && fb.critDice === '4d10', fb && fb.critDice);
ok('Fire Bolt uses spell attack bonus +7', fb && fb.hitMod === 7, fb && fb.hitMod);
ok('Fire Bolt damage type is fire', fb && /fire/.test(fb.dmgType), fb && fb.dmgType);

// cantrip save: Sacred Flame damage-only, DC + ability in label
const sf = byLabel(A, 'Sacred Flame');
ok('Sacred Flame is damage-only (no to-hit)', !!sf && sf.type === 'damage-only', sf);
ok('Sacred Flame 2d8 at L5', sf && sf.dmgDice === '2d8', sf && sf.dmgDice);
ok('Sacred Flame shows DEX save DC 15', sf && /DEX save DC 15/.test(sf.dmgType), sf && sf.dmgType);

// Eldritch Blast: 2 beams at L5, each 1d10 (NOT 2d10)
const eb = byLabel(A, 'Eldritch Blast (\u00d72 beams)');
ok('Eldritch Blast labelled with 2 beams', !!eb, A.filter(a => /Eldritch/.test(a.label)).map(a => a.label));
ok('Eldritch Blast die stays 1d10 per beam', eb && eb.dmgDice === '1d10', eb && eb.dmgDice);
ok('Eldritch Blast notes rolling each beam', eb && /roll each/.test(eb.dmgType), eb && eb.dmgType);

// Toll the Dead: scaled die + the d12 reminder
const td = byLabel(A, 'Toll the Dead');
ok('Toll the Dead 2d8 at L5, WIS save', td && td.dmgDice === '2d8' && /WIS save DC 15/.test(td.dmgType), td);
ok('Toll the Dead notes the d12 variant', td && /d12/.test(td.dmgType), td && td.dmgType);

// Magic Missile: auto-hit 3d4+3
const mm = byLabel(A, 'Magic Missile (1st)');
ok('Magic Missile auto-hit, damage-only', !!mm && mm.type === 'damage-only', mm);
ok('Magic Missile 3d4 +3', mm && mm.dmgDice === '3d4' && mm.dmgMod === 3, mm);
ok('Magic Missile notes upcast darts', mm && /\+1 dart/.test(mm.dmgType), mm && mm.dmgType);

// leveled attack spell w/ upcast
const iw = byLabel(A, 'Inflict Wounds (1st)');
ok('Inflict Wounds attack-cantrip 3d10', !!iw && iw.type === 'attack-cantrip' && iw.dmgDice === '3d10', iw);
ok('Inflict Wounds notes per-slot upcast', iw && /per slot above 1st/.test(iw.dmgType), iw && iw.dmgType);

// leveled save spell
const fbl = byLabel(A, 'Fireball (3rd)');
ok('Fireball (3rd) damage-only 8d6, DEX save', !!fbl && fbl.type === 'damage-only' && fbl.dmgDice === '8d6' && /DEX save DC 15/.test(fbl.dmgType), fbl);

// addMod spell: Spiritual Weapon adds spell mod (7 - PB3 = 4) to damage
const sw = byLabel(A, 'Spiritual Weapon (2nd)');
ok('Spiritual Weapon adds +spell mod (4) to damage', !!sw && sw.dmgMod === 4, sw);

// multi-ray leveled spell
const sr = byLabel(A, 'Scorching Ray (3 rays)');
ok('Scorching Ray keeps 2d6 per ray', !!sr && sr.dmgDice === '2d6' && /3 rays/.test(sr.dmgType), sr);

// non-damaging spells produce nothing
ok('Light / Shield / Counterspell produce no actions', !byLabel(A, 'Light') && !byLabel(A, 'Shield') && !byLabel(A, 'Counterspell'), A.map(a => a.label));

// ---- cantrip scaling across tiers ----
const fbAt = (lvl) => { const x = byLabel(buildSpellAttacks(baseStructural(lvl)), 'Fire Bolt'); return x && x.dmgDice; };
ok('Fire Bolt 1d10 at L1', fbAt(1) === '1d10', fbAt(1));
ok('Fire Bolt 3d10 at L11', fbAt(11) === '3d10', fbAt(11));
ok('Fire Bolt 4d10 at L17', fbAt(17) === '4d10', fbAt(17));

// ---- legacy spells map (older sheets) ----
const legacy = { level: 5, proficiencyBonus: 3, combat: { spellAttackBonus: 6, spellSaveDC: 14 },
  spells: { cantrips: [{ name: 'Fire Bolt' }], level3: [{ name: 'Fireball' }] } };
const L = buildSpellAttacks(legacy);
ok('legacy map: Fire Bolt derived', !!byLabel(L, 'Fire Bolt'), L.map(a => a.label));
ok('legacy map: Fireball (3rd) derived', !!byLabel(L, 'Fireball (3rd)'), L.map(a => a.label));

// ---- hand-authored action wins (no duplicate) ----
const authored = baseStructural(5); authored.actions = [{ id: 'bb', label: 'Fire Bolt', type: 'attack-cantrip', dmgDice: '1d10' }];
const Au = buildSpellAttacks(authored);
ok('hand-authored Fire Bolt suppresses the derived one', !byLabel(Au, 'Fire Bolt'), Au.map(a => a.label));

// ---- assembleActions integration ----
const all = assembleActions([], baseStructural(5));
ok('assembleActions includes the derived spell attacks', !!byLabel(all, 'Fire Bolt') && !!byLabel(all, 'Fireball (3rd)'), all.map(a => a.label));

// apostrophe-normalised lookup (curly apostrophe in the data)
const curly = { level: 5, combat: { spellAttackBonus: 6, spellSaveDC: 14 }, spellcasting: { groups: [{ level: 2, spells: [{ name: 'Aganazzar\u2019s Scorcher' }] }] } };
ok('curly-apostrophe spell name still matches the table', !!buildSpellAttacks(curly).find(a => /Aganazzar/.test(a.label)), buildSpellAttacks(curly).map(a => a.label));

console.log('\nsmoke-spell-attacks: ' + pass + ' passed, ' + fail + ' failed  (table covers ' + Object.keys({}).length + ')');
if (fail) process.exit(1);
