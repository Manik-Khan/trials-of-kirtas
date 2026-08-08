const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Structure = require("../forge-image-structure-review.js");

const html = fs.readFileSync(path.join(__dirname, "../import.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../import.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../import.js"), "utf8");
let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}
function cell(c, r, material, feature, edge, variance, luminance) {
  return {
    c, r, material, feature,
    materialConfidence: 0.72,
    featureConfidence: 0.68,
    walkable: feature !== "water",
    corrected: false,
    evidence: { edge, variance, luminance, h: 0, s: 0.3, v: 0.5, r: 80, g: 90, b: 100 }
  };
}
function analysisFixture() {
  const cols = 8, rows = 6;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    cells.push(cell(c, r, "earth", "open terrain", 0.02, 0.002, 0.58));
  }
  [[1, 1], [2, 1], [1, 2], [2, 2]].forEach(([c, r]) => {
    cells[r * cols + c] = cell(c, r, "water", "water", 0.08, 0.011, 0.3);
  });
  [[5, 1], [6, 1], [5, 2], [6, 2]].forEach(([c, r]) => {
    cells[r * cols + c] = cell(c, r, "water", "water", 0.015, 0.002, 0.48);
  });
  [[3, 4], [4, 4], [3, 5], [4, 5]].forEach(([c, r]) => {
    cells[r * cols + c] = cell(c, r, "vegetation", "tree canopy", 0.06, 0.015, 0.28);
  });
  return {
    grid: {
      found: true, detected: false, manuallyCalibrated: true,
      cellPx: 20, originX: 0, originY: 0, cols, rows,
      confidence: 1, evidence: { manualCell: true }
    },
    cells,
    summary: {
      scene: "Built settlement / plaza",
      materials: { earth: 36, water: 8, vegetation: 4 }
    }
  };
}

ok("the proof accepts a real local artwork file",
  /id="imageFile" type="file"/.test(html) && /image\/jpeg,image\/png,image\/webp/.test(html));
ok("the proof keeps the source local and labels its draft authority",
  /source stays in this browser/.test(html)
  && /forge-structure-review\/v1/.test(html)
  && /Draft annotation/.test(html));
ok("the proof does not embed either licensed field-test filename",
  !/G_CityMarketplace|GL_AncientBattlefield/.test(html + css + js));
ok("Auto, one-square drawing, and ungridded calibration are all present",
  ["autoGrid", "drawGridCell", "noGrid", "targetColumns"].every((id) => html.includes(`id="${id}"`)));
ok("automatic analysis is honestly limited to broad-area discovery",
  /Find broad areas/.test(html) && !/Propose structure regions/.test(html));
ok("Pointer, grid Brush, Lasso, Eraser, and Pan are one compact artwork toolbar",
  ["pointer", "brush", "lasso", "eraser", "pan"].every((type) => html.includes(`data-draw-tool="${type}"`)));
ok("each completed Brush or Lasso gesture saves one structure without a separate save step",
  /Brush draws straight grid rectangles/.test(html)
  && !/id="commitSelection"/.test(html)
  && /function finishGridBrush/.test(js) && /function finishLasso/.test(js)
  && /Structure\.authorSelection/.test(js));
ok("right-click exposes map tools before tool-specific choices",
  /id="typePaletteTools"/.test(html)
  && ["pointer", "brush", "lasso", "eraser", "pan", "zoom"]
    .every((type) => html.includes(`data-palette-tool="${type}"`))
  && /id="drawPalette"/.test(html) && /id="eraserPalette"/.test(html));
