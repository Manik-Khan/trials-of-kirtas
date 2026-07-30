const assert = require("assert");
const fs = require("fs");
const path = require("path");
const BP = require("../../_edits/mock-forge-blueprint-diorama-core.js");
const proofHtml = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-blueprint-diorama.html"), "utf8");
const proofCss = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-blueprint-diorama.css"), "utf8");
const proofJs = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-blueprint-diorama.js"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

ok("schema is the approved forge-blueprint/v1", BP.SCHEMA === "forge-blueprint/v1");
ok("the foundry presents one three-part Map, Populate, Play workflow",
  /data-workflow="map"/.test(proofHtml) && />Populate</.test(proofHtml) && />Play</.test(proofHtml));
ok("Map keeps layout, appearance, objects, and reveal areas together",
  ["layout", "appearance", "objects", "areas"].every((tab) => proofHtml.includes('data-map-tab="' + tab + '"')));
ok("direct build exposes room, passage, wall, ledge, door, and erase tools",
  ["room", "corridor", "wall", "lowWall", "door", "erase"].every((tool) => proofHtml.includes('data-layout-tool="' + tool + '"')));
ok("directional repeat exposes all four camera-aware handles",
  ["n", "e", "s", "w"].every((direction) => proofHtml.includes('data-build-direction="' + direction + '"')));
ok("repeat gesture retains the approved 240ms hold cadence and one-transaction commit",
  /}, 240\)/.test(proofJs) && /recordHistory\(moduleLabel\(state\.layoutTool\) \+ " repeated "/.test(proofJs));
ok("all proof assets share the current bp13 cache stamp",
  (proofHtml.match(/\?v=bp13/g) || []).length === 3 && !proofHtml.includes("?v=bp12"));
ok("Build exposes the full brush palette on the left and in a right-click radial menu",
  /id="buildBrushRail"/.test(proofHtml) && /id="buildRadial"/.test(proofHtml)
  && ["select", "room", "corridor", "wall", "lowWall", "door", "erase"].every((tool) => proofHtml.includes('data-radial-tool="' + tool + '"')));
ok("Build keeps Shape, Look, Objects, and Areas permanently reachable on the left",
  /class="brush-context-tabs"/.test(proofHtml)
  && ["layout", "appearance", "objects", "areas"].every((tab) =>
    (proofHtml.match(new RegExp('data-map-tab="' + tab + '"', "g")) || []).length === 2));
ok("arming Build does not hide the detailed right-side Layout tools",
  !/build-armed[^}]*layout-tools\s*\{\s*display\s*:\s*none/.test(proofCss));
ok("the left Build palette follows Layout, Appearance, Objects, and Areas",
  ["layout", "appearance", "objects", "areas"].every((tab) => proofHtml.includes('data-brush-context="' + tab + '"'))
  && ["pew", "pillar", "altar", "brazier", "rubble", "statue"].every((kind) => proofHtml.includes('data-object-kind="' + kind + '"')));
ok("choosing a layout brush from another Map tab returns to Layout",
  /function activateLayoutTool\(kind\)/.test(proofJs) && /state\.mapTab !== "layout"\) setMapTab\("layout"\)/.test(proofJs));
ok("DM authoring visibility is separate from player discovery",
  /function isAuthoringVisible\(info\)/.test(proofJs)
  && /isDiscovered\(info\.region\) \|\| state\.mode === "build"/.test(proofJs));
ok("Build mode uses an opaque cutaway instead of translucent geometry over authored objects",
  /mats\.cutaway\.transparent = !authoring/.test(proofJs)
  && proofJs.includes("mats.cutaway.opacity = authoring ? 1"));
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
const seededA = BP.produceSeeded({ seed: 1847, topology: "auto" });
const seededB = BP.produceSeeded({ seed: 1847, topology: "auto" });
const seededOther = BP.produceSeeded({ seed: 1848, topology: "auto" });
ok("seeded producer is deterministic", JSON.stringify(seededA) === JSON.stringify(seededB));
ok("seeded producer preserves its reproducible provenance",
  seededA.source.kind === "seeded" && seededA.source.seed === 1847 && seededA.source.deterministic === true);
