// smoke-dice-engine.mjs
// ---------------------------------------------------------------------------
// Pins dice-engine.js to battle.js's exact roll output. Math.random is stubbed
// to force specific dice, then every formatted string + structured field is
// asserted against what battle.js's rollActionFull produces inline today. If the
// HUD later adopts this engine, these prove it's a no-op.
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
const ok = (c, l) => { if (c) pass++; else { fail++; console.log('  FAIL: ' + l); } };
const eq = (a, b, l) => ok(a === b, l + (a === b ? '' : '\n    got: ' + JSON.stringify(a) + '\n    exp: ' + JSON.stringify(b)));

await import('./dice-engine.js');
const DE = globalThis.DiceEngine;
ok(DE && typeof DE.rollAction === 'function', 'DiceEngine.rollAction exposed');

// RNG stub: queue of raw randoms; rq(want,sides) yields `want` from die(sides).
let queue = [];
const real = Math.random;
Math.random = () => { if (!queue.length) throw new Error('random underflow'); return queue.shift(); };
const rq = (want, sides) => ((want - 1) + 0.5) / sides;
const setDice = (arr) => { queue = arr.slice(); };

// ── modStr ──
eq(DE.modStr(3), '+3', 'modStr(+3)');
eq(DE.modStr(-1), '-1', 'modStr(-1)');
eq(DE.modStr(0), '+0', 'modStr(0)');

// ── B: plain attack (no adv, no bless, no crit) ──
{
  const a = { type: 'attack', label: 'Longsword', hitMod: 5, dmgDice: '1d8', dmgMod: 3, dmgType: 'Slashing', critDice: '2d8' };
  setDice([rq(14, 20), rq(3, 20), rq(6, 8)]);           // kept 14, drop 3, dmg 6
  const r = DE.rollAction(a, {});
  eq(r.kind, 'attack', 'plain: kind attack');
  eq(r.total, 19, 'plain: total 14+5');
  eq(r.dmgTotal, 9, 'plain: dmg 6+3');
  ok(!r.isCrit && !r.isFumble, 'plain: no crit/fumble');
  eq(r.main, '[<span class="b-rh-kept">14</span>] +5 = <span class="b-rh-total">19</span> ', 'plain: main string exact');
  eq(r.detail, 'd20:14', 'plain: detail');
  eq(r.dmg, 'Dmg: [6] +3 = <strong>9</strong> Slashing', 'plain: dmg string exact');
}

// ── C: critical hit → critDice, ★ CRIT ──
{
  const a = { type: 'attack', label: 'Longsword', hitMod: 5, dmgDice: '1d8', dmgMod: 3, dmgType: 'Slashing', critDice: '2d8' };
  setDice([rq(20, 20), rq(2, 20), rq(7, 8), rq(5, 8)]); // nat 20 → 2d8 [7,5]
  const r = DE.rollAction(a, {});
  ok(r.isCrit, 'crit: isCrit true');
  eq(r.total, 25, 'crit: total 20+5');
  eq(r.dmgTotal, 15, 'crit: 7+5+3');
  eq(r.main, '[<span class="b-rh-kept">20</span>] +5 = <span class="b-rh-total">25</span> <span class="b-rh-crit">\u2605 CRIT</span>', 'crit: main has ★ CRIT');
  eq(r.dmg, '\u2605 Crit dmg: [7][5] +3 = <strong>15</strong> Slashing', 'crit: doubled dice string');
}

// ── D: advantage + bless (kept high, +d4 🙏) ──
{
  const a = { type: 'attack-cantrip', label: 'Eldritch Blast', hitMod: 5, dmgDice: '1d10', dmgMod: 0, dmgType: 'Force', critDice: '2d10' };
  setDice([rq(8, 20), rq(15, 20), rq(3, 4), rq(7, 10)]); // adv keeps 15 (drop 8), bless 3, dmg 7
  const r = DE.rollAction(a, { advantage: true, bless: true });
  eq(r.d20.kept, 15, 'adv: kept the higher die');
  eq(r.d20.dropped, 8, 'adv: dropped the lower');
  ok(r.d20.twin, 'adv: twin flag set');
  eq(r.bless, 3, 'bless: +3');
  eq(r.total, 23, 'adv+bless: 15+5+3');
  eq(r.main, '[<span class="b-rh-kept">15</span> <span class="b-rh-drop">8</span>] +5 +3\uD83D\uDE4F = <span class="b-rh-total">23</span> ', 'adv+bless: main shows both dice + 🙏');
  eq(r.detail, 'd20:15 (adv)', 'adv: detail labels adv');
  eq(r.dmg, 'Dmg: [7] = <strong>7</strong> Force', 'adv: dmg (no mod)');
}

// ── E: damage-only (no to-hit) ──
{
  const a = { type: 'damage-only', label: 'Hex (damage)', dmgDice: '1d6', dmgMod: 0, dmgType: 'Necrotic', critDice: '2d6' };
  setDice([rq(4, 6)]);
  const r = DE.rollAction(a, {});
  eq(r.kind, 'damage', 'dmg-only: kind damage');
  ok(!r.d20, 'dmg-only: no d20');
  eq(r.dmgTotal, 4, 'dmg-only: total 4');
  eq(r.main, 'Dmg: [4] = <span class="b-rh-total">4</span>', 'dmg-only: main exact');
  eq(r.detail, '1d6 Necrotic', 'dmg-only: detail');
}

// ── F: utility (no roll) ──
{
  const a = { type: 'utility', label: 'Shield', note: '+5 AC until start of next turn.' };
  const r = DE.rollAction(a, {});
  eq(r.kind, 'utility', 'utility: kind');
  eq(r.name, 'Shield', 'utility: name');
  eq(r.main, '+5 AC until start of next turn.', 'utility: main is the note');
  eq(r.detail, 'No roll needed', 'utility: detail');
}

// ── G: disadvantage keeps the lower die ──
{
  const a = { type: 'attack', label: 'Dagger', hitMod: 0, dmgDice: '1d4', dmgMod: 0, dmgType: 'Piercing', critDice: '2d4' };
  setDice([rq(12, 20), rq(4, 20), rq(2, 4)]);            // dis keeps 4
  const r = DE.rollAction(a, { disadvantage: true });
  eq(r.d20.kept, 4, 'dis: kept the lower die');
  eq(r.total, 4, 'dis: total 4+0');
  eq(r.detail, 'd20:4 (dis)', 'dis: detail labels dis');
}

// ── rollDice / rollD20 primitives ──
{
  setDice([rq(3, 6), rq(5, 6)]);
  const d = DE.rollDice('2d6', 1);
  eq(d.total, 9, 'rollDice 2d6+1 = 3+5+1');
  ok(d.rolls.length === 2 && d.rolls[0] === 3 && d.rolls[1] === 5, 'rollDice rolls captured');
  setDice([rq(11, 20), rq(19, 20)]);
  const n = DE.rollD20({});
  eq(n.kept, 11, 'rollD20 normal keeps first');
  ok(!n.twin, 'rollD20 normal: no twin');
}

Math.random = real;
console.log((fail === 0 ? '\u2713' : '\u2717') + ' dice-engine: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
