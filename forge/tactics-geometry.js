/* ════════════════════════════════════════════════════════════════════
   tactics-geometry.js — pure map-geometry rules over the MAP DOCUMENT.
   No three.js, no DOM. Same source runs in the browser (window.TacticsGeo)
   and headless in node (require / import default), so every verdict is
   smoke-testable — the WebGL-can't-be-tested-headless gap doesn't touch it.

   MAP DOCUMENT (the shared contract the generator will emit):
     { cols, rows,
       h:    Int[rows*cols]   terrain height in FEET (0,5,10,15…),
       wall: bool[rows*cols]  MOVEMENT blocker (impassable),
       occ?: Int[rows*cols]   OPTIONAL occluder height in FEET *above* h[]:
                              0 = open ground, 4.5 = a boulder, 10.5 = a temple
                              wall. Sight is decided by h+occ vs the 3D ray, so
                              a hill occludes and a pit never can.
                              When occ[] is ABSENT the module falls back to the
                              v1 rule (wall === full-height opaque), so existing
                              maps keep their exact behaviour. }

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
var EYE_FT    = 5;   // a Medium creature's eye, above the ground it stands on
var FOOT_FT   = 0.5; // and the lowest sliver of it that still counts as visible

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
/* The top of whatever stands in this cell, in feet. Off-map is opaque.
   With no occ[], a wall is infinitely tall — v1 behaviour, unchanged. */
function occTop(map, c, r) {
  if (!inBounds(map, c, r)) return Infinity;
  var i = idx(map, c, r);
  if (map.occ && map.occ[i] != null) return map.h[i] + map.occ[i];
  return map.wall[i] ? Infinity : map.h[i];
}
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

/* ── LINE-OF-SIGHT + COVER — 5e corner-tracing, in three dimensions ──
   The v1 rule traced four flat lines and asked "is there a wall cell?".
   This traces the same four lines through the HEIGHTFIELD and asks "does
   anything stand above the ray where it passes?" — which is the same
   question with the z-axis put back.

   Consequences that fall out of the arithmetic rather than being asserted:
     · A pit can never block. Its top is below the ray, always.
     · A hill or a wall blocks when it rises above the ray.
     · Height beats cover: raise the eye, raise the whole ray, clear the wall.
     · Pressed against a wall taller than you, you are blind — the ray has
       not begun to climb. Step back and the same ray meets the wall higher
       up, so it clears. Only true when the target is ABOVE you; a flat ray
       cannot rise. This is why the wall's near CORNER, not its centre,
       decides. We sample densely, so the low edge of each cell is tested.
     · A creature is five feet tall. We trace to its head AND its feet, so a
       boulder that hides the legs and not the head yields three-quarters
       cover, not total. That grading is the whole point of the corner rule.

   Eight lines: 4 corners × {feet, head}. Blocked count →
     0     none
     1–4   half           (+2 AC / +2 Dex saves)   [centre must be clear]
     5–7   three-quarters (+5)
     8     total          (cannot be targeted by a single-target attack)   */
function segOccluded(map, x0, y0, z0, x1, y1, z1, aC, aR, bC, bR) {
  // Dense sample of the OPEN segment. Because we test every sample, the low
  // edge of each cell along the ray is tested too — that is the near corner.
  var steps = 240;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    var c = Math.floor(x), r = Math.floor(y);
    if ((c === aC && r === aR) || (c === bC && r === bR)) continue; // own squares
    if (occTop(map, c, r) > z + 1e-9) return true;
  }
  return false;
}
/* v1 name kept as a thin alias: same question, flat map, no occ[]. */
function segHitsWall(map, x0, y0, x1, y1, aC, aR, bC, bR) {
  var z = heightAt(map, aC, aR) + EYE_FT;
  return segOccluded(map, x0, y0, z, x1, y1, z, aC, aR, bC, bR);
}
var CORNERS = [[0,0],[1,0],[0,1],[1,1]];
/* Ledge peek (M's table ruling, 2026-07-11): standing AT a ledge means you
   lean over it — that is why step-to-the-ledge, shoot, step-back is a real
   tactic. A corner of the attacker's own square is a LIP corner when any of
   the three other cells sharing it has a top (occTop) below the attacker's
   floor. Flat ground offers no lip corners, so the centre-only eye — which
   refuses the sideways peek-around-the-edge loophole — is unchanged, and one
   square back from the edge the lip cell still blocks (dead ground stands). */