ok("different automatic seeds can select different topology studies", seededA.topology !== seededOther.topology);
const imported = BP.produceImportedSample();
ok("assisted import carries a reviewable source underlay",
  imported.source.kind === "imported" && imported.source.underlay === true && imported.source.review.length === 4);
const acceptedImport = BP.acceptImportFinding(imported, "all");
ok("import findings require and retain explicit confirmation",
  acceptedImport.source.review.every((finding) => finding.accepted) && imported.source.review.every((finding) => !finding.accepted));
const blank = BP.produceBlank();
ok("blank producer creates a connected editable Blueprint",
  blank.source.kind === "blank" && BP.connectivity(BP.compile(blank, {})).ok);
const roomDrawn = BP.addRoom(blank, { c: 1, r: 1 }, { c: 4, r: 3 });
const drawnRoom = roomDrawn.spaces.find((space) => space.id !== "sanctum");
ok("direct room drawing adds the chosen empty rectangular footprint",
  !!drawnRoom && BP.spaceBounds(drawnRoom).minX === 1 && BP.spaceBounds(drawnRoom).maxY === 4);
ok("direct room drawing refuses overlap rather than silently reshaping existing floor",
  BP.addRoom(blank, { c: 9, r: 6 }, { c: 13, r: 9 }) === blank);
const roomsConnected = BP.connectSpaces(roomDrawn, "sanctum", drawnRoom.id, 2);
const drawnPassage = roomsConnected.corridors.find((corridor) => corridor.id.startsWith("passage-"));
ok("selecting two physical rooms creates one explicit passage between those rooms",
  !!drawnPassage && drawnPassage.fromSpaceId === "sanctum" && drawnPassage.toSpaceId === drawnRoom.id);
ok("the directly connected layout compiles as one traversable tactical field",
  BP.connectivity(BP.compile(roomsConnected, {})).ok);
const passageRemoved = BP.removePassage(roomsConnected, drawnPassage.id);
ok("removing the selected passage preserves both physical rooms",
  passageRemoved.corridors.length === 0 && passageRemoved.spaces.length === 2);
const changedRoom = BP.changeSpace(roomDrawn, drawnRoom.id, 5, "crypt");
ok("appearance targets the selected physical room only",
  changedRoom.spaces.find((space) => space.id === drawnRoom.id).material === "crypt"
  && changedRoom.spaces.find((space) => space.id === "sanctum").material === "nave");
const roomProp = BP.placeProp(blank, 10, 7, "altar", 90);
ok("abbey furnishings place directly on playable ground",
  roomProp.props.some((item) => item.kind === "altar" && item.c === 10 && item.r === 7 && item.rotation === 90));
const dividedBlank = BP.divideSpace({}, blank, "sanctum", "vertical");
const dividerKinds = Object.values(dividedBlank).map((edit) => edit.kind);
ok("dividing a selected room creates one visible wall run with a doorway",
  dividerKinds.includes("wall") && dividerKinds.filter((kind) => kind === "door").length === 1);
ok("directional repeat follows the production anchor-excluded line contract",
  JSON.stringify(BP.lineCells({ c: 5, r: 5 }, "e", 3, 10, 10)) === JSON.stringify([{ c: 6, r: 5 }, { c: 7, r: 5 }, { c: 8, r: 5 }]));
ok("directional repeat stops at the map boundary",
  BP.lineCells({ c: 8, r: 5 }, "e", 5, 10, 10).length === 1);
ok("edge repeat preserves the chosen boundary across every segment",
  JSON.stringify(BP.lineEdges({ c: 5, r: 5, edge: "N" }, "e", 3, 10, 10))
  === JSON.stringify([{ c: 6, r: 5, edge: "N" }, { c: 7, r: 5, edge: "N" }, { c: 8, r: 5, edge: "N" }]));
