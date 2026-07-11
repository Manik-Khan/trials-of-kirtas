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
  // and the mob set BACK from the lip: the rim eats his legs. Close in you are
  // still in dead ground (total); far enough back the ray clears his head but
  // the rim clips his feet. That rim sits 4 squares from HIM and 19 from you —
  // TARGET-side, so under M's round-3 ruling (2026-07-11: attribution by side,
  // "cover is what the TARGET hides behind") it GRADES: hull-down behind the
  // ground in front of him is real defilade, three-quarters.
  const back = d => cover(m, { c: 20 - d, r: 1 }, { c: 35, r: 1 });
  t('mob 4 back from the lip, you 1 back',  back(1), 'total');
  t('mob 4 back from the lip, you 8 back — hull-down behind his own rim', back(8), 'three-quarters'); }

console.log('\n── a flat ray cannot rise: standing back never helps a level shot ──');
{ const m = map(40, 3);
  set(m, 20, 1, { occ: 7 });                                        // target at YOUR height
  const at = d => cover(m, { c: 20 - d, r: 1 }, { c: 32, r: 1 });
  t('1 square back',  at(1), 'total');
  t('8 squares back', at(8), 'total'); }

console.log('\n── height beats the wall — but it is the OPPOSITE lever ──');
console.log('   (the ray FALLS toward a lower target, so elevation buys you');
console.log('    a wall you stand near, and loses you one you stand far from)');
{ /* 5 rows + a full wall COLUMN so the shooter stands MID-plateau: a 3-row
     map made the plateau a one-cell ridge, and under the 2026-07-11 ledge-
     peek ruling a ridge shooter leans over its lips — a different case,
     tested in the ledge-peek section below. Off the lip, nothing changed. */
  const m = map(20, 5);
  for (let r = 0; r < 5; r++) set(m, 10, r, { occ: 10.5 });         // temple wall column, c=10
  t('level with the wall base, 8 squares off', cover(m, {c:2,r:2}, {c:18,r:2}), 'total');
  for (let r = 0; r < 5; r++) for (let c = 0; c < 10; c++) set(m, c, r, { h: 10 }); // shooter plateau, 2 tiers
  t('two tiers up, 2 squares from the wall',   cover(m, {c:8,r:2}, {c:18,r:2}), 'none');
  t('two tiers up, 8 squares from the wall',   cover(m, {c:2,r:2}, {c:18,r:2}), 'total'); }

console.log("\n── ledge peek: at the lip you lean over (M's ruling, 2026-07-11) ──");
console.log('   (step to the ledge, shoot, step back — the strategy is real:');
console.log('    one square back, the lip cell is dead ground again)');
{ const m = map(20, 5);                                             // plateau c0..4 at 15 ft,
  for (let r = 0; r < 5; r++) {                                     // a 12 ft wall column at c=8
    for (let c = 0; c <= 4; c++) set(m, c, r, { h: 15 });           // (top 3 ft BELOW the lip),
    set(m, 8, r, { occ: 12 });                                      // mob on low ground at c=12
  }
  const atLip = G.losVerdict(m, {c:4,r:2}, {c:12,r:2});
  // The peek beats the dead ground so the shot EXISTS (canTarget true). The
  // 12 ft wall sits 4 squares from EACH of you — a midfield tie, which under
  // M's round-3 ruling (2026-07-11, attribution by side) grades for the
  // DEFENDER: a wall genuinely hiding the mob's legs is defilade, ¾.
  t('at the lip, wall top below your feet: the shot exists, wall grades', atLip.cover, 'three-quarters');
  t('  …and canTarget says so', atLip.canTarget, true);
  t('one square back: dead ground returns', cover(m, {c:3,r:2}, {c:12,r:2}), 'total'); }
{ const m = map(20, 3);                                             // the old 3-row "plateau":
  set(m, 10, 1, { occ: 10.5 });                                     // a RIDGE — both sides drop,
  for (let c = 0; c < 10; c++) set(m, c, 1, { h: 10 });             // so every corner is a lip
  const v = G.losVerdict(m, {c:2,r:1}, {c:18,r:1});
  // The peek still fires (eye.peek below), and the temple wall sits 8 squares
  // from each side — a midfield tie, which grades for the defender under M's
  // round-3 ruling (2026-07-11): the lean wins the shot, the wall keeps its ¾.
  t('a ridge shooter leans: the shot exists, the midfield wall grades', v.cover, 'three-quarters');
  t('  …and the verdict names the peeked eye', v.eye.peek, true); }
{ const m = map(12, 3);                                             // flat ground: no drop, no
  set(m, 9, 1, { occ: 4.5 });                                       // lean — the sideways-peek
  const v = G.losVerdict(m, {c:1,r:1}, {c:10,r:1});                 // loophole stays closed
  t('flat ground never peeks', v.eye.peek, false); }

console.log('\n── dead ground: below a cliff, you cannot see the mob set back from the rim ──');
{ const m = map(30, 3);
  for (let c = 15; c < 30; c++) set(m, c, 1, { h: 25 });            // mesa, rim at c=15
  t('mob 8 squares back from the rim', cover(m, {c:2,r:1}, {c:23,r:1}), 'total');
  t('mob standing ON the rim',         cover(m, {c:2,r:1}, {c:15,r:1}), 'none'); }

console.log("\n── attribution by side (M's ruling, 2026-07-11, round 3) ──");
console.log('   ("cover is what the TARGET hides behind; an obstruction on the');
console.log("    shooter's side is the shooter's vantage problem — step up / lean —");
console.log("    not the target's AC.\" Midfield ties grade: defender's benefit.)");
{ /* shooting down off a plateau, an attacker-side terrace edge (3 squares from
     the shooter, 5 from the mob) clips the feet lines of a mob standing in the
     open — that is a vantage problem, not cover. The same shot with a boulder
     right beside the enemy grades ¾: the boulder is his, the terrace is yours. */
  const m = map(20, 3);
  for (let c = 0; c <= 4; c++) set(m, c, 1, { h: 20 });     // shooter plateau, lip at c=4
  for (let c = 5; c <= 7; c++) set(m, c, 1, { h: 15 });     // terrace one tier down, attacker-side
  t('enemy in the open below a ledge: attacker-side terrace clips feet → none',
    cover(m, {c:4,r:1}, {c:12,r:1}), 'none');
  set(m, 11, 1, { occ: 4.5 });                              // a boulder right beside the enemy
  t('same shot, boulder beside the enemy → three-quarters (shooter-side clutter cannot shadow it)',
    cover(m, {c:4,r:1}, {c:12,r:1}), 'three-quarters'); }
{ /* the round-3 pair made explicit: the SAME low parapet on level ground —
     in front of the TARGET it is his cover; in front of the ATTACKER it is
     the attacker's own obstruction and grades nothing. */
  const m = map(20, 3);
  set(m, 11, 1, { occ: 4.5 });                              // parapet 3 squares before the target
  t('parapet 3 squares in front of the TARGET → graded (three-quarters)',
    cover(m, {c:2,r:1}, {c:14,r:1}), 'three-quarters');
  const m2 = map(20, 3);
  set(m2, 5, 1, { occ: 4.5 });                              // same parapet, 3 squares before the attacker
  t('same parapet 3 squares in front of the ATTACKER → none (vantage problem)',
    cover(m2, {c:2,r:1}, {c:14,r:1}), 'none'); }

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
