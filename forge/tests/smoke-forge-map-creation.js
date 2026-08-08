const assert = require("assert");
const fs = require("fs");
const path = require("path");

const forgeDir = path.join(__dirname, "..");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const ImageBlueprint = require(path.join(forgeDir, "forge-image-blueprint.js"));
const combatHtml = fs.readFileSync(path.join(forgeDir, "combat.html"), "utf8");
const combatJs = fs.readFileSync(path.join(forgeDir, "combat.js"), "utf8");
const importHtml = fs.readFileSync(path.join(forgeDir, "import.html"), "utf8");
const importJs = fs.readFileSync(path.join(forgeDir, "import.js"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name); passed++; console.log("✓ " + name);
}

const options = { seed: 1847, topology: "auto", size: "medium", density: 6, verticality: "meaningful" };
const candidates = [0, 1, 2].map((candidate) => BP.produceSeeded({ ...options, candidate }));
ok("one generation creates three structurally distinct directions",
  new Set(candidates.map(BP.structuralFingerprint)).size === 3);
ok("every generated direction is a valid connected tactical field",
  candidates.every((blueprint) => {
    const map = BP.compile(blueprint, {});
    return BP.validateMap(map).ok && BP.connectivity(map).ok;
  }));
ok("the same seed and candidate reproduce the exact Blueprint",
  BP.stableStringify(candidates[1]) === BP.stableStringify(BP.produceSeeded({ ...options, candidate: 1 })));
ok("requesting new directions changes the deterministic candidate set",
  BP.structuralFingerprint(BP.produceSeeded({ ...options, seed: options.seed + 1, candidate: 0 })) !== BP.structuralFingerprint(candidates[0]));

function region(id, type, cells, topFt, source = "dm-authored", supportMode = "solid") {
  return {
    id, type, label: id, cells, baseFt: 0, topFt, source, supportMode,
    roofWalkable: ["building", "roof", "bridge", "stairs"].includes(type),
    appearance: type + "-test", palette: { primary: type === "water" ? "#397f91" : "#8c654d", accents: [], source: "local-pixels" }
  };
}
const review = {
  schema: "forge-structure-review/v1", version: 1, scene: "Reviewed market",
  grid: { cols: 12, rows: 10, cellPx: 20, originX: 0, originY: 0 },
  regions: [
    region("automatic", "building", [[0, 0]], 30, "local-proposal"),
    region("hall", "building", [[2, 2], [3, 2], [2, 3], [3, 3]], 20),
    region("canal", "water", [[8, 6], [9, 6]], 0),
    region("bridge", "bridge", [[5, 5], [6, 5], [7, 5]], 15, "dm-authored", "posts"),
    region("steps", "stairs", [[4, 5], [4, 6], [4, 7]], 10),
    region("tree", "tree", [[9, 2]], 20)
  ]
};
const analysis = {
  summary: { scene: "Built settlement / plaza", materials: { earth: 90, stone: 30 } },
  cells: new Array(120).fill(null).map((_, index) => ({
    c: index % 12, r: Math.floor(index / 12), material: index < 30 ? "stone" : "earth",
    evidence: { r: 126, g: 101, b: 72 }
  }))
};
const imported = ImageBlueprint.reviewToBlueprint(review, analysis, {
  sourceName: "market.jpg", underlayKey: "forge-import-artwork:test"
});
const importedAgain = ImageBlueprint.reviewToBlueprint(review, analysis, {
  sourceName: "market.jpg", underlayKey: "forge-import-artwork:test"
});
const importedMap = BP.compile(imported, {});
ok("reviewed artwork becomes the production Blueprint schema", imported.schema === BP.SCHEMA && imported.source.kind === "imported");
ok("identical reviewed artwork produces an identical document identity", imported.id === importedAgain.id && BP.fingerprint(imported) === BP.fingerprint(importedAgain));
ok("automatic hints never become tactical authority",
  !imported.source.structureReview.regions.some((entry) => entry.id === "automatic") && importedMap.wall[0] === false);
ok("confirmed building roofs become raised walkable cells while water remains blocked",
  importedMap.wall[2 * 12 + 2] === false && importedMap.h[2 * 12 + 2] === 20
  && importedMap.wall[6 * 12 + 8] === true);
const stairHeights = [5, 6, 7].map((row) => importedMap.h[row * 12 + 4]).sort((a, b) => a - b);
ok("confirmed bridge and stair heights enter the tactical field",
  importedMap.h[5 * 12 + 6] === 15 && stairHeights.join(",") === "0,5,10");
ok("reviewed semantic regions and local palette survive for the renderer",
  importedMap.meta.structureReview.regions.length === 5
  && imported.source.interpretation.palette[0] === "#7e6548");
ok("the private artwork underlay stays a browser-storage reference",
  imported.source.underlayKey === "forge-import-artwork:test" && imported.source.underlayStorage === "session");
const handoff = BP.createHandoff(imported, { armed: false, tool: "select" });
const received = BP.decodeHandoff(BP.encodeHandoff(handoff));
ok("the exact imported Blueprint survives the normal Forge handoff",
  received.ok && received.handoff.fingerprint === BP.fingerprint(imported)
  && BP.stableStringify(received.handoff.blueprint) === BP.stableStringify(imported));

ok("production map creation visibly offers Generate Templates Import and Blank",
  ["generate", "template", "import", "blank"].every((method) => combatHtml.includes(`data-creation-method="${method}"`)));
ok("the current map is staged before import and restored on cancel",
  combatJs.includes("storeCurrentMapForImport") && importHtml.includes('id="cancelImport"')
  && importJs.includes("function returnKey()") && importJs.includes('window.location.href = key ? "combat.html#import="'));
ok("the production importer loads only production-owned authorities",
  ["forge-image-importer.js?v=fii1", "forge-image-structure-review.js?v=fis1", "forge-image-blueprint.js?v=fib1", "import.js?v=fi1"]
    .every((asset) => importHtml.includes(asset)) && !importHtml.includes("_edits/") && !importHtml.includes("mock-forge"));
ok("confirmed import creates the normal Blueprint handoff rather than a parallel map format",
  importJs.includes("ImageBlueprint.reviewToBlueprint") && importJs.includes("Blueprint.createHandoff")
  && importJs.includes('window.location.href = "combat.html#import="'));
ok("the modular renderer consumes confirmed image structures without changing ordinary maps",
  combatJs.includes("function importedStructureMeshes")
  && combatJs.includes("if (!review?.regions) return")
  && combatJs.includes("state.blueprint.source?.structureReview ? [] : boundaryEdges"));

console.log(`\n${passed} Forge map-creation checks passed`);
