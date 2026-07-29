const assert = require("assert");
const BP = require("../../_edits/mock-forge-blueprint-diorama-core.js");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

ok("schema is the approved forge-blueprint/v1", BP.SCHEMA === "forge-blueprint/v1");
ok("Ruined Abbey kit includes the required module families",
  ["floor", "wall", "corner", "lowWall", "door", "arch", "window", "stairs", "pillar", "rubble", "crates", "brazier", "pool"]
    .every((kind) => BP.KIT[kind]));
ok("finished Choir kit includes abbey furnishings",
  ["altar", "pew", "reliquary", "statue", "candles", "font"].every((kind) => BP.KIT[kind]));
ok("Processional Choir fixture carries the finished furnishing set",
  ["altar", "pew", "reliquary", "statue", "candles", "font"].every((kind) => BP.FIXTURES.processional.props.some((prop) => prop.kind === kind && prop.discoveryRegion === "choir")));
ok("all editable modules declare legal quarter turns",
  ["wall", "lowWall", "door"].every((kind) => [0, 90, 180, 270].every((rotation) => BP.KIT[kind].rotations.includes(rotation))));
ok("rotation normalizes to quarter turns",
  BP.normalizeRotation(44) === 0 && BP.normalizeRotation(46) === 90 && BP.normalizeRotation(-90) === 270);

const fixtureNames = Object.keys(BP.FIXTURES);
ok("three topology fixtures exist", fixtureNames.length === 3);
ok("fixtures are topologically named as linear, loop/hub, and branching",
  /linear/.test(BP.FIXTURES.processional.topology)
  && /hub/.test(BP.FIXTURES.vault.topology)
  && /branch/.test(BP.FIXTURES.warren.topology));

fixtureNames.forEach((name) => {
  const blueprint = BP.FIXTURES[name];
  const first = BP.compile(blueprint, {});
  const second = BP.compile(blueprint, {});
  const valid = BP.validateMap(first);
  const connected = BP.connectivity(first);
  ok(name + " compiles to the current tactical field shape", valid.ok
    && ["cols", "rows", "h", "wall", "occ", "coverShape", "spawns", "props", "meta"].every((key) => first[key] != null));
  ok(name + " compiler output is deterministic", JSON.stringify(first) === JSON.stringify(second));
  ok(name + " is connected and traversable", connected.ok && connected.open === connected.reachable);
  ok(name + " preserves character and foe spawns", first.spawns.some((spawn) => spawn.side === "pc") && first.spawns.some((spawn) => spawn.side === "foe"));
});

const base = BP.FIXTURES.processional;
let edits = BP.editCell({}, 10, 10, "lowWall", 0);
let field = BP.compile(base, edits);
let shape = field.coverShape[BP.idx(field.cols, 10, 10)];
ok("north/south low wall emits directional cover", shape && shape.kind === "box" && shape.halfY > shape.halfX);
edits = BP.editCell(edits, 10, 10, "lowWall", 90);
field = BP.compile(base, edits);
shape = field.coverShape[BP.idx(field.cols, 10, 10)];
ok("quarter-turn low wall rotates tactical cover", shape && shape.halfX > shape.halfY);
edits = BP.editCell(edits, 10, 10, "door", 90);
field = BP.compile(base, edits);
ok("door remains an open tactical cell", field.wall[BP.idx(field.cols, 10, 10)] === false && field.occ[BP.idx(field.cols, 10, 10)] === 0);
edits = BP.editCell(edits, 10, 10, "wall", 0);
field = BP.compile(base, edits);
ok("placed wall blocks and occupies its cell", field.wall[BP.idx(field.cols, 10, 10)] === true && field.occ[BP.idx(field.cols, 10, 10)] === BP.KIT.wall.heightFt);
edits = BP.editCell(edits, 10, 10, "erase", 0);
field = BP.compile(base, edits);
ok("erase restores the underlying playable cell", field.wall[BP.idx(field.cols, 10, 10)] === false && field.occ[BP.idx(field.cols, 10, 10)] === 0);

const chunk = BP.chunkFor(base, 10, 10);
ok("local edit resolves one stable chunk", chunk.key === "2,2" && BP.chunkCount(base) === 24);
const raised = BP.changeZone(base, "nave", 10, "crypt");
const raisedField = BP.compile(raised, {});
const raisedIndex = BP.idx(raisedField.cols, 12, 10);
ok("zone edit changes compiler elevation and material authority",
  raisedField.h[raisedIndex] === 10 && raisedField.meta.regions[raisedIndex].material === "crypt");
ok("fixture source remains mutation-isolated", BP.FIXTURES.processional.spaces.find((space) => space.discoveryRegion === "nave").elevationFt === 0);
const spawnWall = BP.compile(base, BP.editCell({}, 4, 10, "wall", 0));
ok("compiler audit rejects architecture placed under a creature", !BP.validateMap(spawnWall).ok);

console.log("\n" + passed + " Blueprint/Diorama checks passed");
