/* ════════════════════════════════════════════════════════════════════
   tactics-geometry.js — pure map-geometry rules over the MAP DOCUMENT.
   No three.js, no DOM. Same source runs in the browser (window.TacticsGeo)
   and headless in node (require / import default), so every verdict is
   smoke-testable — the WebGL-can't-be-tested-headless gap doesn't touch it.

   MAP DOCUMENT (the shared contract the generator will emit):
     { cols, rows,
       h:    Int[rows*cols]   terrain height in FEET (0,5,10,15…),
       wall: bool[rows*cols]  full-height opaque sight+move blocker }

   Everything here is ENFORCE-layer (deterministic, one right answer).
   The ADJUDICATE layer (which OAs trigger, soft/narrative cover, the DM's
   rule-of-cool override) lives above this in the mock UI, not here.
   ════════════════════════════════════════════════════════════════════ */
;(function (global) {
"use strict";

/* ── tunables (5e grid) ──────────────────────────────────────────── */
var SQUARE_FT = 5;   // one square
var STEP_FT   = 5;   // max height delta you can walk up/down in one step;
                     // anything taller is a CLIFF → needs climb or fly

/* ── map helpers ─────────────────────────────────────────────────── */
function makeMap(cols, rows) {
  return { cols: cols, rows: rows,
           h: new Array(cols * rows).fill(0),
           wall: new Array(cols * rows).fill(false) };
}
function idx(map, c, r) { return r * map.cols + c; }
function inBounds(map, c, r) { return c >= 0 && c < map.cols && r >= 0 && r < map.rows; }
function heightAt(map, c, r) { return inBounds(map, c, r) ? map.h[idx(map, c, r)] : 0; }
function isWall(map, c, r) { return inBounds(map, c, r) && !!map.wall[idx(map, c, r)]; }
function chebyshev(a, b) { return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r)); }

/* ── MOVEMENT — height-gated BFS ─────────────────────────────────────
   Walls block. Occupied tiles block. A step to an adjacent tile is barred
   when the height delta exceeds STEP_FT — UNLESS the token can climb or fly.
   (Climb cost = still 1 square here; real 5e 2×-cost climb is a later refinement.)
   `occupied` is a Set of "c,r" strings for other creatures.               */
var DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
function stepAllowed(map, token, fromC, fromR, toC, toR) {
  if (!inBounds(map, toC, toR)) return false;
  if (isWall(map, toC, toR)) return false;
  var dh = Math.abs(heightAt(map, toC, toR) - heightAt(map, fromC, fromR));
  if (token.fly || token.climb) return true;      // wings / climb kit ignore the cliff
  return dh <= STEP_FT;                            // otherwise a cliff is a hard no
}
function movementReach(map, token, occupied, budgetSquares) {
  occupied = occupied || new Set();
  var budget = (budgetSquares != null) ? budgetSquares : Math.floor(token.speed / SQUARE_FT);
  var start = token.c + "," + token.r;
  var seen = {}; seen[start] = { d: 0, from: null };
  var q = [{ c: token.c, r: token.r, d: 0 }];
  while (q.length) {
    var n = q.shift();
    if (n.d >= budget) continue;
    for (var i = 0; i < DIRS.length; i++) {
      var c = n.c + DIRS[i][0], r = n.r + DIRS[i][1], k = c + "," + r;
      if (seen[k] !== undefined) continue;
      if (occupied.has(k)) continue;
      if (!stepAllowed(map, token, n.c, n.r, c, r)) continue;
      seen[k] = { d: n.d + 1, from: n.c + "," + n.r };
      q.push({ c: c, r: r, d: n.d + 1 });
    }
  }
  delete seen[start];
  return seen;
}
function pathTo(seen, token, c, r) {
  var path = [], k = c + "," + r, home = token.c + "," + token.r;
  while (k && k !== home) {
    var p = k.split(",").map(Number);
    path.unshift({ c: p[0], r: p[1] });
    k = seen[k] ? seen[k].from : null;
  }
  return path;
}

/* ── MELEE REACH — horizontal AND vertical ───────────────────────────
   You can't swing a longsword at someone one square away but 15 ft up.
   reachFt is 5 for most, 10 for reach weapons.                            */
