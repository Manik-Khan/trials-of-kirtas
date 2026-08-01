const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Core = require("../../_edits/mock-forge-image-combat-handoff-core.js");
const Bridge = require("../map-bridge.js");

const html = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-combat-handoff.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-combat-handoff.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-combat-handoff.js"), "utf8");
let passed = 0;
function ok(name, value) {
  assert.ok(value, name); passed++; console.log("✓ " + name);
}

function analysis(cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push({ c, r, material: r < 3 ? "stone" : "earth", evidence: {
      r: 118 + c * 3, g: 92 + r * 4, b: 58 + (c + r) * 2
    }});
  }
  return { width: cols * 20, height: rows * 20, grid: { cols, rows }, cells };
}
function region(id, type, cells, topFt, source = "dm-authored", color = "#7f6547") {
  return { id, type, label: id, cells, baseFt: 0, topFt, source, solid: type === "building",
    roofWalkable: type === "roof" || type === "bridge", supportMode: type === "bridge" ? "posts" : "solid",
    access: "none", appearance: type + "-test", palette: { primary: color, accents: [color], source: "local-pixels" } };
}
const cols = 16, rows = 12;
const review = {
  schema: "forge-structure-review/v1", version: 1, scene: "Imported market",
  grid: { cols, rows, cellPx: 20, originX: 0, originY: 0 },
  regions: [
    region("proposal-only", "building", [[0, 0]], 30, "local-proposal", "#ff00ff"),
    region("guildhall", "building", [[6, 4], [7, 4], [6, 5], [7, 5]], 20, "dm-authored", "#8c5f43"),
    region("canal", "water", [[10, 7], [11, 7], [12, 7]], 0, "dm-authored", "#3e7782"),
    region("walkway", "bridge", [[4, 8], [5, 8], [6, 8]], 15, "dm-authored", "#b28b5b"),
    region("steps", "stairs", [[3, 8], [3, 9], [3, 10]], 10, "dm-authored", "#b6a77f")
  ], history: []
};

ok("the combat handoff is an isolated local-file proof",
  /isolated handoff proof/.test(html) && /sessionStorage/.test(js) && !/fetch\(|supabase/i.test(js));
ok("the proof loads the current deployment, geometry, combat-rules, and map authorities",
  ["forge-deployment.js?v=fd3", "tactics-geometry.js?v=ich1", "forge-combat-rules.js?v=fcr3", "map-bridge.js?v=ich1"]
    .every((asset) => html.includes(asset)));
ok("all combat-handoff assets carry their first cache stamp",
  html.includes("mock-forge-image-combat-handoff.css?v=ich1")
  && html.includes("mock-forge-image-combat-handoff-core.js?v=ich3")
  && html.includes("mock-forge-image-combat-handoff.js?v=ich2"));
ok("the UI exposes artwork, rules-map, and combat views",
  ["artwork", "rules", "combat"].every((view) => html.includes(`data-view="${view}"`)));
ok("the simultaneous bridge-underpass limitation is visible before play",
  /One effective surface per square/.test(html) && /simultaneously occupy the ground beneath/.test(html));

const compiled = Core.reviewToMap(review, analysis(cols, rows));
const map = compiled.map;
ok("the reviewed artwork compiles to the current readable Forge map shape", Bridge.validate(map).ok);
ok("automatic proposals never become rules blockers", map.wall[0] === false && map.meta.importAuthority === "dm-confirmed-structures");
ok("confirmed solid structures and water block movement",
  map.wall[4 * cols + 6] === true && map.wall[7 * cols + 10] === true);
ok("a confirmed raised surface becomes the effective current surface",
  map.h[8 * cols + 5] === 15 && map.wall[8 * cols + 5] === false);
ok("stairs compile to a current connector with explicit elevations",
  map.connectors.length === 1 && map.connectors[0].kind === "stairs"
  && map.connectors[0].path[0].elevationFt === 0
  && map.connectors[0].path.at(-1).elevationFt === 10);
ok("per-region sampled color survives into rules-facing terrain",
  map.terrain[4 * cols + 6].color === "#8c5f43" && map.meta.regionColors.guildhall === "#8c5f43");
ok("the receipt explicitly counts deferred bridge underpasses", compiled.receipt.deferredUnderpasses === 1);

const deployment = Core.deployCombatants(map);
ok("the existing Forge deployment authority resolves both groups", deployment.ok && deployment.record.resolved);
const positionKeys = Object.values(deployment.draft.positions).map((at) => `${at.c},${at.r}`);
ok("deployment never stacks combatants", new Set(positionKeys).size === positionKeys.length);
ok("deployment never places a combatant in a blocked cell",
  Object.values(deployment.draft.positions).every((at) => !map.wall[at.r * cols + at.c]));
const partyPositions = Core.PARTY.map((unit) => deployment.draft.positions[unit.unit]);
const foePositions = Core.FOES.map((unit) => deployment.draft.positions[unit.unit]);
const openingGap = Math.min(...partyPositions.flatMap((pc) => foePositions.map((foe) => Math.max(Math.abs(pc.c - foe.c), Math.abs(pc.r - foe.r)) * 5)));
ok("the two groups open within a playable 40–90 ft encounter band", openingGap >= 40 && openingGap <= 90);

let fight = Core.createFight(map, deployment);
ok("the local fight has deterministic initiative and an active combatant",
  fight.units.length === 6 && Core.activeUnit(fight) && fight.log[0].startsWith("Initiative:"));
const active = Core.activeUnit(fight);
const reachable = Core.reachableForActive(fight);
const destination = Object.keys(reachable)[0].split(",").map(Number);
const moved = Core.moveActive(fight, destination[0], destination[1]);
ok("movement is resolved by the current tactical geometry", moved.ok && moved.path.length > 0);
fight = moved.fight;
const attacker = Core.activeUnit(fight);
const target = fight.units.find((unit) => unit.alive && unit.side !== attacker.side);
const occupied = new Set(fight.units.filter((unit) => unit.unit !== attacker.unit && unit.unit !== target.unit).map((unit) => `${unit.c},${unit.r}`));
const adjacent = [[1,0],[-1,0],[0,1],[0,-1]].map(([dc,dr]) => ({ c: attacker.c + dc, r: attacker.r + dr }))
  .find((at) => at.c >= 0 && at.r >= 0 && at.c < cols && at.r < rows && !map.wall[at.r * cols + at.c] && !occupied.has(`${at.c},${at.r}`));
target.c = adjacent.c; target.r = adjacent.r;
const attacked = Core.resolveAttack(fight, target.unit);
ok("a basic attack consumes current range, line-of-sight, cover, and combat-roll helpers",
  attacked.ok && attacked.sight && attacked.sources && /rolled/.test(attacked.message));
const next = Core.endTurn(attacked.fight);
ok("ending a turn advances initiative and resets the next combatant", Core.activeUnit(next).unit !== attacker.unit && !Core.activeUnit(next).moved);

ok("the browser proof draws artwork colors into rules cells and narrates local-only play",
  /terrain\.color/.test(js) && /Local test fight started/.test(js) && /Nothing here writes/.test(js));
ok("the layout remains a standalone code-native canvas without external rendering dependencies",
  /id="board"/.test(html) && !/three(?:\.min)?\.js/i.test(html + js + css));

console.log(`\n${passed}/${passed} passed\n`);
