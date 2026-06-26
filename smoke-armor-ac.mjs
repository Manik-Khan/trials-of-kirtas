// smoke-armor-ac.mjs
// ---------------------------------------------------------------------------
// Pins armor-ac.js's deriveAC. First proof: it reproduces the four live PCs'
// hand-imported static combat.ac exactly (so switching the sheet to a live
// derive is a no-op today, then tracks looted armour). Then the 2014 rule edges
// M asked for: −10 ft speed from a Str-requirement armour (NOT −5, and NOT from
// proficiency); non-proficiency as its own disadvantage flag; per-armour Stealth
// disadvantage; Mithral waiving both; magic +N; Monk losing Unarmored Defense to
// a shield; and the equipped-then-best worn-armour pick.
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync } from 'fs';

await import('./armor-ac.js');
const ArmorAC = globalThis.ArmorAC;

let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };
const eq = (a, b, l) => ok(a === b, l + (a === b ? '' : '  (got ' + JSON.stringify(a) + ', exp ' + JSON.stringify(b) + ')'));

ok(ArmorAC && typeof ArmorAC.deriveAC === 'function', 'ArmorAC.deriveAC exposed');

// ── 1. the four live PCs: computed AC === static combat.ac ──
const dir = 'data/characters';
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const d = JSON.parse(readFileSync(dir + '/' + f, 'utf8'));
  const s = d.structural || {};
  const r = ArmorAC.deriveAC(d.inventory || [], s);
  eq(r.ac, (s.combat || {}).ac, 'live PC ' + d.key + ' computed AC matches static (' + r.source + ')');
}

// helper: a minimal structural
const C = (over) => Object.assign({ abilities: { str: { score: 10, mod: 0 }, dex: { mod: 1 }, con: { mod: 1 }, wis: { mod: 3 } }, classLabel: '', proficiencies: {} }, over || {});

// ── 2. Líadan (Str 6) in Plate, NOT proficient (current Bard, Light only) ──
{
  const liadan = C({ abilities: { str: { score: 6, mod: -2 }, dex: { mod: 1 }, wis: { mod: 2 } }, classLabel: 'Bard', proficiencies: { armor: 'Light Armor' } });
  const r = ArmorAC.deriveAC([{ name: 'Plate', type: 'HA', ac: 18 }], liadan);
  eq(r.ac, 18, 'Plate is flat AC 18 (heavy, no Dex)');
  eq(r.speedPenalty, 10, 'Plate Str 15 > Str 6 -> -10 ft (not -5)');
  ok(/Str 15/.test(r.speedReason || ''), 'speed reason names the Str requirement');
  eq(r.stealthDisadvantage, true, 'Plate imposes Stealth disadvantage');
  eq(r.notProficient, true, 'Bard not proficient with Heavy Armor');
  ok(/Heavy Armor/.test(r.profReason || ''), 'prof reason names Heavy Armor');
}

// ── 3. Líadan as Bard 2 / Life Cleric 1 in Plate: proficiency clears the prof
//      penalty, but the -10 speed and Stealth disadvantage REMAIN (Str/Mithral) ──
{
  const liadan2 = C({ abilities: { str: { score: 6, mod: -2 }, dex: { mod: 1 }, wis: { mod: 2 } }, classLabel: 'Bard 2 / Cleric 1', proficiencies: { armor: 'Light Armor, Medium Armor, Heavy Armor, Shields' } });
  const r = ArmorAC.deriveAC([{ name: 'Plate', type: 'HA', ac: 18 }], liadan2);
  eq(r.notProficient, false, 'heavy-armor proficiency clears the non-proficiency flag');
  eq(r.speedPenalty, 10, 'speed -10 persists (proficiency does not fix Strength)');
  eq(r.stealthDisadvantage, true, 'Stealth disadvantage persists');
}

