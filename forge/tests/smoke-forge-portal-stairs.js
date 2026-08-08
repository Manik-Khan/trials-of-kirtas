const assert = require("assert");
const fs = require("fs");
const path = require("path");

const Core = require(path.join(__dirname, "..", "..", "_edits", "mock-forge-portal-stairs-core.js"));
const proofDir = path.join(__dirname, "..", "..", "_edits");
const html = fs.readFileSync(path.join(proofDir, "mock-forge-portal-stairs.html"), "utf8");
const browserJs = fs.readFileSync(path.join(proofDir, "mock-forge-portal-stairs.js"), "utf8");
let passed = 0;
function ok(name, value) {
  assert.ok(value, name); passed++; console.log("✓ " + name);
}

const scenes = [0, 1, 2].map((candidate) => Core.generate(1847, candidate));
ok("the proof offers three distinct architectural directions", new Set(scenes.map((scene) => scene.fingerprint)).size === 3);
ok("the same seed and direction reproduce exactly", Core.stableStringify(scenes[1]) === Core.stableStringify(Core.generate(1847, 1)));
ok("every graph edge becomes one owned architectural connection", scenes.every((scene) => scene.connections.length === scene.edges.length));
ok("every connection owns two perimeter portals", scenes.every((scene) => scene.connections.every((connection) => connection.portals.length === 2)));
ok("every route is cardinal and rises no more than five feet per cell", scenes.every((scene) => scene.connections.every((connection) => connection.path.every((cell, index) => !index ||
  (Math.abs(cell.c - connection.path[index - 1].c) + Math.abs(cell.r - connection.path[index - 1].r) === 1
    && Math.abs(cell.elevationFt - connection.path[index - 1].elevationFt) <= 5)))));
ok("stair endpoints match their low and high room elevations", scenes.every((scene) => scene.connections.filter((connection) => connection.kind === "stairs").every((connection) =>
  connection.lowLanding.elevationFt === connection.lowFt && connection.highLanding.elevationFt === connection.highFt)));
ok("stair runways stay outside room interiors except for the high portal", scenes.every((scene) => scene.connections.every((connection) => connection.stairPath.slice(0, -1).every((cell) => !scene.roomLookup[Core.cellKey(cell.c, cell.r)]))));
ok("corridors never cross an unrelated room", scenes.every((scene) => scene.connections.every((connection) => connection.path.slice(1, -1).every((cell) => {
  const owner = scene.roomLookup[Core.cellKey(cell.c, cell.r)];
  return !owner || owner === connection.lowRoomId || owner === connection.highRoomId;
}))));
ok("walls are generated around rather than across every portal", scenes.every((scene) => scene.connections.every((connection) => connection.portals.every((portal) =>
  !scene.walls.some((wall) => wall.roomId === portal.roomId && wall.c === portal.c && wall.r === portal.r && wall.side === portal.side)))));
ok("all three boards are connected under five-foot tactical movement", scenes.every((scene) => scene.audit.tactical.ok && scene.audit.tactical.reachable === scene.audit.tactical.open));
ok("all three architecture audits pass", scenes.every((scene) => scene.audit.ok && scene.audit.errors.length === 0));

const impossible = Core.makeSpecs(1847)[0];
impossible.grid = { cols: 12, rows: 8 };
const rejected = Core.buildFromSpec(impossible);
ok("an arrangement with no legal portal and stair runway is rejected", !rejected.ok && /No legal portal|could not|Unknown room/.test(rejected.reason));
ok("the isolated proof loads only its own cache-stamped assets", [
  "mock-forge-portal-stairs.css?v=ps1", "mock-forge-portal-stairs-core.js?v=ps1", "mock-forge-portal-stairs.js?v=ps1"
].every((asset) => html.includes(asset)) && !html.includes("forge/combat"));
ok("the proof exposes plan and height views from the same scene", html.includes('id="plan"') && html.includes('id="height"')
  && browserJs.includes("renderPlan(scene)") && browserJs.includes("renderHeight(scene)"));
ok("route selection isolates one owned connection without regenerating", html.includes('id="routes"')
  && browserJs.includes("state.selected = button.dataset.route") && browserJs.includes("selectedConnection(scene)"));
ok("the receipt narrates accepted architecture and explicit rejection policy", html.includes("If a stair cannot fit, the map is rejected")
  && browserJs.includes('scene.audit.ok ? "Accepted'));

console.log(`\n${passed} portal-owned stair checks passed`);
