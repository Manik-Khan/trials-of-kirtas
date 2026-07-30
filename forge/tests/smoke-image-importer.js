const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Importer = require("../../_edits/mock-forge-image-importer-core.js");
const BP = require("../../_edits/mock-forge-blueprint-diorama-core.js");

const html = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-importer.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-importer.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-image-importer.js"), "utf8");
let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}
function rgba(width, height, color) {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = color[0];
    out[i * 4 + 1] = color[1];
    out[i * 4 + 2] = color[2];
    out[i * 4 + 3] = 255;
  }
  return out;
}
function fill(data, width, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4;
    data[i] = color[0]; data[i + 1] = color[1]; data[i + 2] = color[2]; data[i + 3] = 255;
  }
}

ok("the proof accepts real local JPEG, PNG, and WebP files",
  /id="imageFile" type="file"/.test(html) && /image\/jpeg,image\/png,image\/webp/.test(html));
ok("the proof does not embed either licensed field-test filename",
  !/G_CityMarketplace|GL_AncientBattlefield/.test(html + css + js));
ok("the proof explicitly keeps analysis local",
  /stays on this device/.test(html) && /not a network service/.test(html));
ok("gridded, ungridded, and automatic scale paths are visible",
  ["auto", "gridded", "ungridded"].every((mode) => html.includes(`data-grid-mode="${mode}"`)));
ok("gridded artwork exposes the Combat-style one-square drag calibration",
  /id="drawGridCell"/.test(html) && /Drag exactly from one printed grid corner/.test(html)
  && /gridFromDrawnBox/.test(js));
ok("Source, Materials, Walkability, and Confidence are separate evidence layers",
  ["source", "materials", "walkability", "confidence"].every((layer) => html.includes(`data-layer="${layer}"`)));
ok("review includes material repaint and walkability correction",
  /id="materialBrushes"/.test(html)
  && /data-walkable="true"/.test(html)
  && /data-walkable="false"/.test(html));
ok("the proof uses the current cache stamps",
  html.includes("mock-forge-image-importer.css?v=ii3")
  && html.includes("mock-forge-image-importer-core.js?v=ii3")
  && html.includes("mock-forge-image-importer.js?v=ii3")
  && html.includes("mock-forge-blueprint-diorama-core.js?v=bp18"));

const gridImage = rgba(240, 300, [91, 116, 52]);
for (let x = 7; x < 240; x += 24) fill(gridImage, 240, x, 0, x + 2, 300, [230, 225, 205]);
for (let y = 11; y < 300; y += 24) fill(gridImage, 240, 0, y, 240, y + 2, [230, 225, 205]);
const detected = Importer.detectGrid(gridImage, 240, 300);
ok("repeated line evidence detects a synthetic square grid", detected.found);
ok("grid period is recovered within one analysis pixel", Math.abs(detected.cellPx - 24) <= 1);
ok("detected grid reports dimensions and confidence",
  detected.cols > 7 && detected.rows > 9 && detected.confidence > 0.5);

const drawn = Importer.gridFromDrawnBox(3220, 5040, 140, 210, 70, 140, 1);
ok("one drawn artwork square derives scale and phase in source pixels",
  drawn.cellPx === 70 && drawn.originX === 0 && drawn.originY === 0
  && drawn.cols === 46 && drawn.rows === 72);
ok("manual calibration is direction-independent and explicitly sourced",
  drawn.evidence.manualCell && drawn.evidence.span === 1
  && Importer.gridFromDrawnBox(3220, 5040, 70, 140, 140, 210, 1).cellPx === drawn.cellPx);
const impreciseDrawn = Importer.gridFromDrawnBox(3220, 5040, 70, 1399.9, 140.05, 1469.85, 1);
ok("near-boundary drag precision normalizes to a legible zero phase",
  impreciseDrawn.originX === 0 && impreciseDrawn.originY === 0);
ok("a click or tiny drag cannot replace the current grid",
  Importer.gridFromDrawnBox(3220, 5040, 70, 140, 72, 142, 1) === null);
const manualAnalysis = Importer.analyze(rgba(80, 80, [112, 143, 62]), 80, 80,
  Importer.gridFromDrawnBox(80, 80, 0, 0, 20, 20, 1));
ok("manual calibration remains explicit after pixel interpretation",
  manualAnalysis.grid.manuallyCalibrated && !manualAnalysis.grid.detected
  && manualAnalysis.grid.evidence.manualCell);
ok("manual grid provenance is visible in the review UI and Blueprint finding",
  /DM-drawn source square/.test(js)
  && /Grid calibrated from one DM-drawn source square/.test(
    Importer.toBlueprint(manualAnalysis).source.review.find((finding) => finding.id === "grid").label
  ));

const ungridded = Importer.gridFromColumns(350, 630, 35);
ok("ungridded scale preserves the chosen map width", ungridded.cols === 35);
ok("ungridded scale preserves image aspect as square cells",
  ungridded.rows === 63 && ungridded.cellPx === 10);

ok("blue-dominant pixels propose water",
  Importer.classifyMaterial({ h: 195, s: 0.7, v: 0.7, r: 35, g: 120, b: 160, luminance: 0.45, edge: 0.03 }).material === "water");