ok("right-click cannot execute the active left-button drawing or zoom tool",
  /addEventListener\("pointerup", function \(event\) \{\s*if \(event\.button !== 0\) return;/.test(js));
ok("right-click type and variant choice arms Brush or Lasso",
  /id="typePalette"/.test(html) && /id="typePaletteKinds"/.test(html)
  && /id="typePaletteVariants"/.test(html) && /contextmenu/.test(js));
ok("height is part of the armed drawing instead of a large property form",
  ["drawHeightDown", "drawHeightValue", "drawHeightUp"]
    .every((id) => html.includes(`id="${id}"`))
  && ["regionBase", "regionTop", "regionSupport", "regionWalkable", "regionAccess", "applyRegion"]
    .every((id) => !html.includes(`id="${id}"`)));
ok("armed meaning, appearance, and height remain visible before drawing",
  /id="pendingSwatch"/.test(html) && /id="pendingMeaning"/.test(html)
  && /id="armedKit"/.test(html) && /id="drawHeightValue"/.test(html) && /right-click/.test(html));
ok("the primary workflow omits Color assist and Magic selection controls",
  !/id="colorAssist"/.test(html) && !/id="magicTolerance"/.test(html)
  && !/data-draw-tool="magic"/.test(html));
ok("right-click can set the next lasso height without leaving the artwork",
  ["paletteHeightDown", "paletteHeightValue", "paletteHeightUp"]
    .every((id) => html.includes(`id="${id}"`)));
ok("the lasso and saved artwork labels show their authored height",
  /var marker = state\.drawHeightFt \+ " ft"/.test(js)
  && /Structure\.TYPES\[region\.type\]\.label \+ " · " \+ region\.topFt \+ " FT"/.test(js));
ok("grid visibility and zoom controls stay available without changing tools",
  ["toggleGrid", "zoomOut", "zoomFit", "zoomIn", "zoomValue"].every((id) => html.includes(`id="${id}"`)));
ok("calibration hides the generated overlay and offers a distant verification point",
  /id="verifyGrid"/.test(html) && /state\.gridVisible = false/.test(js)
  && /finishGridVerification/.test(js));
ok("the live preview is code-native and carries the honest boundary",
  /id="previewCanvas"/.test(html)
  && /Renderer study only/.test(html)
  && !/three(?:\.min)?\.js/i.test(html + js));
ok("all structure-review assets carry current cache stamps",
  html.includes("import.css?v=fi1")
  && html.includes("forge-image-structure-review.js?v=fis1")
  && html.includes("import.js?v=fi1")
  && html.includes("forge-image-importer.js?v=fii1")
  && html.includes("forge-image-blueprint.js?v=fib1"));
ok("reviewed structures retain a local pixel palette and can enter Forge Combat",
  typeof Structure.paletteForCells === "function"
  && /id="openCombatProof"/.test(html)
  && /Blueprint\.createHandoff/.test(js)
  && /ImageBlueprint\.reviewToBlueprint/.test(js)
  && /palette: Structure\.paletteForCells/.test(js));
ok("the preview joins region cells and explains elevation instead of drawing per-cell tent spikes",
  /function joinedPrism/.test(js) && /function heightRuler/.test(js) && /function heightLabel/.test(js)
  && !/var base = project\(cell\[0\].*peak = project/.test(js));
ok("automatic broad-area hints do not rise as unreviewed 3D structures",
  /state\.review\.regions\.filter\(function \(region\) \{\s*return region\.source === "dm-authored"/.test(js));
ok("Height Preview supports direct per-structure five-foot changes",
  ["heightPopover", "previewHeightDown", "previewHeightValue", "previewHeightUp"]
    .every((id) => html.includes(`id="${id}"`))
  && /function previewRegionAt/.test(js) && /function adjustSelectedHeight/.test(js)
  && /ui\.previewCanvas\.addEventListener\("click"/.test(js));
ok("the grid eraser offers one-, three-, and five-cell square stamps",
  [1, 3, 5].every((size) => html.includes(`data-eraser-size="${size}"`))
  && /function eraserStamp/.test(js) && /kind: "grid-eraser"/.test(js)
  && !/\.canvas-stack\.erasing #overlayCanvas \{ cursor: not-allowed/.test(css));
ok("Photoshop-style map hotkeys stay on the artwork",
  /var tools = \{ v: "pointer", b: "brush", l: "lasso", e: "eraser", h: "pan", z: "zoom" \}/.test(js)
  && /event\.key === "Delete" \|\| event\.key === "Backspace"/.test(js)
  && /event\.key === "\[" \|\| event\.key === "\]"/.test(js)
  && /key === "f"/.test(js));

const roofBlue = Structure.semanticCandidate(cell(0, 0, "water", "water", 0.08, 0.012, 0.3));
const openWater = Structure.semanticCandidate(cell(0, 0, "water", "water", 0.015, 0.002, 0.48));
ok("blue with roof-like edge and texture evidence proposes a building, not automatic water",
  roofBlue.type === "building");
ok("quiet blue regions can still propose actual water", openWater.type === "water");
ok("dense structure evidence proposes a building regardless of palette",
  Structure.semanticCandidate(cell(0, 0, "stone", "dense structure", 0.12, 0.02, 0.3)).type === "building");
ok("tree-canopy evidence remains semantically distinct",
  Structure.semanticCandidate(cell(0, 0, "vegetation", "tree canopy", 0.07, 0.02, 0.25)).type === "tree");

const proposed = Structure.proposeRegions(analysisFixture(), { minimumCells: 2 });
ok("local evidence compiles to the draft review schema",
  proposed.schema === "forge-structure-review/v1" && proposed.version === 1);
ok("local proposals are grouped into connected semantic regions",
  proposed.regions.some((region) => region.type === "building" && region.cells.length === 4)
  && proposed.regions.some((region) => region.type === "water" && region.cells.length === 4)
  && proposed.regions.some((region) => region.type === "tree" && region.cells.length === 4));
ok("every local proposal retains confidence and provenance",
  proposed.regions.every((region) => region.source === "local-proposal"
    && region.confidence > 0 && region.confidence < 1
    && Structure.APPEARANCES[region.type].some((appearance) => appearance.id === region.appearance)));
const localPalette = Structure.paletteForCells(analysisFixture(), [[1, 1], [2, 1], [1, 2], [2, 2]]);
ok("a selected footprint derives its appearance palette from its own source cells",
  localPalette && /^#[0-9a-f]{6}$/.test(localPalette.primary)
  && localPalette.source === "local-pixels" && localPalette.samples === 4);

const polygonGrid = { cellPx: 10, originX: 0, originY: 0, cols: 4, rows: 4 };
const polygonCells = Structure.cellsFromPolygon(polygonGrid,
  [[9, 9], [31, 9], [31, 31], [9, 31]], 0.18);
ok("a freehand image-space polygon derives tactical grid coverage afterward",
  polygonCells.length === 4
  && polygonCells.some(([c, r]) => c === 1 && r === 1)
  && polygonCells.some(([c, r]) => c === 2 && r === 2));

const coveredGrid = Structure.gridCoveringArtwork(105, 83, 20, 5, 3, { manualCell: true });
ok("a calibrated grid projects through every artwork edge including partial cells",
  coveredGrid.originX === -15 && coveredGrid.originY === -17
  && coveredGrid.cols === 6 && coveredGrid.rows === 5
  && coveredGrid.originX + coveredGrid.cols * coveredGrid.cellPx >= 105
  && coveredGrid.originY + coveredGrid.rows * coveredGrid.cellPx >= 83);
const farCheckedGrid = Structure.refineGridFromPoint(220, 180, coveredGrid, { x: 5, y: 3 }, { x: 205, y: 163 });
ok("a distant printed intersection corrects accumulated cell-size drift",
  farCheckedGrid && Math.abs(farCheckedGrid.cellPx - 20) < 0.001
  && farCheckedGrid.evidence.farPointChecked
  && farCheckedGrid.evidence.gridSteps[0] === 10
  && farCheckedGrid.evidence.gridSteps[1] === 8);

const magicPixels = new Uint8ClampedArray(4 * 3 * 4);
for (let i = 0; i < 12; i++) {
  magicPixels[i * 4] = 12; magicPixels[i * 4 + 1] = 15; magicPixels[i * 4 + 2] = 18; magicPixels[i * 4 + 3] = 255;
}
[[0, 0], [1, 0], [0, 1], [1, 1], [3, 2]].forEach(([x, y]) => {
  const offset = (y * 4 + x) * 4;
  magicPixels[offset] = 210; magicPixels[offset + 1] = 52; magicPixels[offset + 2] = 48;
});
const magic = Structure.magicMask(magicPixels, 4, 3, 0, 0, 8);
ok("Magic selection follows only the connected local color island",
  Array.from(magic).filter(Boolean).length === 4 && magic[11] === 0);
ok("Magic selection converts its image mask into covered rule cells",
  Structure.cellsFromMask({ cellPx: 1, originX: 0, originY: 0, cols: 4, rows: 3 }, magic, 4, 3, 0.5).length === 4);
const magicFence = new Uint8Array(12);
magicFence[0] = 1; magicFence[1] = 1;
const boundedMagic = Structure.magicMask(magicPixels, 4, 3, 0, 0, 100, { allowedMask: magicFence });
ok("Color assist cannot cross its supplied lasso boundary even at maximum tolerance",
  Array.from(boundedMagic).filter(Boolean).length === 2 && boundedMagic[4] === 0 && boundedMagic[11] === 0);
ok("a lasso cell boundary can be rasterized as a local Magic fence",
  Array.from(Structure.maskFromCells({ cellPx: 2, originX: 0, originY: 0 }, [[0, 0]], 4, 3)).filter(Boolean).length === 4);

const selectionA = Structure.selectionFromCells([[0, 0], [1, 0]], { kind: "polygon", points: [[0, 0], [2, 0], [2, 1]] });
const selectionB = Structure.selectionFromCells([[1, 0], [2, 0]], { kind: "magic", seed: [2, 0] });
const addedSelection = Structure.combineSelection(selectionA, selectionB, "add");
const subtractedSelection = Structure.combineSelection(addedSelection, selectionB, "subtract");
ok("selection Add unions coverage while Subtract removes only the refined area",
  addedSelection.cells.length === 3 && subtractedSelection.cells.length === 1
  && subtractedSelection.footprint.kind === "composite");

const broadWaterCells = [];
for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) {
  const inBasin = c >= 3 && c <= 8 && r >= 3 && r <= 8;
  const basinEdge = inBasin && (c === 3 || c === 8 || r === 3 || r === 8);
  broadWaterCells.push(inBasin
    ? cell(c, r, "water", "water", basinEdge ? 0.09 : 0.015, basinEdge ? 0.012 : 0.002, 0.34)
    : cell(c, r, "earth", "open terrain", 0.02, 0.002, 0.58));
}
const broadWater = Structure.proposeRegions({
  grid: { found: false, cellPx: 20, originX: 0, originY: 0, cols: 12, rows: 12, confidence: 1 },
  cells: broadWaterCells,
  summary: { scene: "Wetland", materials: { water: 36, earth: 108 } }
}, { minimumCells: 2 });
ok("a broad connected blue basin remains water even when its shoreline has roof-like edges",
  broadWater.regions.length === 1
  && broadWater.regions[0].type === "water"
  && broadWater.regions[0].cells.length === 36);

const paintedBuilding = Structure.paintRect(proposed, { c: 5, r: 3 }, { c: 7, r: 4 }, "building");
ok("the DM can draw a new building rectangle",
  paintedBuilding.regionId
  && paintedBuilding.review.regions.find((region) => region.id === paintedBuilding.regionId).cells.length === 6);
let reviewed = Structure.updateRegion(paintedBuilding.review, paintedBuilding.regionId, {
  label: "Raised guildhall",
  baseFt: 0,
  topFt: 20,
  roofWalkable: true,
  access: "climb"
});
const guildhall = reviewed.regions.find((region) => region.id === paintedBuilding.regionId);
ok("building height, roof walkability, and access are explicit authored facts",
  guildhall.label === "Raised guildhall"
  && guildhall.topFt === 20
  && guildhall.roofWalkable
  && guildhall.access === "climb"
  && guildhall.supportMode === "solid"
  && guildhall.appearance === "timber-house"
  && guildhall.source === "dm-authored");

reviewed = Structure.updateRegion(reviewed, guildhall.id, { appearance: "masonry-house" });
const styledGuildhall = reviewed.regions.find((region) => region.id === guildhall.id);
ok("a building kit is an explicit editable fact rather than only an overlay color",
  styledGuildhall.appearance === "masonry-house"
  && Structure.appearanceFor("building", styledGuildhall.appearance).form === "solid");

const reshapedGuildhall = Structure.authorSelection(reviewed,
  Structure.selectionFromCells([[5, 3], [6, 3], [5, 4]], {
    kind: "composite", operations: [{ operation: "subtract", footprint: { kind: "polygon" } }]
  }), "building", { replaceRegionId: guildhall.id });
const editedGuildhall = reshapedGuildhall.review.regions.find((region) => region.id === guildhall.id);
ok("editing an existing footprint preserves its identity, height, support, and authored label",
  editedGuildhall
  && editedGuildhall.cells.length === 3
  && editedGuildhall.label === "Raised guildhall"
  && editedGuildhall.topFt === 20
  && editedGuildhall.supportMode === "solid"
  && editedGuildhall.appearance === "masonry-house"
  && reshapedGuildhall.review.regions.filter((region) => region.id === guildhall.id).length === 1);

const joinedA = Structure.authorSelection(proposed,
  Structure.selectionFromCells([[0, 3], [1, 3]], { kind: "polygon", points: [[0, 0], [1, 0], [1, 1]] }), "wall");
const joinedB = Structure.authorSelection(joinedA.review,
  Structure.selectionFromCells([[2, 3], [3, 3]], { kind: "polygon", points: [[1, 0], [2, 0], [2, 1]] }), "wall");
ok("starting another touching structure preserves both saved objects",
  joinedB.review.regions.filter((region) => region.type === "wall" && region.source === "dm-authored").length === 2);
ok("each authored structure preserves its own artwork footprint alongside tactical cells",
  joinedB.review.regions.filter((region) => region.type === "wall" && region.source === "dm-authored")
    .every((region) => region.footprint.kind === "polygon"));

const overlappingBridge = Structure.authorSelection(joinedB.review,
  Structure.selectionFromCells([[0, 3], [1, 3]], { kind: "polygon", points: [[0, 0], [2, 0], [2, 1]] }),
  "bridge", { appearance: "stone-arches" });
ok("a newly saved semantic layer does not erase an overlapping authored structure",
  overlappingBridge.review.regions.some((region) => region.type === "wall" && region.source === "dm-authored"
    && region.cells.some(([c, r]) => c === 0 && r === 3))
  && overlappingBridge.review.regions.some((region) => region.type === "bridge" && region.appearance === "stone-arches"));
const targetedErase = Structure.eraseSelection(overlappingBridge.review,
  Structure.selectionFromCells([[0, 3]], { kind: "polygon", points: [[0, 0], [1, 0], [1, 1]] }),
  overlappingBridge.regionId);
ok("the lasso eraser can trim one selected structure without touching an overlap",
  targetedErase.affected === 1
  && targetedErase.review.regions.some((region) => region.type === "wall"
    && region.cells.some(([c, r]) => c === 0 && r === 3))
  && targetedErase.review.regions.some((region) => region.id === overlappingBridge.regionId
    && !region.cells.some(([c, r]) => c === 0 && r === 3)));
const deletedBridge = Structure.deleteRegion(overlappingBridge.review, overlappingBridge.regionId);
ok("Delete or Backspace can remove one selected authored surface without touching overlaps",
  deletedBridge.deleted
  && !deletedBridge.review.regions.some((region) => region.id === overlappingBridge.regionId)
  && deletedBridge.review.regions.some((region) => region.type === "wall" && region.source === "dm-authored")
  && deletedBridge.review.history.at(-1).kind === "delete-region");

const bridgePaint = Structure.paintRect(reviewed, { c: 0, r: 0 }, { c: 4, r: 0 }, "bridge");
reviewed = Structure.updateRegion(bridgePaint.review, bridgePaint.regionId, {
  label: "Market overpass", baseFt: 0, topFt: 15, roofWalkable: true, access: "stairs", supportMode: "posts"
});
const stairPaint = Structure.paintRect(reviewed, { c: 4, r: 1 }, { c: 4, r: 3 }, "stairs");
reviewed = Structure.updateRegion(stairPaint.review, stairPaint.regionId, {
  label: "South steps", baseFt: 0, topFt: 15, access: "stairs"
});
const compiled = Structure.compileReview(reviewed);
ok("the base ground remains a separate walk surface",
  compiled.surfaces.some((surface) => surface.id === "surface-ground" && surface.walkable));
ok("a walkable building roof compiles above its solid volume",
  compiled.volumes.some((volume) => volume.regionId === guildhall.id && volume.topFt === 20)
  && compiled.surfaces.some((surface) => surface.regionId === guildhall.id
    && surface.kind === "roof" && surface.elevationFt === 20));
ok("a bridge deck retains the underlying ground proposal",
  compiled.surfaces.some((surface) => surface.regionId === bridgePaint.regionId
    && surface.kind === "bridge-deck"
    && surface.supportsUnderpass
    && surface.underpassSurfaceId === "surface-ground"
    && surface.clearanceFt === 15
    && surface.supportMode === "posts"));
const stairs = compiled.connectors.find((connector) => connector.regionId === stairPaint.regionId);
ok("stairs compile as an ascending connector path",
  stairs && stairs.kind === "stairs" && stairs.path.length === 3
  && stairs.path[0].elevationFt === 0 && stairs.path[2].elevationFt === 15);
ok("ordinary climbing consumes twice the movement budget while climb speed does not",
  Structure.climbCost(15, false) === 30 && Structure.climbCost(15, true) === 15);
ok("the reviewed structure receipt validates", Structure.validateReview(reviewed).ok);

const erased = Structure.paintRect(reviewed, { c: 0, r: 0 }, { c: 1, r: 0 }, "ground").review;
ok("painting ground removes structural meaning without deleting the base ground surface",
  !Structure.regionAt(erased, 0, 0)
  && Structure.compileReview(erased).surfaces.some((surface) => surface.id === "surface-ground"));
ok("the browser exposes visible field receipts for real interaction tests",
  ["metricGrid", "metricRegions", "metricSurfaces", "metricConnectors", "surfaceReceipt"]
    .every((id) => html.includes(`id="${id}"`)));

console.log(`\n${passed} image structure-review checks passed`);