// ── 4. Mithral Plate waives BOTH the Str requirement and Stealth disadvantage ──
{
  const r = ArmorAC.deriveAC([{ name: 'Mithral Plate', type: 'HA', ac: 18 }], C({ abilities: { str: { score: 6, mod: -2 }, dex: { mod: 1 } }, proficiencies: { armor: 'Heavy Armor' } }));
  eq(r.ac, 18, 'Mithral Plate still AC 18');
  eq(r.speedPenalty, 0, 'Mithral waives the Str-requirement speed drop');
  eq(r.stealthDisadvantage, false, 'Mithral waives Stealth disadvantage');
}

// ── 5. magic +1 armour adds to AC; name still resolves to the base armour ──
{
  const r = ArmorAC.deriveAC([{ name: '+1 Plate' }], C({ proficiencies: { armor: 'Heavy Armor' } }));
  eq(r.ac, 19, '+1 Plate -> 18 + 1');
}

// ── 6. Monk: Unarmored Defense = 10 + Dex + Wis; a shield REMOVES it (10+Dex+shield) ──
{
  const monk = C({ classLabel: 'Monk', abilities: { dex: { mod: 3 }, wis: { mod: 3 }, str: { score: 10, mod: 0 } } });
  const noShield = ArmorAC.deriveAC([], monk);
  eq(noShield.ac, 16, 'Monk no armour, no shield: 10 + Dex(3) + Wis(3) = 16');
  ok(/Unarmored Defense \(Monk\)/.test(noShield.source), 'source notes Monk Unarmored Defense');
  const withShield = ArmorAC.deriveAC([{ name: 'Shield', type: 'S', ac: 2 }], monk);
  eq(withShield.ac, 15, 'Monk with shield loses Unarmored Defense: 10 + Dex(3) + 2 = 15');
}

// ── 7. Barbarian keeps Unarmored Defense (10 + Dex + Con) WITH a shield ──
{
  const barb = C({ classLabel: 'Barbarian 3', abilities: { dex: { mod: 2 }, con: { mod: 3 }, str: { score: 14, mod: 2 } } });
  const r = ArmorAC.deriveAC([{ name: 'Shield', type: 'S', ac: 2 }], barb);
  eq(r.ac, 17, 'Barbarian + shield: 10 + Dex(2) + Con(3) + 2 = 17');
}

// ── 8. worn-armour pick: an EQUIPPED weaker armour beats an unflagged stronger one ──
{
  const r = ArmorAC.deriveAC([
    { name: 'Plate', type: 'HA', ac: 18 },                 // stronger, not flagged
    { name: 'Leather', type: 'LA', ac: 11, equipped: true } // explicitly worn
  ], C({ abilities: { dex: { mod: 2 }, str: { score: 6, mod: -2 } }, proficiencies: { armor: 'Light Armor' } }));
  eq(r.body, 'Leather', 'equipped Leather chosen over unflagged Plate');
  eq(r.ac, 13, 'Leather 11 + Dex 2 = 13');
  eq(r.speedPenalty, 0, 'no heavy armour worn -> no speed penalty');
}

// ── 9. no equipped flags anywhere -> best body armour in the bag (the migrated-PC case) ──
{
  const r = ArmorAC.deriveAC([{ name: 'Scale Mail', type: 'MA', ac: 14 }, { name: 'Shield', type: 'S', ac: 2 }],
    C({ abilities: { dex: { mod: 4 }, str: { score: 13, mod: 1 } }, proficiencies: { armor: 'All Armor, Shields' } }));
  eq(r.ac, 18, 'Scale Mail 14 + Dex capped +2 + Shield 2 = 18 (medium Dex cap)');
  eq(r.notProficient, false, '"All Armor" covers medium');
}

