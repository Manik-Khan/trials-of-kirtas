#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const TG = require(path.join(__dirname, '..', 'tactics-geometry.js'));

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓', name); }
  catch (err) { console.error('✗', name); throw err; }
}

function map(cols = 9, rows = 9) {
  const m = TG.makeMap(cols, rows);
  m.occ = new Array(cols * rows).fill(0);
  return m;
}
function set(m, c, r, h, occ, wall) {
  const i = TG.idx(m, c, r);
  m.h[i] = h;
  m.occ[i] = occ || 0;
  m.wall[i] = !!wall;
}

const attacker = { c: 1, r: 2 };
const farTarget = { c: 6, r: 2 };

test('shallow shot clears an adjacent target-facing parapet below the shooter eye', () => {
  const m = map();
  set(m, attacker.c, attacker.r, 20, 0, false); // eye 25 ft
  set(m, 2, 2, 15, 7, true);                   // wall top 22 ft
  set(m, farTarget.c, farTarget.r, 0, 0, false);
  const v = TG.losVerdict(m, attacker, farTarget);
  assert.strictEqual(v.canTarget, true);
  assert.strictEqual(v.eye.stepOut, true);
  assert.deepStrictEqual(v.eye.ignore, { c: 2, r: 2 });
  assert.strictEqual(TG.losRay(m, attacker, farTarget, v.eye).blocked, false);
});

test('steep shot may clear the parapet cap but cannot pass through its terrain berm', () => {
  const m = map();
  const closeTarget = { c: 3, r: 2 };
  set(m, attacker.c, attacker.r, 20, 0, false); // eye 25
  set(m, 2, 2, 15, 7, true);                   // cap 22, terrain 15
  set(m, closeTarget.c, closeTarget.r, 0, 0, false);
  const candidates = TG.firingPoints(m, attacker, closeTarget);
  assert.strictEqual(candidates.length, 1);
  assert.strictEqual(candidates[0].stepOut, true);
  assert.strictEqual(TG.losRay(m, attacker, closeTarget, candidates[0]).blocked, true);
  assert.strictEqual(TG.losVerdict(m, attacker, closeTarget).canTarget, false);
});

test('the same adjacent wall blocks when its top reaches the shooter eye', () => {
  const m = map();
  set(m, attacker.c, attacker.r, 20, 0, false);
  set(m, 2, 2, 15, 10, true);                  // wall top 25 ft, equal blocks
  set(m, farTarget.c, farTarget.r, 0, 0, false);
  const v = TG.losVerdict(m, attacker, farTarget);
  assert.strictEqual(v.canTarget, false);
  assert.ok(!v.eye.stepOut);
});

test('a low wall two cells away cannot be ignored', () => {
  const m = map();
  set(m, attacker.c, attacker.r, 20, 0, false);
  set(m, 2, 2, 20, 0, false);
  set(m, 3, 1, 15, 7, true);
  set(m, 3, 2, 15, 7, true);
  set(m, 3, 3, 15, 7, true);
  set(m, farTarget.c, farTarget.r, 0, 0, false);
  const v = TG.losVerdict(m, attacker, farTarget);
  assert.strictEqual(v.canTarget, false);
  assert.ok(!v.eye.stepOut);
});

test('a side wall does not create a sideways corner exploit', () => {
  const m = map();
  set(m, attacker.c, attacker.r, 20, 0, false);
  set(m, 1, 1, 15, 7, true);                   // north, target east
  set(m, farTarget.c, farTarget.r, 0, 0, false);
  const v = TG.losVerdict(m, attacker, farTarget);
  assert.ok(!v.eye.stepOut);
});

test('target-side cover is still graded after a legal step-out', () => {
  const m = map();
  set(m, attacker.c, attacker.r, 20, 0, false);
  set(m, 2, 2, 15, 7, true);
  set(m, 5, 2, 0, 3.5, false);
  set(m, farTarget.c, farTarget.r, 0, 0, false);
  const v = TG.losVerdict(m, attacker, farTarget);
  assert.strictEqual(v.canTarget, true);
  assert.notStrictEqual(v.cover, 'total');
  assert.strictEqual(v.eye.stepOut, true);
});

test('exact 45-degree shot never treats the diagonal cell as an ignored parapet', () => {
  const m = map();
  const a = { c: 1, r: 1 }, b = { c: 5, r: 5 };
  set(m, a.c, a.r, 20, 0, false);
  set(m, 2, 2, 15, 7, true);                   // diagonal-only wall, top 22
  set(m, b.c, b.r, 0, 0, false);
  const eyes = TG.firingPoints(m, a, b);
  assert.ok(eyes.every(e => !e.ignore || e.ignore.c !== 2 || e.ignore.r !== 2));
  const v = TG.losVerdict(m, a, b);
  assert.strictEqual(v.canTarget, false);
  assert.ok(!v.eye.stepOut);
});

test('exact 45-degree shot can lean over one shared cardinal-edge parapet', () => {
  const m = map();
  const a = { c: 1, r: 1 }, b = { c: 6, r: 6 };
  set(m, a.c, a.r, 20, 0, false);
  set(m, 2, 1, 15, 7, true);                   // east shared edge
  set(m, b.c, b.r, 0, 0, false);
  const eyes = TG.firingPoints(m, a, b);
  assert.ok(eyes.some(e => e.stepOut && e.ignore.c === 2 && e.ignore.r === 1));
  assert.strictEqual(TG.losVerdict(m, a, b).canTarget, true);
});

test('near-45 x-dominant shot selects only the x shared edge', () => {
  const m = map();
  const a = { c: 2, r: 2 }, b = { c: 7, r: 6 };
  set(m, a.c, a.r, 20, 0, false);
  set(m, 3, 2, 15, 7, true);                   // east, correct
  set(m, 2, 3, 15, 7, true);                   // south, not target-facing at this angle
  set(m, b.c, b.r, 0, 0, false);
  const eyes = TG.firingPoints(m, a, b);
  assert.deepStrictEqual(eyes.map(e => e.ignore), [{ c: 3, r: 2 }]);
});

test('near-45 y-dominant shot selects only the y shared edge', () => {
  const m = map();
  const a = { c: 2, r: 2 }, b = { c: 6, r: 7 };
  set(m, a.c, a.r, 20, 0, false);
  set(m, 3, 2, 15, 7, true);
  set(m, 2, 3, 15, 7, true);                   // south, correct
  set(m, b.c, b.r, 0, 0, false);
  const eyes = TG.firingPoints(m, a, b);
  assert.deepStrictEqual(eyes.map(e => e.ignore), [{ c: 2, r: 3 }]);
});

test('exact diagonal with two low shared-edge walls exposes two legal candidates, never the diagonal', () => {
  const m = map();
  const a = { c: 2, r: 2 }, b = { c: 7, r: 7 };
  set(m, a.c, a.r, 20, 0, false);
  set(m, 3, 2, 15, 7, true);
  set(m, 2, 3, 15, 7, true);
  set(m, 3, 3, 15, 7, true);                   // diagonal remains ordinary geometry
  set(m, b.c, b.r, 0, 0, false);
  const eyes = TG.firingPoints(m, a, b);
  assert.deepStrictEqual(eyes.map(e => `${e.ignore.c},${e.ignore.r}`).sort(), ['2,3', '3,2']);
  assert.ok(eyes.every(e => !(e.ignore.c === 3 && e.ignore.r === 3)));
});

console.log(`\n${passed} ledge-fire smokes green.`);
