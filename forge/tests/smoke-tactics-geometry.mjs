import Geo from "../tactics-geometry.js";

let pass = 0, fail = 0;
function ok(name, cond) { cond ? (pass++) : (fail++, console.log("  ✗ " + name)); }
function eq(name, got, want) { ok(name + "  (got " + JSON.stringify(got) + ")", got === want); }

/* helper: set a tile's height / wall on a fresh map */
function setH(m, c, r, h) { m.h[Geo.idx(m, c, r)] = h; }
function setW(m, c, r) { m.wall[Geo.idx(m, c, r)] = true; }

/* ── MOVEMENT: cliff gating ──────────────────────────────────────── */
// row of 5, flat 0 except a walkable +5 terrace at c=2 and a 15ft plateau at c>=3
(function () {
  const m = Geo.makeMap(5, 3);
  setH(m, 2, 0, 5); setH(m, 2, 1, 5); setH(m, 2, 2, 5);
  for (let r = 0; r < 3; r++) { setH(m, 3, r, 15); setH(m, 4, r, 15); }
  const walker = { c: 0, r: 1, speed: 30 };            // 6 squares, no climb/fly
  const reach = Geo.movementReach(m, walker);
  const onCliff = Object.keys(reach).some(k => +k.split(",")[0] >= 3);
  ok("walker reaches the +5 terrace (c=2)", !!reach["2,1"]);
  ok("walker CANNOT walk up the 15ft cliff (c>=3 unreachable)", !onCliff);

  const climber = { c: 0, r: 1, speed: 30, climb: true };
  const cReach = Geo.movementReach(m, climber);
  ok("climber CAN reach the cliff top", Object.keys(cReach).some(k => +k.split(",")[0] >= 3));

  const flyer = { c: 0, r: 1, speed: 30, fly: true };
  ok("flyer CAN reach the cliff top", Object.keys(Geo.movementReach(m, flyer)).some(k => +k.split(",")[0] >= 3));
})();

/* ── MOVEMENT: walls & occupancy block ───────────────────────────── */
(function () {
  const m = Geo.makeMap(5, 1);
  setW(m, 2, 0);
  const reach = Geo.movementReach(m, { c: 0, r: 0, speed: 30 });
  ok("wall tile is never reachable", !reach["2,0"]);
  ok("tiles past a wall on a 1-wide corridor are unreachable", !reach["3,0"] && !reach["4,0"]);
  const reach2 = Geo.movementReach(m, { c: 0, r: 0, speed: 30 }, new Set(["1,0"]));
  ok("occupied neighbour blocks the corridor", !reach2["1,0"] && !reach2["2,0"]);
  // explicit remaining-budget caps distance (split movement)
  const open = Geo.makeMap(10, 1);
  const full = Geo.movementReach(open, { c: 0, r: 0, speed: 30 });      // 6 squares
  const partial = Geo.movementReach(open, { c: 0, r: 0, speed: 30 }, undefined, 2);
  ok("full speed reaches 6 squares", !!full["6,0"] && !full["7,0"]);
  ok("a 2-square budget only reaches 2", !!partial["2,0"] && !partial["3,0"]);
})();

/* ── MELEE: vertical reach ───────────────────────────────────────── */
(function () {
  const m = Geo.makeMap(4, 4);
  setH(m, 1, 1, 5);            // one terrace up
  setH(m, 2, 2, 15);           // plateau
  const a = { c: 0, r: 0 };
  ok("melee hits an adjacent same-height foe", Geo.canReachMelee(m, a, { c: 1, r: 0 }, 5));
  ok("melee hits an adjacent foe 5ft up", Geo.canReachMelee(m, a, { c: 1, r: 1 }, 5));
  ok("melee CANNOT hit an adjacent foe 15ft up", !Geo.canReachMelee(m, { c: 1, r: 2 }, { c: 2, r: 2 }, 5));
  ok("5ft reach CANNOT hit a foe 2 squares away", !Geo.canReachMelee(m, a, { c: 2, r: 0 }, 5));
  ok("10ft reach CAN hit a foe 2 squares away (flat)", Geo.canReachMelee(m, a, { c: 2, r: 0 }, 10));
})();

/* ── RANGED: true 3D distance ────────────────────────────────────── */
(function () {
  const m = Geo.makeMap(12, 3);
  const a = { c: 0, r: 1 }, flat = { c: 6, r: 1 };      // 6 sq = 30 ft
  eq("flat range = 30ft", Math.round(Geo.range3d(m, a, flat)), 30);
  ok("30ft sling reaches a flat 30ft target", Geo.inRange(m, a, flat, 30));
  setH(m, 6, 1, 20);                                    // lift target 20ft
  const d = Geo.range3d(m, a, { c: 6, r: 1 });
  ok("lifting the target 20ft pushes it out of 30ft range", d > 30 && !Geo.inRange(m, a, { c: 6, r: 1 }, 30));
})();

/* ── LOS + COVER: corner tracing ─────────────────────────────────── */
(function () {
  const open = Geo.makeMap(8, 5);
  eq("open ground = no cover", Geo.losVerdict({ ...open }, { c: 0, r: 2 }, { c: 6, r: 2 }).cover, "none");

  // full 3-tall wall column enclosing the target's flank → total cover
  const walled = Geo.makeMap(8, 5);
  setW(walled, 3, 1); setW(walled, 3, 2); setW(walled, 3, 3);
  const tv = Geo.losVerdict(walled, { c: 0, r: 2 }, { c: 6, r: 2 });
  eq("target fully behind a wall column = total", tv.cover, "total");
  ok("total cover cannot be targeted", tv.canTarget === false);

  // a shorter wall the target peeks past → partial (some lines clear). Under
  // M's round-3 grading (2026-07-11, attribution by side) the c=3 wall is a
  // midfield tie (3 squares from each) and grades — the original map stands.
  const peek = Geo.makeMap(8, 5);
  setW(peek, 3, 2); setW(peek, 3, 3);
  const pv = Geo.losVerdict(peek, { c: 0, r: 1 }, { c: 6, r: 2 });
  ok("peeking past a low wall = partial cover, still targetable",
     pv.canTarget && pv.cover !== "none" && pv.cover !== "total");
  ok("partial cover grants an AC bonus", pv.acBonus === 2 || pv.acBonus === 5);

  // ray for the visual line
  ok("center ray reports clear on open ground", !Geo.losRay(open, { c: 0, r: 2 }, { c: 6, r: 2 }).blocked);
  ok("center ray reports blocked through the wall column", Geo.losRay(walled, { c: 0, r: 2 }, { c: 6, r: 2 }).blocked);

  // regression (field bug): a shot whose CENTRE line is blocked by a wall must
  // never read as a clean half-cover shot — it's shooting around the wall.
  const front = Geo.makeMap(12, 10);
  setW(front, 6, 6);
  const fv = Geo.losVerdict(front, { c: 10, r: 7 }, { c: 5, r: 6 });
  ok("wall in front of target (centre blocked) → three-quarters, not half",
     fv.canTarget && fv.cover === "three-quarters");
  // and fully behind a wall from straight on is still total (denied)
  const behind = Geo.losVerdict(walled, { c: 0, r: 2 }, { c: 6, r: 2 });
  ok("straight through the wall column is still total (denied)", behind.cover === "total" && !behind.canTarget);
})();

console.log("\n" + (fail ? "✗ " : "✓ ") + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
