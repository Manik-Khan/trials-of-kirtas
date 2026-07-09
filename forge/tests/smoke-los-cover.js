/* smoke-los-cover.js — the heightfield LoS + cover layer.
   Known-answer cases, each one a rule M stated in plain English. */
const G = require('../tactics-geometry.js');
const MB = require('../map-bridge.js');

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = (typeof got === 'number' && typeof want === 'number')
    ? Math.abs(got - want) < 1e-9 : got === want;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `   got ${got}, want ${want}`}`);
}
function map(cols, rows, hFt = 0) {
  const m = G.makeMap(cols, rows);
  m.occ = new Array(cols * rows).fill(0);
  m.h = new Array(cols * rows).fill(hFt);
  return m;
}
const set = (m, c, r, { h, occ, wall }) => {
  const i = r * m.cols + c;
  if (h != null) m.h[i] = h;
  if (occ != null) m.occ[i] = occ;
  if (wall != null) m.wall[i] = wall;
};
const cover = (m, a, b) => G.losVerdict(m, a, b).cover;

console.log('\n── a pit can never block ──');
{ const m = map(20, 3);
  for (let c = 2; c < 18; c++) set(m, c, 1, { h: -20 });          // a chasm
  t('shot straight across a 16-square chasm', cover(m, {c:0,r:1}, {c:19,r:1}), 'none');
  for (let c = 2; c < 18; c++) set(m, c, 1, { h: -20, occ: 4.5 }); // rubble in the pit
  t('rubble sunk in the pit still blocks nothing', cover(m, {c:0,r:1}, {c:19,r:1}), 'none'); }

console.log('\n── a boulder is three-quarters cover, not total ──');
{ const m = map(12, 3);
  set(m, 9, 1, { occ: 4.5 });                                      // rock, adjacent to target
  t('4.5 ft boulder in front of the target', cover(m, {c:1,r:1}, {c:10,r:1}), 'three-quarters');
  set(m, 9, 1, { occ: 2.0 });                                      // mushroom
  t('2 ft mushroom in front of the target',   cover(m, {c:1,r:1}, {c:10,r:1}), 'half'); }

console.log('\n── you cannot see over a wall you are pressed against ──');
{ const m = map(20, 3);
  set(m, 2, 1, { occ: 7 });                                        // 7 ft grass bank at c=2
  for (let c = 3; c < 20; c++) set(m, c, 1, { h: 20 });            // ledge beyond it
  t('adjacent to the bank, mob on a 20 ft ledge', cover(m, {c:1,r:1}, {c:15,r:1}), 'total');
  t('stand back 2 squares — same bank, same mob', cover(m, {c:0,r:1}, {c:15,r:1}), 'total'); }

console.log('\n── ...but step back and the ray meets it higher up ──');
console.log('   (only because the mob is ABOVE you: a rising ray gains height');
console.log('    at the wall as the slope flattens. Open ground between.)');
{ const m = map(40, 3);
  set(m, 20, 1, { occ: 7 });                                        // 7 ft bank at c=20
  for (let c = 31; c < 40; c++) set(m, c, 1, { h: 20 });            // ledge, well beyond it
  const lip = d => cover(m, { c: 20 - d, r: 1 }, { c: 31, r: 1 });  // mob AT the lip
  t('1 square back (5 ft)',   lip(1), 'total');
  t('4 squares back (20 ft)', lip(4), 'none');
  t('8 squares back (40 ft)', lip(8), 'none');
  // and the mob set BACK from the lip is a different, correct answer: the lip
  // itself eats his legs. You see head and torso. That is 3/4 cover, not none.
  const back = d => cover(m, { c: 20 - d, r: 1 }, { c: 35, r: 1 });
  t('mob 4 back from the lip, you 1 back',  back(1), 'total');
  t('mob 4 back from the lip, you 8 back',  back(8), 'three-quarters'); }

console.log('\n── a flat ray cannot rise: standing back never helps a level shot ──');
{ const m = map(40, 3);
  set(m, 20, 1, { occ: 7 });                                        // target at YOUR height
  const at = d => cover(m, { c: 20 - d, r: 1 }, { c: 32, r: 1 });
  t('1 square back',  at(1), 'total');
  t('8 squares back', at(8), 'total'); }

console.log('\n── height beats the wall — but it is the OPPOSITE lever ──');
console.log('   (the ray FALLS toward a lower target, so elevation buys you');
console.log('    a wall you stand near, and loses you one you stand far from)');
{ const m = map(20, 3);
  set(m, 10, 1, { occ: 10.5 });                                     // temple wall, c=10
  t('level with the wall base, 8 squares off', cover(m, {c:2,r:1}, {c:18,r:1}), 'total');
  for (let c = 0; c < 10; c++) set(m, c, 1, { h: 10 });             // shooter plateau, 2 tiers
  t('two tiers up, 2 squares from the wall',   cover(m, {c:8,r:1}, {c:18,r:1}), 'none');
  t('two tiers up, 8 squares from the wall',   cover(m, {c:2,r:1}, {c:18,r:1}), 'total'); }

console.log('\n── dead ground: below a cliff, you cannot see the mob set back from the rim ──');
{ const m = map(30, 3);
  for (let c = 15; c < 30; c++) set(m, c, 1, { h: 25 });            // mesa, rim at c=15
  t('mob 8 squares back from the rim', cover(m, {c:2,r:1}, {c:23,r:1}), 'total');
  t('mob standing ON the rim',         cover(m, {c:2,r:1}, {c:15,r:1}), 'none'); }

console.log('\n── the v1 contract is untouched when occ[] is absent ──');
{ const m = G.makeMap(10, 3);                                       // no occ[]
  m.wall[1 * 10 + 5] = true;
  t('a wall with no occ[] is still opaque', cover(m, {c:1,r:1}, {c:8,r:1}), 'total');
  const m2 = G.makeMap(10, 3);
  t('open ground with no occ[] is clear',   cover(m2, {c:1,r:1}, {c:8,r:1}), 'none'); }

console.log('\n── map-bridge lifts the heights out of the generator, not out of thin air ──');
{ t('temple wall is 10.5 ft', MB.wallFeetFor('temple'), 10.5);
  t('bog wall is 6.25 ft',    MB.wallFeetFor('swamp'),  6.25);
  t('grass bank is 7 ft',     MB.wallFeetFor('grass'),  7);
  t('a rock prop is 4.5 ft',  MB.propFeet({kind:'rock', scale:1}),   4.5);
  t('a scaled tree is 6.6 ft',MB.propFeet({kind:'tree', scale:1.2}), 6.6);
  t('moss occludes nothing',  MB.propFeet({kind:'moss', scale:1}),   0);
  t('bones occlude nothing',  MB.propFeet({kind:'bones', scale:1}),  0); }

console.log(`\n${pass}/${pass + fail} passed${fail ? `  — ${fail} FAILED` : ''}\n`);
process.exit(fail ? 1 : 0);