// ── 10. the Forge derive emits combat.ac when handed inventory (real engine +
//      spellcasting + this ArmorAC as deps; no network — the engine builds off the
//      passed class model). Proves the derive consumer, not just the live sheet. ──
{
  const win = {};
  const loadCjs = (p) => { const m = { exports: {} }; new Function('module', 'exports', 'window', readFileSync(new URL(p, import.meta.url), 'utf8'))(m, m.exports, win); return m.exports; };
  const Engine = loadCjs('./soul-shards-engine.js');
  const SC = loadCjs('./soul-shards-spellcasting.js');
  const Derive = loadCjs('./soul-shards-derive.js');
  win.SoulShardsEngine = Engine; win.SoulShardsSpellcasting = SC;
  const FTR = {
    name: 'Fighter', source: 'PHB', hd: 10, savingThrows: ['str', 'con'],
    subclassTitle: 'Martial Archetype', subclassChoiceLevel: 3,
    featuresByLevel: { 1: [{ name: 'Fighting Style', level: 1, source: 'PHB', entries: ['A style.'] }] },
    slotsByLevel: {}, subclasses: []
  };
  const out = Derive.deriveStructural({
    name: 'Plate Pete', abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    classes: [{ model: FTR, level: 3 }],
    proficiencies: { skills: ['Athletics'], languages: ['Common'], tools: [], weapons: ['Martial Weapons'], armor: ['All Armor', 'Shields'] },
    inventory: [{ name: 'Scale Mail', type: 'MA', ac: 14 }, { name: 'Shield', type: 'S', ac: 2 }]
  }, { engine: Engine, spellcasting: SC, armorAC: ArmorAC });
  const cb = (out.structural || {}).combat || {};
  eq(cb.ac, 18, 'derive: Scale Mail 14 + Dex cap +2 + Shield 2 = 18');
  ok(/Scale Mail/.test(cb.acSource || ''), 'derive: combat.acSource names the armour');
  ok(!(out._incomplete || []).some(s => /combat\.ac/.test(s)), 'derive: no combat.ac gap flagged once inventory is passed');
}

// ── 11. slot-aware selection: worn body/shield come from item.slot, with the
//      un-slotted bag still falling back to "best you own" (the shipped behaviour) ──
{
  // a slotted Studded Leather (12) is worn even though a stronger Plate sits un-slotted in the bag
  const r = ArmorAC.deriveAC(
    [{ name: 'Plate' }, { name: 'Studded Leather', slot: 'ARMOUR' }, { name: 'Shield', type: 'S', ac: 2, slot: 'OFFHAND' }],
    C({ abilities: { dex: { mod: 2 }, str: { score: 8 } }, proficiencies: { armor: 'All Armor, Shields' } }));
  eq(r.ac, 16, 'slot wins: Studded Leather(12) + Dex2 + Shield2 = 16 (not the un-slotted Plate)');
  eq(r.body, 'Studded Leather', 'worn body = the ARMOUR-slotted item');
}
{
  // slots are in use but ARMOUR is empty -> deliberately bare in that slot (shield still worn)
  const r = ArmorAC.deriveAC(
    [{ name: 'Plate' }, { name: 'Shield', type: 'S', ac: 2, slot: 'OFFHAND' }],
    C({ abilities: { dex: { mod: 3 } }, proficiencies: { armor: 'All Armor, Shields' } }));
  eq(r.ac, 15, 'ARMOUR slot empty + OFF-HAND in use -> 10 + Dex3 + Shield2 = 15');
  ok(r.body === null, 'no body armour when the ARMOUR slot is empty and slots are in use');
}
{
  // nothing slotted anywhere -> best-in-bag fallback, unchanged from before slots existed
  const r = ArmorAC.deriveAC([{ name: 'Plate' }, { name: 'Leather' }],
    C({ abilities: { dex: { mod: 2 } }, proficiencies: { armor: 'All Armor' } }));
  eq(r.ac, 18, 'no slots anywhere -> fallback to best body (Plate 18) — shipped behaviour preserved');
}

console.log((fail === 0 ? 'PASS' : 'FAIL') + ' smoke-armor-ac: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