ok("a physical boundary resolves from either adjacent square",
  JSON.stringify(BP.edgeReferences(5, 5, "E"))
  === JSON.stringify([{ c: 5, r: 5, edge: "E" }, { c: 6, r: 5, edge: "W" }]));
ok("opposite edge lookup is cardinal and stable",
  BP.oppositeEdge("N") === "S" && BP.oppositeEdge("E") === "W"
  && BP.oppositeEdge("S") === "N" && BP.oppositeEdge("W") === "E");
ok("all creation doors converge on forge-blueprint/v1",
  [seededA, imported, blank].every((blueprint) => blueprint.schema === BP.SCHEMA && BP.compile(blueprint, {}).meta.producer.kind === blueprint.source.kind));

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
const edgeWallField = BP.compile(base, BP.editCell({}, 10, 10, "wall", 0, "E"));
ok("edge wall remains outside the playable square rather than occupying it",
  edgeWallField.wall[BP.idx(edgeWallField.cols, 10, 10)] === false
  && edgeWallField.occ[BP.idx(edgeWallField.cols, 10, 10)] === 0
  && edgeWallField.meta.edgeBlockers.some((item) => item.a.c === 10 && item.a.r === 10 && item.edge === "E"));
const twoEdgeField = BP.compile(base,
  BP.editCell(BP.editCell({}, 10, 10, "wall", 0, "N"), 10, 10, "door", 0, "E"));
ok("one square can carry independent architecture on more than one edge",
  twoEdgeField.meta.edgeBlockers.length === 2
  && twoEdgeField.meta.edgeBlockers.some((item) => item.edge === "N" && item.kind === "wall")
  && twoEdgeField.meta.edgeBlockers.some((item) => item.edge === "E" && item.kind === "door"));

const chunk = BP.chunkFor(base, 10, 10);
ok("local edit resolves one stable chunk", chunk.key === "2,2" && BP.chunkCount(base) === 24);
const raised = BP.changeZone(base, "nave", 10, "crypt");
const raisedField = BP.compile(raised, {});
const raisedIndex = BP.idx(raisedField.cols, 12, 10);
ok("zone edit changes compiler elevation and material authority",
  raisedField.h[raisedIndex] === 10 && raisedField.meta.regions[raisedIndex].material === "crypt");
const naveSummary = BP.areaSummary(base, "nave");
ok("area summary derives a complete footprint from cell membership",
  naveSummary.complete && naveSummary.cellCount > 0 && naveSummary.boundaryEdges > 0);
ok("area summary derives neighboring areas without relying on hand-placed markers",
  naveSummary.neighborIds.includes("gate") && naveSummary.neighborIds.includes("choir"));
const threeEntranceStudy = {
  grid: { cols: 8, rows: 8 },
  spaces: [
    { id: "room", discoveryRegion: "room", material: "nave", elevationFt: 0, polygon: [[2, 2], [5, 2], [5, 5], [2, 5]] },
    { id: "north-hall", discoveryRegion: "hall", material: "nave", elevationFt: 0, polygon: [[3, 1], [4, 1], [4, 2], [3, 2]] },
    { id: "east-hall", discoveryRegion: "hall", material: "nave", elevationFt: 0, polygon: [[5, 3], [6, 3], [6, 4], [5, 4]] },
    { id: "south-hall", discoveryRegion: "hall", material: "nave", elevationFt: 0, polygon: [[3, 5], [4, 5], [4, 6], [3, 6]] }
  ],
  corridors: []
};
const threeEntranceSummary = BP.areaSummary(threeEntranceStudy, "room");
ok("separate entrances to the same neighboring area remain separate derived thresholds",
  threeEntranceSummary.connectionCount === 1 && threeEntranceSummary.thresholdCount === 3);