function canReachMelee(map, a, b, reachFt) {
  reachFt = reachFt || SQUARE_FT;
  var horizOk = chebyshev(a, b) <= Math.floor(reachFt / SQUARE_FT);
  var dv = Math.abs(heightAt(map, a.c, a.r) - heightAt(map, b.c, b.r));
  return horizOk && dv <= reachFt;
}

/* ── RANGED — true 3D distance in feet ───────────────────────────────
   Horizontal on the grid (chebyshev×5) combined with the vertical drop.  */
function range3d(map, a, b) {
  var horiz = chebyshev(a, b) * SQUARE_FT;
  var vert = Math.abs(heightAt(map, a.c, a.r) - heightAt(map, b.c, b.r));
  return Math.hypot(horiz, vert);
}
function inRange(map, a, b, rangeFt) { return range3d(map, a, b) <= rangeFt + 1e-6; }

/* ── LINE-OF-SIGHT + COVER — 5e grid corner-tracing ──────────────────
   Walls are full-height opaque blockers (terrain-height occlusion —
   shooting over a hill — is the documented next layer, not v1).
   Rule: from ONE corner of the attacker's square, trace to all four
   corners of the target's square; the attacker picks the corner giving
   the FEWEST blocked lines (least cover, per RAW). Blocked count →
     0     none
     1–2   half           (+2 AC / +2 Dex saves)
     3     three-quarters (+5)
     4     total          (cannot be targeted by a single-target attack)   */
function segHitsWall(map, x0, y0, x1, y1, aC, aR, bC, bR) {
  // dense sample of the OPEN segment; a strictly-interior wall cell blocks.
  var steps = 240;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    var c = Math.floor(x), r = Math.floor(y);
    if ((c === aC && r === aR) || (c === bC && r === bR)) continue; // own squares
    if (isWall(map, c, r)) return true;
  }
  return false;
}
var CORNERS = [[0,0],[1,0],[0,1],[1,1]];
function losVerdict(map, a, b) {
  // Trace from the attacker's actual eye (square centre) to the target's four
  // corners. Using the centre — not the most favourable corner — matches the
  // single drawn sight-line and refuses the "peek around the edge" loophole
  // that let shots graze straight through a wall and still count as half cover.
  var ax = a.c + 0.5, ay = a.r + 0.5;
  var blocked = 0;
  for (var tc = 0; tc < CORNERS.length; tc++) {
    if (segHitsWall(map, ax, ay, b.c + CORNERS[tc][0], b.r + CORNERS[tc][1], a.c, a.r, b.c, b.r)) blocked++;
  }
  var centerBlocked = segHitsWall(map, ax, ay, b.c + 0.5, b.r + 0.5, a.c, a.r, b.c, b.r);
  var cover, acBonus;
  if (blocked === 0)      { cover = "none";  acBonus = 0; }
  else if (blocked >= 4)  { cover = "total"; acBonus = Infinity; }   // no corner visible
  else if (blocked <= 2 && !centerBlocked) { cover = "half"; acBonus = 2; }
  else { cover = "three-quarters"; acBonus = 5; }  // heavy clip, or shooting around a blocked centre
  return { cover: cover, acBonus: acBonus, blocked: blocked, canTarget: cover !== "total" };
}

/* center-to-center ray, for drawing the "is the shot clear" line */
function losRay(map, a, b) {
  var x0 = a.c + 0.5, y0 = a.r + 0.5, x1 = b.c + 0.5, y1 = b.r + 0.5;
  var steps = 240;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var c = Math.floor(x0 + (x1 - x0) * t), r = Math.floor(y0 + (y1 - y0) * t);
    if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) continue;
    if (isWall(map, c, r)) return { blocked: true, at: { c: c, r: r } };
  }
  return { blocked: false, at: null };
}

var API = {
  SQUARE_FT: SQUARE_FT, STEP_FT: STEP_FT, DIRS: DIRS,
  makeMap: makeMap, idx: idx, inBounds: inBounds, heightAt: heightAt,
  isWall: isWall, chebyshev: chebyshev,
  stepAllowed: stepAllowed, movementReach: movementReach, pathTo: pathTo,
  canReachMelee: canReachMelee, range3d: range3d, inRange: inRange,
  losVerdict: losVerdict, losRay: losRay
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.TacticsGeo = API;

})(typeof window !== "undefined" ? window : globalThis);