function lipCorners(map, c, r) {
  var floor = heightAt(map, c, r), out = [];
  for (var k = 0; k < CORNERS.length; k++) {
    var dx = CORNERS[k][0] ? 1 : -1, dy = CORNERS[k][1] ? 1 : -1;
    if (occTop(map, c + dx, r) < floor - 1e-9 ||
        occTop(map, c, r + dy) < floor - 1e-9 ||
        occTop(map, c + dx, r + dy) < floor - 1e-9)
      out.push([c + CORNERS[k][0], r + CORNERS[k][1]]);
  }
  return out;
}
function verdictFromEye(map, ax, ay, az, a, b) {
  var bh = heightAt(map, b.c, b.r);
  var zHead = bh + EYE_FT, zFeet = bh + FOOT_FT;
  var blocked = 0;
  for (var tc = 0; tc < CORNERS.length; tc++) {
    var bx = b.c + CORNERS[tc][0], by = b.r + CORNERS[tc][1];
    if (segOccluded(map, ax, ay, az, bx, by, zHead, a.c, a.r, b.c, b.r)) blocked++;
    if (segOccluded(map, ax, ay, az, bx, by, zFeet, a.c, a.r, b.c, b.r)) blocked++;
  }
  var centerBlocked = segOccluded(map, ax, ay, az,
                                  b.c + 0.5, b.r + 0.5, bh + (EYE_FT + FOOT_FT) / 2,
                                  a.c, a.r, b.c, b.r);
  var cover, acBonus;
  if (blocked === 0)      { cover = "none";  acBonus = 0; }
  else if (blocked >= 8)  { cover = "total"; acBonus = Infinity; }   // nothing visible
  else if (blocked <= 4 && !centerBlocked) { cover = "half"; acBonus = 2; }
  else { cover = "three-quarters"; acBonus = 5; }  // heavy clip, or a blocked centre
  return { cover: cover, acBonus: acBonus, blocked: blocked, canTarget: cover !== "total" };
}
function losVerdict(map, a, b) {
  // Centre eye first — the honest default (not the most favourable corner:
  // that loophole let shots graze through walls sideways). Lip corners are
  // tried only when the centre verdict left cover to shave, and only where
  // the ground falls away. The winning eye rides back in v.eye so the drawn
  // sight line can start where the ruling looked from.
  var az = heightAt(map, a.c, a.r) + EYE_FT;
  var v = verdictFromEye(map, a.c + 0.5, a.r + 0.5, az, a, b);
  v.eye = { x: a.c + 0.5, y: a.r + 0.5, peek: false };
  if (v.acBonus === 0) return v;
  var lips = lipCorners(map, a.c, a.r);
  for (var e = 0; e < lips.length; e++) {
    var w = verdictFromEye(map, lips[e][0], lips[e][1], az, a, b);
    if (w.acBonus < v.acBonus) { w.eye = { x: lips[e][0], y: lips[e][1], peek: true }; v = w; }
    if (v.acBonus === 0) break;
  }
  return v;
}

/* center-to-center ray, for drawing the "is the shot clear" line.
   Optional eye {x,y} starts the ray where losVerdict's winning eye looked
   from (ledge peek), so the drawn line agrees with the ruling. */
function losRay(map, a, b, eye) {
  var x0 = (eye && eye.x != null) ? eye.x : a.c + 0.5,
      y0 = (eye && eye.y != null) ? eye.y : a.r + 0.5,
      z0 = heightAt(map, a.c, a.r) + EYE_FT;
  var x1 = b.c + 0.5, y1 = b.r + 0.5, z1 = heightAt(map, b.c, b.r) + EYE_FT;
  var steps = 240;
  for (var s = 1; s < steps; s++) {
    var t = s / steps;
    var c = Math.floor(x0 + (x1 - x0) * t), r = Math.floor(y0 + (y1 - y0) * t);
    if ((c === a.c && r === a.r) || (c === b.c && r === b.r)) continue;
    if (occTop(map, c, r) > z0 + (z1 - z0) * t + 1e-9) return { blocked: true, at: { c: c, r: r } };
  }
  return { blocked: false, at: null };
}

var API = {
  SQUARE_FT: SQUARE_FT, STEP_FT: STEP_FT, EYE_FT: EYE_FT, FOOT_FT: FOOT_FT, DIRS: DIRS,
  makeMap: makeMap, idx: idx, inBounds: inBounds, heightAt: heightAt,
  isWall: isWall, occTop: occTop, chebyshev: chebyshev,
  stepAllowed: stepAllowed, movementReach: movementReach, pathTo: pathTo,
  canReachMelee: canReachMelee, range3d: range3d, inRange: inRange,
  losVerdict: losVerdict, losRay: losRay, lipCorners: lipCorners
};
if (typeof module !== "undefined" && module.exports) module.exports = API;
global.TacticsGeo = API;

})(typeof window !== "undefined" ? window : globalThis);