ok("green-dominant pixels propose vegetation",
  Importer.classifyMaterial({ h: 95, s: 0.55, v: 0.65, r: 70, g: 150, b: 55, luminance: 0.5, edge: 0.03 }).material === "vegetation");
ok("warm brown pixels propose timber",
  Importer.classifyMaterial({ h: 28, s: 0.62, v: 0.62, r: 155, g: 95, b: 50, luminance: 0.42, edge: 0.04 }).material === "timber");
ok("desaturated pixels propose stone",
  Importer.classifyMaterial({ h: 0, s: 0.05, v: 0.58, r: 145, g: 143, b: 140, luminance: 0.56, edge: 0.05 }).material === "stone");
ok("bright low-saturation pixels propose snow",
  Importer.classifyMaterial({ h: 190, s: 0.06, v: 0.92, r: 228, g: 232, b: 235, luminance: 0.91, edge: 0.02 }).material === "snow");

const terrain = rgba(80, 80, [112, 143, 62]);
fill(terrain, 80, 40, 0, 80, 40, [40, 115, 150]);
fill(terrain, 80, 0, 40, 40, 80, [150, 92, 46]);
fill(terrain, 80, 40, 40, 80, 80, [140, 138, 134]);
const analysis = Importer.analyze(terrain, 80, 80, {
  found: false, cellPx: 20, originX: 0, originY: 0,
  cols: 4, rows: 4, confidence: 1, evidence: { known: true }
});
ok("real analyzer emits one record per calibrated square", analysis.cells.length === 16);
ok("analyzer separates multiple material families",
  Object.keys(analysis.summary.materials).length >= 4);
ok("water proposals are blocked pending DM correction",
  analysis.cells.filter((cell) => cell.material === "water").every((cell) => !cell.walkable));
ok("analysis reports scene, confidence, open, and blocked evidence",
  !!analysis.summary.scene
  && analysis.summary.meanConfidence > 0
  && analysis.summary.walkable > 0
  && analysis.summary.blocked > 0);

const corrected = Importer.paintCell(analysis, 2, 0, { material: "stone", walkable: true });
const correctedCell = corrected.cells[2];
ok("DM material correction changes the actual analysis cell",
  correctedCell.material === "stone" && correctedCell.corrected);
ok("DM walkability correction changes the actual analysis cell",
  correctedCell.walkable && correctedCell.featureConfidence === 1);
ok("correction count is derived from edited cells", corrected.summary.corrected === 1);

const rectangles = Importer.rectanglesFor(corrected);
ok("walkable classified cells compact into Blueprint rectangles",
  rectangles.length > 0 && rectangles.length < corrected.summary.walkable);
const components = Importer.connectedComponents(corrected);
ok("playable-component evidence comes from the corrected field",
  components.length > 0 && components.reduce((sum, component) => sum + component.length, 0) === corrected.summary.walkable);

const blueprint = Importer.toBlueprint(corrected, {
  id: "interpreted-known-answer",
  name: "Known Answer",
  sourceName: "local-test.png",
  sourceRights: "Local test fixture"
});
ok("interpretation compiles to the approved Blueprint schema",
  blueprint.schema === BP.SCHEMA && blueprint.version === 1);
ok("source receipt identifies a local pixel interpretation",
  blueprint.source.kind === "imported"
  && blueprint.source.interpretation.engine === "local-pixel-proof/v1");
ok("Blueprint carries material, walkability, grid, and connectivity findings",
  ["grid", "materials", "walkability", "connectivity"].every((id) =>
    blueprint.source.review.some((finding) => finding.id === id)));
ok("Blueprint contains no source image bytes", !JSON.stringify(blueprint).includes("data:image"));
ok("blocked terrain remains explicit interpretation data",
  blueprint.source.interpretation.blockedCells.length === corrected.summary.blocked);
const field = BP.compile(blueprint, {});
ok("interpreted Blueprint compiles to the real tactical field shape",
  field.cols === 4 && field.rows === 4 && field.wall.length === 16);
ok("interpreted Blueprint passes structural validation", BP.validateMap(field).ok);
ok("blocked interpreted terrain retains a visible material region",
  blueprint.spaces.some((space) => space.material === "water")
  && blueprint.source.interpretation.blockedCells.some(([c, r]) => field.wall[BP.idx(field.cols, c, r)]));
const handoff = BP.createHandoff(blueprint, { armed: false, tool: "select" });
const decoded = BP.decodeHandoff(BP.encodeHandoff(handoff));
ok("exact interpreted Blueprint survives the real handoff",
  decoded.ok
  && decoded.handoff.blueprintId === blueprint.id
  && decoded.handoff.fingerprint === BP.fingerprint(blueprint));
ok("browser code stores only a downsampled private underlay receipt",
  /sessionStorage\.setItem\(key, dataUrl\)/.test(js)
  && /toDataURL\("image\/jpeg", 0\.78\)/.test(js));
ok("Build navigation uses the verified encoded handoff",
  /BP\.createHandoff\(blueprint/.test(js)
  && /BP\.encodeHandoff\(handoff\)/.test(js));

console.log(`\n${passed} local artwork-import checks passed`);
