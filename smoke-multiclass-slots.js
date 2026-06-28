/* smoke-multiclass-slots.js — verifies mergeSlotPools' slot derivation.
 * Run: node smoke-multiclass-slots.js   (commits beside soul-shards-spellcasting.js)
 *
 * Covers the lone-half/third-caster fix (own class table, round UP) vs. the
 * multiclass combined level (round DOWN), full casters (unchanged), and the
 * Cosmere shape (Sorcerer 1 shared + Warlock 2 pact) as a regression guard. */
const assert = require('assert');
const SC = require('./soul-shards-spellcasting.js');

const C = (progression, level, name) => ({ progression, level, name, ability: 'cha' });

function shared(classes) {           // non-pact shared pools -> { slotLevel: max }
  const out = {};
  SC.mergeSlotPools(classes).forEach(p => {
    if (String(p.key).indexOf('spell_') === 0) out[p.level] = p.max;
  });
  return out;
}
function pact(classes) {
  const p = SC.mergeSlotPools(classes).find(x => x.key === 'pactSlots');
  return p ? { count: p.max, level: p.level } : null;
}

let pass = 0, fail = 0;
function eq(label, got, want) {
  try { assert.deepStrictEqual(got, want); pass++; }
  catch (e) { fail++; console.log('FAIL ' + label + '\n  got  ' + JSON.stringify(got) + '\n  want ' + JSON.stringify(want)); }
}

// ── the fix: a LONE half/third caster uses its own class table (rounds up) ──
eq('lone Paladin 5',     shared([C('1/2', 5, 'Paladin')]),    { 1: 4, 2: 2 });
eq('lone Paladin 2',     shared([C('1/2', 2, 'Paladin')]),    { 1: 2 });
eq('lone Ranger 5',      shared([C('1/2', 5, 'Ranger')]),     { 1: 4, 2: 2 });
eq('lone EK Fighter 7',  shared([C('1/3', 7, 'Fighter')]),    { 1: 4, 2: 2 });
eq('lone EK Fighter 3',  shared([C('1/3', 3, 'Fighter')]),    { 1: 2 });
eq('lone Artificer 5',   shared([C('artificer', 5, 'Artificer')]), { 1: 4, 2: 2 });
// explicit guard on the OLD bug: lone Paladin 5 must NOT be the round-down {1:3}
try { assert.notDeepStrictEqual(shared([C('1/2', 5, 'Paladin')]), { 1: 3 }); pass++; }
catch (e) { fail++; console.log('FAIL lone Paladin 5 regressed to the old {1:3} bug'); }

// ── full casters unchanged (own table == multiclass table) ──
eq('lone Wizard 5',      shared([C('full', 5, 'Wizard')]),    { 1: 4, 2: 3, 3: 2 });
eq('lone Sorcerer 1',    shared([C('full', 1, 'Sorcerer')]),  { 1: 2 });

// ── multiple casters use the COMBINED multiclass level (round down) — unchanged ──
eq('Bard 2 / Cleric 1 (combined 3)',  shared([C('full', 2, 'Bard'), C('full', 1, 'Cleric')]),    { 1: 4, 2: 2 });
eq('Paladin 6 / Sorc 1 (combined 4)', shared([C('1/2', 6, 'Paladin'), C('full', 1, 'Sorcerer')]), { 1: 4, 2: 3 });

// ── Cosmere regression: Sorcerer 1 (full) shared + Warlock 2 pact (separate) ──
const cosmere = [C('full', 1, 'Sorcerer'), C('pact', 2, 'Warlock')];
eq('Cosmere shared (Sorcerer 1)', shared(cosmere), { 1: 2 });
eq('Cosmere pact (Warlock 2)',    pact(cosmere),   { count: 2, level: 1 });

console.log('\nmulticlass-slots smoke: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