const renamedArea = BP.renameArea(base, "nave", "Pilgrim's Crossing");
ok("renaming an area changes its authored identity without renaming its physical room",
  renamedArea.discoveryRegions.find((region) => region.id === "nave").label === "Pilgrim's Crossing"
  && renamedArea.spaces.find((space) => space.id === "nave").label === "Processional Nave");
const independentlyRevealed = BP.setAreaSetting(base, "nave", "revealTogether", false);
ok("dress and reveal coupling are independently authored",
  independentlyRevealed.areaSettings.nave.dressTogether === true
  && independentlyRevealed.areaSettings.nave.revealTogether === false);
const splitNave = BP.splitArea(base, "nave");
const annexRegion = splitNave.discoveryRegions.find((region) => region.id.startsWith("nave-annex"));
ok("splitting an area creates a separately named cell-membership region",
  !!annexRegion && BP.areaSummary(splitNave, annexRegion.id).cellCount > 0);
ok("a split area remains a valid connected tactical field",
  BP.validateMap(BP.compile(splitNave, {})).ok && BP.connectivity(BP.compile(splitNave, {})).ok);
const mergedNave = BP.mergeAreas(splitNave, "nave", annexRegion.id);
ok("merging neighboring areas restores one membership region and preserves connectivity",
  !mergedNave.discoveryRegions.some((region) => region.id === annexRegion.id)
  && BP.connectivity(BP.compile(mergedNave, {})).ok);
ok("fixture source remains mutation-isolated", BP.FIXTURES.processional.spaces.find((space) => space.discoveryRegion === "nave").elevationFt === 0);
const spawnWall = BP.compile(base, BP.editCell({}, 4, 10, "wall", 0));
ok("compiler audit rejects architecture placed under a creature", !BP.validateMap(spawnWall).ok);

const calibration = BP.normalizeGridCalibration({ cellPx: 28, originX: -1, originY: 29, nativeW: 784, nativeH: 560 });
ok("grid calibration uses the Combat native-image cell and origin contract",
  calibration.cellPx === 28 && calibration.originX === 27 && calibration.originY === 1);
ok("grid calibration derives the visible square count",
  calibration.cols === 27 && calibration.rows === 20);

let history = BP.historyStart({ edits: {}, grid: true });
history = BP.historyCommit(history, "Wall placed", { edits: { "10,10": { kind: "wall" } }, grid: true });
history = BP.historyCommit(history, "Grid hidden", { edits: { "10,10": { kind: "wall" } }, grid: false });
ok("authoring history records complete transactions", history.past.length === 2 && history.present.label === "Grid hidden");
history = BP.historyUndo(history);
ok("undo restores the prior complete authoring snapshot",
  history.present.label === "Wall placed" && history.present.snapshot.grid === true && history.future.length === 1);
history = BP.historyRedo(history);
ok("redo restores the transaction that undo moved aside",
  history.present.label === "Grid hidden" && history.present.snapshot.grid === false);
history = BP.historyUndo(history);
history = BP.historyCommit(history, "Door placed", { edits: { "10,10": { kind: "door" } }, grid: true });
ok("a new authoring transaction clears the redo branch", history.future.length === 0 && history.present.label === "Door placed");

const formationMap = BP.compile(base, {});
const lineFormation = BP.formationPositions(formationMap, { c: 12, r: 10 }, 3, 0, "line");
const wedgeFormation = BP.formationPositions(formationMap, { c: 12, r: 10 }, 3, 0, "wedge");
ok("group flags resolve legal formation cells",
  lineFormation.length === 3 && lineFormation.every((at) => !formationMap.wall[BP.idx(formationMap.cols, at.c, at.r)]));
ok("formation choice changes placement without moving the flag",
  JSON.stringify(lineFormation) !== JSON.stringify(wedgeFormation));

console.log("\n" + passed + " Blueprint/Diorama checks passed");
