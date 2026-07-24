/* smoke-pick-unit.js — the WYSIWYG click picker (table round 3b field fix).
   M's screenshot, 2026-07-12: hover tile on an empty cell, goblin adjacent —
   clicking the goblin said "wrong target" (a nearer unit's transparent quad
   corner won the [0] raycast), clicking the empty cell hit the goblin (his
   oversized quad bled over it). pickUnit ignores quads: ray-vs-standee-column
   closest approach, cell-footprint threshold. Extracted from the mock (real
   functions on the real field) and driven with known-answer geometry.
   Run: node forge/tests/smoke-pick-unit.js                                 */
const fs = require("fs"), path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log("  FAIL " + n)); };

const m = html.match(/var PICK_R2[\s\S]*?function pickUnit\(anyState\)\{[\s\S]*?\n\}/);
ok("pickUnit extractable from the mock", !!m);
if (!m) { console.log("smoke-pick-unit: " + pass + " passed, " + fail + " failed"); process.exit(1); }

/* harness: 1-unit cells, identity wxc/wzc, flat tier; a crowded knot of
   units mirroring the screenshot (PC surrounded by goblins). */
function makePick(units) {
  const env = "var wxc=function(c){return c;}, wzc=function(r){return r;}, tierY=function(){return 0;};" +
    "var unitRigVisible=function(){return true;};" +
    "var CB={units:" + JSON.stringify(units) + "};" +
    "var ray={ray:{origin:null,direction:null}};";
  return new Function("o", "d", "anyState",
    env + m[0] + "; ray.ray.origin=o; ray.ray.direction=d; var u=pickUnit(!!anyState); return u?u.name:null;");
}
const norm = v => { const l = Math.hypot(v.x, v.y, v.z); return { x: v.x / l, y: v.y / l, z: v.z / l }; };
function aim(pick, o, tgt, anyState) { return pick(o, norm({ x: tgt.x - o.x, y: tgt.y - o.y, z: tgt.z - o.z }), anyState); }

const UNITS = [
  { c: 5, r: 5, alive: true,  sprite: 1, side: "foe", name: "gob1" },
  { c: 4, r: 5, alive: true,  sprite: 1, side: "pc",  name: "ves"  },   // camera-nearer neighbour
  { c: 5, r: 6, alive: true,  sprite: 1, side: "foe", name: "gob2" },
  { c: 3, r: 5, alive: false, sprite: 1, side: "pc",  name: "corpse" }, // _ves down pose keeps its sprite
  { c: 7, r: 7, alive: false, sprite: 0, shadow: 0, side: "foe", name: "ghost" } // no visual → never clickable
];
const pick = makePick(UNITS);
const CAM = { x: 0, y: 8, z: 0 };

// M's case 1: clicking the goblin's body in a crowd resolves the GOBLIN,
// not the nearer PC's transparent quad corner
ok("torso click on gob1 → gob1", aim(pick, CAM, { x: 5, y: 1.2, z: 5 }) === "gob1");
// M's case 2: clicking the visibly empty cell beside him picks NOBODY
// (the click then falls to the ground path — matching the hover tile)
ok("empty adjacent cell → null", aim(pick, CAM, { x: 6, y: 0, z: 5 }) === null);
ok("empty diagonal cell → null", aim(pick, CAM, { x: 6, y: 0, z: 4 }) === null);
// feet clicks and crowd separation
ok("feet click on ves → ves", aim(pick, CAM, { x: 4, y: 0.1, z: 5 }) === "ves");
ok("between ves and gob1, nearer gob1 → gob1", aim(pick, CAM, { x: 4.72, y: 0.5, z: 5 }) === "gob1");
ok("between, nearer ves → ves", aim(pick, CAM, { x: 4.3, y: 0.5, z: 5 }) === "ves");
ok("second goblin behind resolves on its own column", aim(pick, CAM, { x: 5, y: 1.0, z: 6 }) === "gob2");
// alive filter vs the heal-anyState door (§F)
ok("corpse invisible to the default picker", aim(pick, CAM, { x: 3, y: 0.8, z: 5 }) === null);
ok("corpse pickable with anyState (heal pending)", aim(pick, CAM, { x: 3, y: 0.8, z: 5 }, true) === "corpse");
// hidden-unit rule: no sprite/shadow on this device → never clickable
ok("visual-less unit never picked, even anyState", aim(pick, CAM, { x: 7, y: 0.8, z: 7 }, true) === null);
// above the standee column → nothing (a sky click over a head)
ok("click far above the head → null", aim(pick, CAM, { x: 5, y: 5.5, z: 5 }) === null);

console.log("smoke-pick-unit: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
