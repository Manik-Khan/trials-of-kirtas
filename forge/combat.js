import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BP = window.ForgeBlueprint;
if (!BP) throw new Error("Forge Blueprint authority did not load");
const LocalCombat = window.ForgeCombatLocal;
const PartySelection = window.ForgePartySelection;
if (!LocalCombat || !PartySelection) throw new Error("Forge Combat authorities did not load");

const QUALITY = Object.freeze({
  basic: { pixelRatio: 1, shadows: false, shadowSize: 512, label: "Basic" },
  balanced: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, label: "Balanced" },
  cinematic: { pixelRatio: 1.75, shadows: true, shadowSize: 2048, label: "Cinematic" }
});
const PALETTE = Object.freeze({
  nave: 0xb8ae98, cloister: 0x7e8a70, crypt: 0x7a858a, timber: 0x846b4f, water: 0x557d83,
  unknown: 0x777a76, grout: 0x353c39, wall: 0x827c70, wallTop: 0xb7ad96, wood: 0x624b35,
  metal: 0x555e5c, gold: 0xc6a45f, pc: 0x78a9a3, foe: 0xb45b4d, fire: 0xffa34b
});
const ui = {};
[
  "threeStage", "artworkStage", "scrawlStage", "fatal", "mapName", "topologyLabel", "discoveryLabel",
  "connectivityStatus", "idleStatus", "chunkStatus", "contractStatus",
  "revealNext", "resetDiscovery", "focusHero", "rotationLabel", "rotationValue", "rotateLeft", "rotateRight",
  "zoneRegion", "zoneElevation", "zoneMaterial", "applyZone", "areaStageLabel", "areaBoundaryStatus",
  "toggleAreaHighlight", "areaName", "renameArea", "areaProvenance", "areaFootprint",
  "areaDressTogether", "areaRevealTogether", "areaConnectionSummary", "areaConnections",
  "areaBoundaryNote", "areaMergeTarget", "splitArea", "mergeArea",
  "metricCalls", "metricTriangles", "metricTextures", "metricFrame", "metricChunks", "metricCells",
  "workflowStatus", "seedInput", "seedTopology", "createSeeded", "analyzeSample", "createBlank",
  "openMapCreation", "mapCreationDialog", "closeMapCreation", "creationBrief", "creationSeed",
  "creationTopology", "creationSize", "creationDensity", "creationVerticality", "createDirections", "newDirections",
  "creationCandidateDeck", "openImageImport", "creationBlankSize", "stageBlankMap",
  "creationSelection", "creationSelectionDetail", "confirmMapChoice",
  "sourceReceipt", "sourceReceiptDetail", "reviewFindings", "toggleUnderlay", "acceptAllFindings",
  "pinnedReveal", "pinnedBuild", "pinnedUndo", "pinnedRedo", "browseMode", "buildMode", "buildModeInline", "modeNarration",
  "undoAction", "redoAction", "compareHold", "gridToggle", "gridCellPx", "gridOriginX", "gridOriginY",
  "applyGrid", "gridStatus", "deploymentGroups", "flagMessage", "spawnStatus",
  "combatRosterStatus", "combatRoster", "prepareLocalCombat", "combatFightGate",
  "combatFightStatus", "combatFightInstruction", "combatTurn", "combatCombatants",
  "combatAttack", "combatEndTurn", "combatFightLog",
  "buildHandles", "directBuildStatus", "directBuildMode", "layoutToolGuidance", "massBuildCallout",
  "buildBrushRail", "brushTitle", "brushContextHint", "brushExitBuild", "brushUndo", "brushRedo",
  "buildRadial", "radialUndo", "radialRedo", "radialToolLabel",
  "directRotateLeft", "directRotateRight", "directRotationValue", "clearLayoutSelection",
  "layoutSelectionTitle", "layoutSelectionDetail", "selectionActionNote", "divideVertical",
  "divideHorizontal", "connectSelected", "removeSelectedPassage", "removeSelectedArchitecture", "directGridStatus", "openLegacyGrid",
  "appearanceSelectionTitle", "selectedElevation", "selectedMaterial", "applySelectedAppearance",
  "objectToolGuidance", "revealSelectionTitle", "revealSelectionDetail", "groupRevealSelected"
].forEach((id) => { ui[id] = document.getElementById(id); });

const state = {
  fixtureKey: "processional",
  blueprint: BP.withSource(BP.FIXTURES.processional, "fixture", { fixtureKey: "processional" }),
  map: null,
  edits: {},
  discovered: new Set(["gate"]),
  view: "board",
  mode: "browse",
  quality: "balanced",
  tool: "wall",
  rotation: 0,
  selected: null,
  workflow: "map",
  mapTab: "layout",
  layoutTool: "select",
  layoutSpaces: [],
  layoutPassage: null,
  objectKind: "pew",
  buildAnchor: null,
  linePreview: [],
  roomPreview: null,
  sourceUnderlay: false,
  areaFocus: "gate",
  areaHighlight: false,
  gridVisible: true,
  calibration: BP.normalizeGridCalibration({ cellPx: 28, originX: 0, originY: 0, nativeW: 784, nativeH: 560 }),
  groups: [
    { id: "party-main", label: "Main Party", role: "party", formation: "wedge", unitIds: ["Vesperian", "Caim"], anchor: { c: 4, r: 10 }, seed: 3 },
    { id: "enemy-main", label: "Reliquary Guard", role: "enemy", formation: "cluster", unitIds: ["Abbey Wight"], anchor: { c: 22, r: 11 }, seed: 7 }
  ],
  rosterCandidates: [],
  selectedPartyKeys: [],
  fight: null,
  fightTarget: null,
  flagPlacement: null,
  history: null,
  compareActive: false,
  themeBase: BP.withSource(BP.FIXTURES.processional, "fixture", { fixtureKey: "processional" }),
  chunks: new Map(),
  scrawlTransform: null,
  artworkTransform: null,
  renderPending: false,
  renderUntil: 0,
  lastFrameMs: 0,
  lastActivity: performance.now(),
  handoff: null
};
let importedUnderlayImage = null;
const creation = {
  method: "generate",
  candidates: [],
  draft: null,
  draftKind: null,
  draftLabel: "",
  draftDetail: ""
};

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function runtimeSpawns() {
  return state.fight ? LocalCombat.spawns(state.fight) : (state.blueprint.spawns || []);
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101716);
scene.fog = new THREE.FogExp2(0x101716, 0.025);
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 180);
camera.position.set(18, 22, 23);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = true;
renderer.domElement.setAttribute("aria-label", "Ruined Abbey diorama");
ui.threeStage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.enablePan = true;
controls.minDistance = 11;
controls.maxDistance = 54;
controls.maxPolarAngle = Math.PI * 0.47;
controls.target.set(0, 0, 0);
controls.addEventListener("change", () => {
  state.lastActivity = performance.now();
  updateCutaway();
  positionBuildHandles();
  requestRender(80);
});

const hemi = new THREE.HemisphereLight(0xaebcb6, 0x25231f, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b4, 2.4);
sun.position.set(-12, 24, 16);
sun.castShadow = true;
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0007;
scene.add(sun);
scene.add(sun.target);

const boardRoot = new THREE.Group();
const lightRoot = new THREE.Group();
const selectionRoot = new THREE.Group();
const gridRoot = new THREE.Group();
const flagRoot = new THREE.Group();
const areaRoot = new THREE.Group();
scene.add(boardRoot, lightRoot, gridRoot, flagRoot, areaRoot, selectionRoot);

const ambientPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 64),
  new THREE.MeshStandardMaterial({ color: 0x111817, roughness: 1, metalness: 0 })
);
ambientPlane.rotation.x = -Math.PI / 2;
ambientPlane.position.y = -0.12;
ambientPlane.receiveShadow = true;
scene.add(ambientPlane);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    map: options.map || null,
    roughness: options.roughness == null ? 0.86 : options.roughness,
    metalness: options.metalness || 0,
    transparent: !!options.transparent,
    opacity: options.opacity == null ? 1 : options.opacity,
    depthWrite: options.depthWrite !== false,
    side: options.side || THREE.FrontSide
  });
}
function makeAbbeyAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#b9b2a3";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const offset = (y / 32) % 2 ? 22 : 0;
    ctx.strokeStyle = "rgba(64,61,56,.48)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    for (let x = offset; x < 256; x += 58) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Math.min(256, y + 32)); ctx.stroke();
    }
  }
  for (let i = 0; i < 560; i++) {
    const x = (Math.sin(i * 92.17) * 43758.5453 % 1 + 1) % 1 * 256;
    const y = (Math.sin(i * 37.71 + 4.2) * 23421.631 % 1 + 1) % 1 * 256;
    const shade = 92 + (i * 17 % 72);
    ctx.fillStyle = "rgba(" + shade + "," + (shade - 4) + "," + (shade - 10) + ",.12)";
    ctx.fillRect(x, y, 1 + i % 3, 1 + i % 2);
  }
  ctx.strokeStyle = "rgba(55,54,50,.4)";
  ctx.lineWidth = 2;
  [[28, 18, 45, 41, 39, 67], [174, 79, 158, 105, 169, 133], [92, 181, 116, 202, 107, 235]].forEach((crack) => {
    ctx.beginPath(); ctx.moveTo(crack[0], crack[1]); ctx.lineTo(crack[2], crack[3]); ctx.lineTo(crack[4], crack[5]); ctx.stroke();
  });
  const moss = ctx.createRadialGradient(224, 234, 2, 224, 234, 38);
  moss.addColorStop(0, "rgba(74,91,62,.55)");
  moss.addColorStop(1, "rgba(74,91,62,0)");
  ctx.fillStyle = moss;
  ctx.fillRect(180, 190, 76, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
const abbeyAtlas = makeAbbeyAtlas();
const mats = {
  floor: Object.fromEntries(Object.keys(BP.MATERIALS).map((key) => [key, material(PALETTE[key], { map: abbeyAtlas, roughness: 0.92 })])),
  unknown: material(PALETTE.unknown, { roughness: 1 }),
  wall: material(0xb1aa9d, { map: abbeyAtlas, roughness: 0.96 }),
  wallTop: material(0xd8d0c1, { map: abbeyAtlas, roughness: 0.94 }),
  cutaway: material(PALETTE.wall, { transparent: true, opacity: 0.24, depthWrite: false }),
  lowWall: material(0xa49c8e, { map: abbeyAtlas, roughness: 0.95 }),
  wood: material(PALETTE.wood, { roughness: 0.84 }),
  darkWood: material(0x3d2d22, { roughness: 0.9 }),
  metal: material(PALETTE.metal, { metalness: 0.35, roughness: 0.55 }),
  gilded: material(0xb58b3e, { metalness: 0.56, roughness: 0.36 }),
  linen: material(0x8f493e, { roughness: 0.92 }),
  wax: material(0xe7d8ae, { roughness: 0.78 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffbb62 }),
  water: material(PALETTE.water, { transparent: true, opacity: 0.72, roughness: 0.26 }),
  rubble: material(0x716b62),
  unknownArchitecture: material(0x666b67, { transparent: true, opacity: 0.12, depthWrite: false }),
  pc: material(PALETTE.pc, { metalness: 0.12, roughness: 0.45 }),
  foe: material(PALETTE.foe, { metalness: 0.08, roughness: 0.52 }),
  select: new THREE.MeshBasicMaterial({ color: 0xf0ce7b, transparent: true, opacity: 0.42, depthTest: false, side: THREE.DoubleSide }),
  selectAxis: new THREE.MeshBasicMaterial({ color: 0xffdf87, depthTest: false })
};

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry && !child.userData.sharedGeometry) child.geometry.dispose();
    if (child.material && child.userData.ownedMaterial) {
      if (Array.isArray(child.material)) child.material.forEach((value) => value.dispose());
      else child.material.dispose();
    }
  });
}
function worldX(c) { return c - state.blueprint.grid.cols / 2 + 0.5; }
function worldZ(r) { return r - state.blueprint.grid.rows / 2 + 0.5; }
function rise(elevationFt) { return Number(elevationFt || 0) * 0.1; }
function cellInfo(c, r) { return state.map.meta.regions[BP.idx(state.map.cols, c, r)]; }
function isDiscovered(region) { return region && state.discovered.has(region); }
function isAuthoringVisible(info) { return !!info && (isDiscovered(info.region) || state.mode === "build"); }
function chunkBounds(chunkC, chunkR) {
  const size = state.blueprint.grid.chunkSize;
  return {
    minC: chunkC * size, minR: chunkR * size,
    maxC: Math.min(state.blueprint.grid.cols, (chunkC + 1) * size),
    maxR: Math.min(state.blueprint.grid.rows, (chunkR + 1) * size)
  };
}

function addInstances(group, geometry, materialValue, records, transform) {
  if (!records.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, materialValue, records.length);
  const matrix = new THREE.Matrix4();
  records.forEach((record, index) => {
    matrix.identity();
    transform(matrix, record, index);
    mesh.setMatrixAt(index, matrix);
    if (record.tint != null) mesh.setColorAt(index, new THREE.Color(record.tint));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = state.quality !== "basic";
  mesh.receiveShadow = true;
  mesh.userData.cells = records.map((record) => ({ c: record.c, r: record.r }));
  mesh.userData.pickableFloor = records[0] && records[0].floor === true;
  mesh.userData.cutaway = materialValue === mats.cutaway;
  mesh.userData.sharedGeometry = true;
  group.add(mesh);
  return mesh;
}

const floorGeometry = new THREE.BoxGeometry(0.94, 0.12, 0.94);
const wallGeometryNS = new THREE.BoxGeometry(0.92, 1.65, 0.14);
const wallGeometryEW = new THREE.BoxGeometry(0.14, 1.65, 0.92);
const cutGeometryNS = new THREE.BoxGeometry(0.92, 0.36, 0.14);
const cutGeometryEW = new THREE.BoxGeometry(0.14, 0.36, 0.92);
const lowWallGeometryNS = new THREE.BoxGeometry(0.9, 0.56, 0.18);
const lowWallGeometryEW = new THREE.BoxGeometry(0.18, 0.56, 0.9);
const doorGeometryNS = new THREE.BoxGeometry(0.74, 1.22, 0.08);
const doorGeometryEW = new THREE.BoxGeometry(0.08, 1.22, 0.74);
const pillarGeometry = new THREE.CylinderGeometry(0.22, 0.28, 1.55, 8);
const rubbleGeometry = new THREE.DodecahedronGeometry(0.28, 0);
const crateGeometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
const brazierGeometry = new THREE.CylinderGeometry(0.2, 0.28, 0.55, 8);
const poolGeometry = new THREE.BoxGeometry(0.76, 0.03, 0.76);
const tokenGeometry = new THREE.CylinderGeometry(0.26, 0.31, 0.72, 12);
const stoneBlockNS = new THREE.BoxGeometry(0.285, 0.28, 0.15);
const stoneBlockEW = new THREE.BoxGeometry(0.15, 0.28, 0.285);
const stoneCapNS = new THREE.BoxGeometry(0.94, 0.09, 0.2);
const stoneCapEW = new THREE.BoxGeometry(0.2, 0.09, 0.94);
const pewSeatGeometry = new THREE.BoxGeometry(0.75, 0.12, 0.28);
const pewBackGeometry = new THREE.BoxGeometry(0.75, 0.48, 0.1);
const altarBaseGeometry = new THREE.BoxGeometry(0.72, 0.58, 0.5);
const altarSlabGeometry = new THREE.BoxGeometry(0.88, 0.13, 0.62);
const reliquaryGeometry = new THREE.BoxGeometry(0.42, 0.68, 0.34);
const statueBodyGeometry = new THREE.ConeGeometry(0.27, 0.9, 8);
const statueHeadGeometry = new THREE.SphereGeometry(0.16, 10, 8);
const fontBaseGeometry = new THREE.CylinderGeometry(0.16, 0.24, 0.42, 8);
const fontBowlGeometry = new THREE.TorusGeometry(0.25, 0.09, 8, 16);
const candleGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.23, 7);
const flameGeometry = new THREE.ConeGeometry(0.035, 0.11, 7);
const selectionAxisGeometry = new THREE.BoxGeometry(0.72, 0.025, 0.07);
const importVolumeGeometry = new THREE.BoxGeometry(1, 1, 1);
const stairStepGeometry = new THREE.BoxGeometry(0.86, 0.09, 0.22);
[
  floorGeometry, wallGeometryNS, wallGeometryEW, cutGeometryNS, cutGeometryEW,
  lowWallGeometryNS, lowWallGeometryEW, doorGeometryNS, doorGeometryEW,
  pillarGeometry, rubbleGeometry, crateGeometry, brazierGeometry, poolGeometry, tokenGeometry,
  stoneBlockNS, stoneBlockEW, stoneCapNS, stoneCapEW, pewSeatGeometry, pewBackGeometry,
  altarBaseGeometry, altarSlabGeometry, reliquaryGeometry, statueBodyGeometry, statueHeadGeometry,
  fontBaseGeometry, fontBowlGeometry, candleGeometry, flameGeometry, selectionAxisGeometry, importVolumeGeometry,
  stairStepGeometry
].forEach((geometry) => { geometry.userData = { shared: true }; });

function boundaryEdges(c, r) {
  const edges = [];
  [[0, -1, "n"], [1, 0, "e"], [0, 1, "s"], [-1, 0, "w"]].forEach(([dc, dr, side]) => {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= state.map.cols || nr >= state.map.rows || !cellInfo(nc, nr)) edges.push(side);
  });
  return edges;
}
function explicitArchitectureItemsAt(c, r) {
  return (state.map.meta.architecture || []).filter((item) => item.c === c && item.r === r);
}
function explicitArchitectureAt(c, r, edge) {
  const items = explicitArchitectureItemsAt(c, r);
  return edge ? items.find((item) => BP.normalizeEdge(item.edge) === BP.normalizeEdge(edge)) || null : items[0] || null;
}
function explicitArchitectureBoundaryAt(c, r, edge) {
  for (const ref of BP.edgeReferences(c, r, edge)) {
    const item = explicitArchitectureAt(ref.c, ref.r, ref.edge);
    if (item) return { item, c: ref.c, r: ref.r, edge: ref.edge };
  }
  return null;
}
function isDerivedBoundary(c, r, edge) {
  return boundaryEdges(c, r).includes(String(edge || "").toLowerCase());
}
function architectureSets(bounds) {
  const out = { wallsNS: [], wallsEW: [], cutNS: [], cutEW: [], lowNS: [], lowEW: [], doorsNS: [], doorsEW: [] };
  for (let r = bounds.minR; r < bounds.maxR; r++) for (let c = bounds.minC; c < bounds.maxC; c++) {
    const info = cellInfo(c, r);
    if (!isAuthoringVisible(info)) continue;
    const y = rise(info.elevationFt);
    (state.blueprint.source?.structureReview ? [] : boundaryEdges(c, r)).forEach((side) => {
      if (explicitArchitectureBoundaryAt(c, r, side)) return;
      const near = side === "s" || side === "e";
      const record = { c, r, side, y };
      if (side === "n" || side === "s") out[near ? "cutNS" : "wallsNS"].push(record);
      else out[near ? "cutEW" : "wallsEW"].push(record);
    });
    explicitArchitectureItemsAt(c, r).forEach((item) => {
      const edge = BP.normalizeEdge(item.edge);
      const eastWest = edge ? ["N", "S"].includes(edge) : BP.normalizeRotation(item.rotation) % 180 === 0;
      const record = { c, r, y, side: edge ? edge.toLowerCase() : undefined, centered: !edge };
      if (item.kind === "lowWall") out[eastWest ? "lowNS" : "lowEW"].push(record);
      if (item.kind === "door" || item.kind === "arch") out[eastWest ? "doorsNS" : "doorsEW"].push({ ...record, kind: item.kind });
      if (item.kind === "wall" || item.kind === "window") out[eastWest ? "wallsNS" : "wallsEW"].push(record);
    });
  }
  return out;
}
function wallTransform(matrix, record, height, sideOffset) {
  let x = worldX(record.c), z = worldZ(record.r);
  if (!record.centered) {
    if (record.side === "n") z -= sideOffset;
    if (record.side === "s") z += sideOffset;
    if (record.side === "e") x += sideOffset;
    if (record.side === "w") x -= sideOffset;
  }
  matrix.makeTranslation(x, record.y + height / 2 + 0.1, z);
}
function wallOrigin(record, sideOffset) {
  let x = worldX(record.c), z = worldZ(record.r);
  if (!record.centered) {
    if (record.side === "n") z -= sideOffset;
    if (record.side === "s") z += sideOffset;
    if (record.side === "e") x += sideOffset;
    if (record.side === "w") x -= sideOffset;
  }
  return { x, z };
}
function stoneTint(seed) {
  return [0xe1dbcf, 0xc9c2b6, 0xf0e8d9, 0xb7b0a5][Math.abs(seed) % 4];
}
function stoneCourses(records, orientation, rowCount) {
  const out = [];
  records.forEach((record) => {
    const origin = wallOrigin(record, record.centered ? 0 : 0.46);
    const sideSeed = record.side ? record.side.charCodeAt(0) : 5;
    const ruined = (record.c * 7 + record.r * 11 + sideSeed) % 5 === 0;
    for (let row = 0; row < rowCount; row++) for (let col = 0; col < 3; col++) {
      if (ruined && row === rowCount - 1 && (col + record.c + record.r) % 3 === 0) continue;
      const along = (col - 1) * 0.3 + (row % 2 ? 0.1 : -0.03);
      out.push({
        c: record.c, r: record.r,
        x: origin.x + (orientation === "ns" ? along : 0),
        z: origin.z + (orientation === "ew" ? along : 0),
        y: record.y + 0.24 + row * 0.3,
        tint: stoneTint(record.c * 31 + record.r * 17 + row * 5 + col + sideSeed)
      });
    }
  });
  return out;
}
function doorFrameCourses(records, orientation) {
  const out = [];
  records.forEach((record) => {
    const origin = wallOrigin(record, record.centered ? 0 : 0.46);
    [-0.42, 0.42].forEach((along, sideIndex) => {
      for (let row = 0; row < 4; row++) out.push({
        c: record.c, r: record.r,
        x: origin.x + (orientation === "ns" ? along : 0),
        z: origin.z + (orientation === "ew" ? along : 0),
        y: record.y + 0.24 + row * 0.3,
        tint: stoneTint(record.c * 13 + record.r * 19 + row + sideIndex)
      });
    });
    for (let col = 0; col < 3; col++) {
      const along = (col - 1) * 0.3;
      out.push({
        c: record.c, r: record.r,
        x: origin.x + (orientation === "ns" ? along : 0),
        z: origin.z + (orientation === "ew" ? along : 0),
        y: record.y + 1.43,
        tint: stoneTint(record.c * 23 + record.r * 29 + col)
      });
    }
  });
  return out;
}
function addSharedMesh(group, geometry, materialValue, position, rotation, scale) {
  const mesh = new THREE.Mesh(geometry, materialValue);
  mesh.position.copy(position);
  if (rotation) mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
  if (scale) mesh.scale.set(scale.x || 1, scale.y || 1, scale.z || 1);
  mesh.castShadow = state.quality !== "basic";
  mesh.receiveShadow = true;
  mesh.userData.sharedGeometry = true;
  group.add(mesh);
  return mesh;
}
function addFinishedProp(group, item) {
  const info = cellInfo(item.c, item.r);
  const root = new THREE.Group();
  root.position.set(worldX(item.c), rise(info.elevationFt) + 0.08, worldZ(item.r));
  root.rotation.y = BP.normalizeRotation(item.rotation) * Math.PI / 180;
  group.add(root);
  const p = (x, y, z) => new THREE.Vector3(x, y, z);
  if (item.kind === "pew") {
    addSharedMesh(root, pewSeatGeometry, mats.darkWood, p(0, 0.34, 0));
    addSharedMesh(root, pewBackGeometry, mats.wood, p(0, 0.56, -0.14));
    addSharedMesh(root, crateGeometry, mats.darkWood, p(-0.28, 0.17, 0), null, { x: 0.12, y: 0.6, z: 0.5 });
    addSharedMesh(root, crateGeometry, mats.darkWood, p(0.28, 0.17, 0), null, { x: 0.12, y: 0.6, z: 0.5 });
    if (item.variant === "broken") root.rotation.z = -0.06;
  } else if (item.kind === "altar") {
    addSharedMesh(root, altarBaseGeometry, mats.wallTop, p(0, 0.34, 0));
    addSharedMesh(root, altarSlabGeometry, mats.wall, p(0, 0.7, 0));
    addSharedMesh(root, crateGeometry, mats.linen, p(0, 0.46, -0.27), null, { x: 0.52, y: 0.76, z: 0.05 });
    addSharedMesh(root, crateGeometry, mats.gilded, p(0, 0.48, -0.31), null, { x: 0.08, y: 0.5, z: 0.04 });
    addSharedMesh(root, crateGeometry, mats.gilded, p(0, 0.52, -0.31), null, { x: 0.32, y: 0.08, z: 0.04 });
  } else if (item.kind === "reliquary") {
    addSharedMesh(root, reliquaryGeometry, mats.darkWood, p(0, 0.38, 0));
    addSharedMesh(root, crateGeometry, mats.gilded, p(0, 0.38, -0.19), null, { x: 0.08, y: 0.7, z: 0.05 });
    addSharedMesh(root, crateGeometry, mats.gilded, p(0, 0.44, -0.19), null, { x: 0.42, y: 0.08, z: 0.05 });
  } else if (item.kind === "statue") {
    addSharedMesh(root, crateGeometry, mats.wall, p(0, 0.13, 0), null, { x: 0.78, y: 0.44, z: 0.78 });
    const body = addSharedMesh(root, statueBodyGeometry, mats.wallTop, p(0, 0.76, 0));
    if (item.variant === "broken") {
      body.rotation.z = -0.11;
      addSharedMesh(root, rubbleGeometry, mats.rubble, p(0.25, 0.18, 0.1), null, { x: 0.65, y: 0.65, z: 0.65 });
    } else addSharedMesh(root, statueHeadGeometry, mats.wallTop, p(0, 1.28, 0));
  } else if (item.kind === "font") {
    addSharedMesh(root, fontBaseGeometry, mats.wall, p(0, 0.23, 0));
    addSharedMesh(root, fontBowlGeometry, mats.wallTop, p(0, 0.48, 0), { x: Math.PI / 2 });
    addSharedMesh(root, poolGeometry, mats.water, p(0, 0.48, 0), null, { x: 0.48, y: 1, z: 0.48 });
  } else if (item.kind === "candles") {
    [[-0.16, 0], [0.02, -0.09], [0.17, 0.08]].forEach(([x, z], index) => {
      const height = 0.17 + index * 0.04;
      addSharedMesh(root, candleGeometry, mats.wax, p(x, height / 2, z), null, { x: 1, y: height / 0.23, z: 1 });
      addSharedMesh(root, flameGeometry, mats.flame, p(x, height + 0.055, z));
    });
  } else if (item.kind === "brazier") {
    addSharedMesh(root, brazierGeometry, mats.metal, p(0, 0.29, 0));
    addSharedMesh(root, flameGeometry, mats.flame, p(0, 0.67, 0), null, { x: 2.2, y: 2.7, z: 2.2 });
  }
}

function importedStructureMeshes(group, bounds) {
  const review = state.blueprint.source?.structureReview;
  if (!review?.regions) return;
  const makeMaterial = (region, extra = {}) => new THREE.MeshStandardMaterial({
    color: region.palette?.primary || ({ water: 0x397f91, tree: 0x648150, bridge: 0xc08b4f, stairs: 0xb9ad8b }[region.type] || 0x8c735e),
    roughness: region.type === "water" ? 0.28 : 0.86,
    transparent: region.type === "water",
    opacity: region.type === "water" ? 0.72 : 1,
    ...extra
  });
  const addVolume = (region, c, r, width, baseFt, topFt, depth = .94) => {
    const height = Math.max(.04, rise(topFt - baseFt));
    const mesh = addSharedMesh(group, importVolumeGeometry, makeMaterial(region),
      new THREE.Vector3(worldX(c + (width - 1) / 2), rise(baseFt) + height / 2 + .06, worldZ(r)), null,
      { x: width * .94, y: height, z: depth });
    mesh.userData.ownedMaterial = true;
  };
  review.regions.filter((region) => region.source === "dm-authored").forEach((region) => {
    const rows = {};
    region.cells.forEach((cell) => {
      if (cell[0] < bounds.minC || cell[0] >= bounds.maxC || cell[1] < bounds.minR || cell[1] >= bounds.maxR) return;
      (rows[cell[1]] || (rows[cell[1]] = [])).push(cell[0]);
    });
    Object.keys(rows).forEach((rowKey) => {
      const r = Number(rowKey), columns = rows[rowKey].sort((a, b) => a - b), runs = [];
      columns.forEach((c) => {
        const last = runs[runs.length - 1];
        if (last && c === last.end + 1) last.end = c;
        else runs.push({ start: c, end: c });
      });
      runs.forEach((run) => {
        const width = run.end - run.start + 1, baseFt = Number(region.baseFt) || 0, topFt = Math.max(baseFt, Number(region.topFt) || 0);
        if (["building", "wall", "tent"].includes(region.type)) addVolume(region, run.start, r, width, baseFt, topFt);
        else if (["roof", "bridge"].includes(region.type)) {
          if (region.supportMode !== "posts") addVolume(region, run.start, r, width, baseFt, topFt);
          else {
            [run.start, run.end].forEach((c) => addVolume(region, c, r, 1, baseFt, Math.max(baseFt + 1, topFt), .16));
          }
          addVolume(region, run.start, r, width, Math.max(baseFt, topFt - .45), topFt);
        } else if (region.type === "water") addVolume(region, run.start, r, width, 0, .12);
        else if (region.type === "stairs") region.cells.filter((cell) => cell[1] === r && cell[0] >= run.start && cell[0] <= run.end).forEach((cell) => {
          const elevation = state.map.h[BP.idx(state.map.cols, cell[0], cell[1])];
          addVolume(region, cell[0], cell[1], 1, Math.max(0, elevation - .22), elevation);
        });
      });
    });
    if (region.type === "tree") region.cells.forEach((cell) => {
      if (cell[0] < bounds.minC || cell[0] >= bounds.maxC || cell[1] < bounds.minR || cell[1] >= bounds.maxR) return;
      const height = Math.max(5, Number(region.topFt) || 15), trunk = addSharedMesh(group, pillarGeometry, makeMaterial(region, { color: 0x5b4634 }),
        new THREE.Vector3(worldX(cell[0]), rise(height) * .28, worldZ(cell[1])), null, { x: .5, y: Math.max(.8, rise(height) / 1.55 * .55), z: .5 });
      trunk.userData.ownedMaterial = true;
      const crown = addSharedMesh(group, rubbleGeometry, makeMaterial(region),
        new THREE.Vector3(worldX(cell[0]), rise(height) * .72, worldZ(cell[1])), null, { x: 1.55, y: 1.3, z: 1.55 });
      crown.userData.ownedMaterial = true;
    });
  });
}

function addConnectorStairs(group, bounds) {
  const steps = [];
  (state.map.connectors || []).filter((connector) => connector.kind === "stairs" && connector.state !== "closed").forEach((connector) => {
    const path = connector.path || [];
    for (let index = 1; index < path.length; index++) {
      const from = path[index - 1], to = path[index];
      const fromFt = Number(from.elevationFt ?? state.map.h[BP.idx(state.map.cols, from.c, from.r)]) || 0;
      const toFt = Number(to.elevationFt ?? state.map.h[BP.idx(state.map.cols, to.c, to.r)]) || 0;
      if (fromFt === toFt || to.c < bounds.minC || to.c >= bounds.maxC || to.r < bounds.minR || to.r >= bounds.maxR) continue;
      const count = Math.max(5, Math.min(12, Math.round(Math.abs(toFt - fromFt))));
      for (let step = 0; step < count; step++) {
        const amount = (step + 0.5) / count;
        steps.push({
          c: to.c, r: to.r,
          x: worldX(from.c) + (worldX(to.c) - worldX(from.c)) * amount,
          z: worldZ(from.r) + (worldZ(to.r) - worldZ(from.r)) * amount,
          y: rise(fromFt + (toFt - fromFt) * amount) + 0.065,
          rotation: from.c !== to.c ? Math.PI / 2 : 0
        });
      }
    }
  });
  addInstances(group, stairStepGeometry, mats.wallTop, steps, (matrix, record) => {
    matrix.makeRotationY(record.rotation);
    matrix.setPosition(record.x, record.y, record.z);
  });
}

function buildChunk(chunkC, chunkR, animate = false) {
  const chunkKey = chunkC + "," + chunkR;
  const old = state.chunks.get(chunkKey);
  if (old) { boardRoot.remove(old); disposeObject(old); }
  const group = new THREE.Group();
  group.name = "chunk-" + chunkKey;
  group.userData.chunkKey = chunkKey;
  group.userData.revealStart = animate ? performance.now() : 0;
  const bounds = chunkBounds(chunkC, chunkR);
  const floors = {};
  const unknown = [];
  for (let r = bounds.minR; r < bounds.maxR; r++) for (let c = bounds.minC; c < bounds.maxC; c++) {
    const info = cellInfo(c, r);
    if (!info) continue;
    const record = { c, r, floor: true, y: isAuthoringVisible(info) ? rise(info.elevationFt) : 0 };
    if (!isDiscovered(info.region)) unknown.push(record);
    else (floors[info.material] || (floors[info.material] = [])).push(record);
  }
  Object.keys(floors).forEach((materialKey) => {
    addInstances(group, floorGeometry, mats.floor[materialKey] || mats.floor.nave, floors[materialKey], (matrix, record) => {
      matrix.makeTranslation(worldX(record.c), record.y, worldZ(record.r));
    });
  });
  addInstances(group, floorGeometry, mats.unknown, unknown, (matrix, record) => {
    matrix.makeScale(1, 0.3, 1);
    matrix.setPosition(worldX(record.c), -0.035, worldZ(record.r));
  });
  addConnectorStairs(group, bounds);
  const sets = architectureSets(bounds);
  if (state.quality === "basic") {
    addInstances(group, wallGeometryNS, mats.wall, sets.wallsNS, (m, value) => wallTransform(m, value, 1.65, 0.46));
    addInstances(group, wallGeometryEW, mats.wall, sets.wallsEW, (m, value) => wallTransform(m, value, 1.65, 0.46));
  } else {
    addInstances(group, stoneBlockNS, mats.wallTop, stoneCourses(sets.wallsNS, "ns", 5), (m, value) => m.makeTranslation(value.x, value.y, value.z));
    addInstances(group, stoneBlockEW, mats.wallTop, stoneCourses(sets.wallsEW, "ew", 5), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  }
  addInstances(group, stoneBlockNS, mats.cutaway, stoneCourses(sets.cutNS, "ns", 1), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  addInstances(group, stoneBlockEW, mats.cutaway, stoneCourses(sets.cutEW, "ew", 1), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  addInstances(group, lowWallGeometryNS, mats.lowWall, sets.lowNS, (m, value) => wallTransform(m, value, 0.56, 0.46));
  addInstances(group, lowWallGeometryEW, mats.lowWall, sets.lowEW, (m, value) => wallTransform(m, value, 0.56, 0.46));
  addInstances(group, doorGeometryNS, mats.wood, sets.doorsNS.filter((value) => value.kind === "door"), (m, value) => wallTransform(m, value, 1.22, 0.46));
  addInstances(group, doorGeometryEW, mats.wood, sets.doorsEW.filter((value) => value.kind === "door"), (m, value) => wallTransform(m, value, 1.22, 0.46));
  addInstances(group, stoneBlockNS, mats.wallTop, doorFrameCourses(sets.doorsNS, "ns"), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  addInstances(group, stoneBlockEW, mats.wallTop, doorFrameCourses(sets.doorsEW, "ew"), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  importedStructureMeshes(group, bounds);

  const chunkProps = (state.blueprint.props || []).filter((item) => {
    const info = cellInfo(item.c, item.r);
    return item.c >= bounds.minC && item.c < bounds.maxC && item.r >= bounds.minR && item.r < bounds.maxR && isAuthoringVisible(info);
  });
  const byKind = {};
  chunkProps.forEach((item) => (byKind[item.kind] || (byKind[item.kind] = [])).push(item));
  function propTransform(matrix, item, height) {
    const info = cellInfo(item.c, item.r);
    matrix.makeTranslation(worldX(item.c), rise(info.elevationFt) + height / 2 + 0.08, worldZ(item.r));
  }
  addInstances(group, pillarGeometry, mats.wallTop, byKind.pillar || [], (m, item) => propTransform(m, item, 1.55));
  addInstances(group, rubbleGeometry, mats.rubble, byKind.rubble || [], (m, item) => {
    const info = cellInfo(item.c, item.r);
    m.makeRotationY((item.rotation || 0) * Math.PI / 180);
    m.setPosition(worldX(item.c), rise(info.elevationFt) + 0.25, worldZ(item.r));
  });
  addInstances(group, crateGeometry, mats.wood, byKind.crates || [], (m, item) => propTransform(m, item, 0.55));
  addInstances(group, poolGeometry, mats.water, byKind.pool || [], (m, item) => propTransform(m, item, 0.03));
  ["altar", "pew", "reliquary", "statue", "candles", "font", "brazier"].forEach((kind) => (byKind[kind] || []).forEach((item) => addFinishedProp(group, item)));

  const chunkSpawns = runtimeSpawns().filter((item) => {
    const info = cellInfo(item.c, item.r);
    return item.c >= bounds.minC && item.c < bounds.maxC && item.r >= bounds.minR && item.r < bounds.maxR && info && isDiscovered(info.region);
  });
  ["pc", "foe"].forEach((side) => {
    addInstances(group, tokenGeometry, side === "pc" ? mats.pc : mats.foe, chunkSpawns.filter((item) => item.side === side), (m, item) => {
      const info = cellInfo(item.c, item.r);
      m.makeTranslation(worldX(item.c), rise(info.elevationFt) + 0.48, worldZ(item.r));
    });
  });
  if (animate) {
    group.position.y = -0.45;
    group.userData.targetY = 0;
  }
  state.chunks.set(chunkKey, group);
  boardRoot.add(group);
  return group;
}

function buildLights() {
  while (lightRoot.children.length) lightRoot.remove(lightRoot.children[0]);
  if (state.quality === "basic") return;
  (state.blueprint.lights || []).forEach((record) => {
    if (!isDiscovered(record.discoveryRegion)) return;
    const info = cellInfo(record.c, record.r);
    const lamp = new THREE.PointLight(record.color, state.quality === "cinematic" ? record.intensity * 2 : record.intensity, 7, 2);
    lamp.position.set(worldX(record.c), rise(info && info.elevationFt) + 1.3, worldZ(record.r));
    lamp.castShadow = state.quality === "cinematic";
    lightRoot.add(lamp);
  });
}
function clearOwnedRoot(root) {
  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    child.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((value) => value.dispose());
        else node.material.dispose();
      }
    });
  }
}
function buildGrid() {
  clearOwnedRoot(gridRoot);
  if (!state.gridVisible) return;
  const points = [];
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!isAuthoringVisible(info)) continue;
    const x = worldX(c), z = worldZ(r), y = rise(info.elevationFt) + 0.075;
    points.push(
      x - 0.47, y, z - 0.47, x + 0.47, y, z - 0.47,
      x + 0.47, y, z - 0.47, x + 0.47, y, z + 0.47,
      x + 0.47, y, z + 0.47, x - 0.47, y, z + 0.47,
      x - 0.47, y, z + 0.47, x - 0.47, y, z - 0.47
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xe5d29a, transparent: true, opacity: 0.34, depthWrite: false
  }));
  lines.renderOrder = 12;
  gridRoot.add(lines);
}
function groupColor(group) {
  return group.role === "party" ? 0xc99a38 : (group.role === "ally" ? 0x4f8a72 : 0xa14c43);
}
function buildFlags() {
  clearOwnedRoot(flagRoot);
  state.groups.forEach((group) => {
    if (!group.anchor) return;
    const info = cellInfo(group.anchor.c, group.anchor.r);
    if (!info || !isDiscovered(info.region)) return;
    const color = groupColor(group), y = rise(info.elevationFt) + 0.1;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 1.35, 7),
      new THREE.MeshStandardMaterial({ color: 0x3d3328, roughness: 0.8 })
    );
    pole.position.set(worldX(group.anchor.c), y + 0.68, worldZ(group.anchor.r));
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.54, 0.34),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.72 })
    );
    cloth.position.set(worldX(group.anchor.c) + 0.28, y + 1.08, worldZ(group.anchor.r));
    cloth.rotation.y = -0.22;
    flagRoot.add(pole, cloth);
  });
}
function buildAreaOverlay() {
  clearOwnedRoot(areaRoot);
  if (!state.areaHighlight || !state.areaFocus || !state.map) return;
  const cells = [], points = [], bars = [], thresholds = [];
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info || info.region !== state.areaFocus) continue;
    const y = rise(info.elevationFt) + 0.1, x = worldX(c), z = worldZ(r);
    cells.push({ c, r, y });
    [
      { dc: 0, dr: -1, a: [x - 0.48, z - 0.48], b: [x + 0.48, z - 0.48], rotation: 0 },
      { dc: 1, dr: 0, a: [x + 0.48, z - 0.48], b: [x + 0.48, z + 0.48], rotation: Math.PI / 2 },
      { dc: 0, dr: 1, a: [x + 0.48, z + 0.48], b: [x - 0.48, z + 0.48], rotation: 0 },
      { dc: -1, dr: 0, a: [x - 0.48, z + 0.48], b: [x - 0.48, z - 0.48], rotation: Math.PI / 2 }
    ].forEach((edge) => {
      const nc = c + edge.dc, nr = r + edge.dr;
      const neighbor = nc >= 0 && nr >= 0 && nc < state.map.cols && nr < state.map.rows ? cellInfo(nc, nr) : null;
      if (neighbor?.region === state.areaFocus) return;
      points.push(edge.a[0], y + 0.018, edge.a[1], edge.b[0], y + 0.018, edge.b[1]);
      bars.push({
        x: (edge.a[0] + edge.b[0]) / 2,
        z: (edge.a[1] + edge.b[1]) / 2,
        y: y + 0.035,
        rotation: edge.rotation
      });
    });
  }
  BP.areaSummary(state.blueprint, state.areaFocus).thresholds.forEach((threshold) => {
    const info = cellInfo(threshold.sourceC, threshold.sourceR);
    thresholds.push({
      x: threshold.markerC - state.map.cols / 2,
      z: threshold.markerR - state.map.rows / 2,
      y: rise(info?.elevationFt || 0) + 0.24
    });
  });
  if (cells.length) {
    const geometry = new THREE.PlaneGeometry(0.86, 0.86);
    const materialValue = new THREE.MeshBasicMaterial({
      color: 0xe8b84e, transparent: true, opacity: 0.34, depthWrite: false, depthTest: false, side: THREE.DoubleSide
    });
    const mesh = new THREE.InstancedMesh(geometry, materialValue, cells.length);
    const matrix = new THREE.Matrix4();
    cells.forEach((cell, index) => {
      matrix.makeRotationX(-Math.PI / 2);
      matrix.setPosition(worldX(cell.c), cell.y, worldZ(cell.r));
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 30;
    areaRoot.add(mesh);
  }
  if (bars.length) {
    const geometry = new THREE.BoxGeometry(0.98, 0.035, 0.055);
    const materialValue = new THREE.MeshBasicMaterial({ color: 0xf6ce69, depthTest: false });
    const mesh = new THREE.InstancedMesh(geometry, materialValue, bars.length);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Matrix4();
    bars.forEach((bar, index) => {
      matrix.makeTranslation(bar.x, bar.y, bar.z);
      rotation.makeRotationY(bar.rotation);
      matrix.multiply(rotation);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 32;
    areaRoot.add(mesh);
  }
  if (thresholds.length) {
    const geometry = new THREE.OctahedronGeometry(0.13, 0);
    const materialValue = new THREE.MeshBasicMaterial({ color: 0xffe29a, depthTest: false });
    const mesh = new THREE.InstancedMesh(geometry, materialValue, thresholds.length);
    const matrix = new THREE.Matrix4();
    thresholds.forEach((threshold, index) => {
      matrix.makeRotationY(Math.PI / 4);
      matrix.setPosition(threshold.x, threshold.y, threshold.z);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 33;
    areaRoot.add(mesh);
  }
  if (points.length) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: 0xffd878, transparent: true, opacity: 0.96, depthTest: false
    }));
    lines.renderOrder = 31;
    areaRoot.add(lines);
  }
}
function rebuildAll() {
  state.chunks.forEach((group) => { boardRoot.remove(group); disposeObject(group); });
  state.chunks.clear();
  const size = state.blueprint.grid.chunkSize;
  for (let r = 0; r < state.blueprint.grid.rows; r += size) {
    for (let c = 0; c < state.blueprint.grid.cols; c += size) buildChunk(Math.floor(c / size), Math.floor(r / size));
  }
  buildLights();
  buildGrid();
  buildFlags();
  buildAreaOverlay();
  drawSelection();
  requestRender();
}
function rebuildRegion(regionId, animate) {
  const chunks = new Set();
  state.map.meta.regions.forEach((info, index) => {
    if (!info || info.region !== regionId) return;
    const c = index % state.map.cols, r = Math.floor(index / state.map.cols);
    chunks.add(BP.chunkFor(state.blueprint, c, r).key);
  });
  chunks.forEach((chunkKey) => {
    const [c, r] = chunkKey.split(",").map(Number);
    buildChunk(c, r, animate);
  });
  buildLights();
  buildGrid();
  buildFlags();
  buildAreaOverlay();
  requestRender(animate ? 520 : 0);
}
function rebuildCellChunk(c, r) {
  const chunk = BP.chunkFor(state.blueprint, c, r);
  buildChunk(chunk.c, chunk.r);
  buildGrid();
  buildFlags();
  buildAreaOverlay();
  ui.chunkStatus.textContent = "chunk " + chunk.key + " · 1/" + BP.chunkCount(state.blueprint);
  ui.chunkStatus.className = "status good";
  requestRender();
}

function updateCutaway() {
  const dir = camera.position.clone().sub(controls.target).normalize();
  const authoring = state.mode === "build";
  mats.cutaway.transparent = !authoring;
  mats.cutaway.depthWrite = authoring;
  mats.cutaway.opacity = authoring ? 1 : (Math.abs(dir.y) > 0.86 ? 0.42 : 0.24);
  mats.cutaway.needsUpdate = true;
  boardRoot.traverse((child) => {
    if (!child.userData.cutaway || !child.material) return;
    child.material.opacity = mats.cutaway.opacity;
  });
}
function edgeWorld(c, r, edge) {
  const offset = { N: [0, -0.5], E: [0.5, 0], S: [0, 0.5], W: [-0.5, 0] }[BP.normalizeEdge(edge)] || [0, 0];
  return { x: worldX(c) + offset[0], z: worldZ(r) + offset[1] };
}
function edgeSelectionMesh(c, r, edge, y, material) {
  const horizontal = ["N", "S"].includes(BP.normalizeEdge(edge));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? 0.92 : 0.13, horizontal ? 0.13 : 0.92), material);
  const at = edgeWorld(c, r, edge);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(at.x, y, at.z);
  mesh.renderOrder = 42;
  return mesh;
}
function drawSelection() {
  while (selectionRoot.children.length) selectionRoot.remove(selectionRoot.children[0]);
  if (state.workflow === "present" && state.fight && !fightFinished()) {
    const reachable = Object.keys(LocalCombat.reachableForActive(state.fight)).map((value) => {
      const parts = value.split(",").map(Number);
      return { c: parts[0], r: parts[1] };
    });
    if (reachable.length) {
      const mesh = new THREE.InstancedMesh(floorGeometry, mats.select, reachable.length), matrix = new THREE.Matrix4();
      reachable.forEach((cell, index) => {
        const info = cellInfo(cell.c, cell.r);
        matrix.makeScale(0.72, 0.09, 0.72);
        matrix.setPosition(worldX(cell.c), rise(info?.elevationFt || 0) + 0.105, worldZ(cell.r));
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; mesh.renderOrder = 38; mesh.userData.sharedGeometry = true;
      selectionRoot.add(mesh);
    }
  }
  const selectedCells = [];
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info) continue;
    if (state.layoutSpaces.includes(info.space) || state.layoutPassage === info.corridor) selectedCells.push({ c, r, info });
  }
  selectedCells.forEach((cell) => {
    const area = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.82), mats.select);
    area.rotation.x = -Math.PI / 2;
    area.position.set(worldX(cell.c), rise(cell.info.elevationFt) + 0.085, worldZ(cell.r));
    area.renderOrder = 39;
    selectionRoot.add(area);
  });
  const previewCells = state.linePreview.concat(state.roomPreview ? roomPreviewCells() : []);
  previewCells.forEach((cell) => {
    const info = cellInfo(cell.c, cell.r);
    const y = rise(info?.elevationFt || 0) + 0.11;
    const preview = cell.edge
      ? edgeSelectionMesh(cell.c, cell.r, cell.edge, y, mats.selectAxis)
      : new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76), mats.selectAxis);
    if (!cell.edge) {
      preview.rotation.x = -Math.PI / 2;
      preview.position.set(worldX(cell.c), y, worldZ(cell.r));
      preview.renderOrder = 42;
    }
    selectionRoot.add(preview);
  });
  if (!state.selected) {
    positionBuildHandles();
    return;
  }
  const info = cellInfo(state.selected.c, state.selected.r);
  if (!info) {
    positionBuildHandles();
    return;
  }
  const selectedY = (isDiscovered(info.region) ? rise(info.elevationFt) : 0) + 0.09;
  const mesh = state.selected.edge
    ? edgeSelectionMesh(state.selected.c, state.selected.r, state.selected.edge, selectedY, mats.select)
    : new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mats.select);
  if (!state.selected.edge) {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldX(state.selected.c), selectedY, worldZ(state.selected.r));
    mesh.renderOrder = 40;
  }
  selectionRoot.add(mesh);
  const item = explicitArchitectureAt(state.selected.c, state.selected.r, state.selected.edge);
  if (item && ["wall", "lowWall", "door"].includes(item.kind)) {
    const axis = new THREE.Mesh(selectionAxisGeometry, mats.selectAxis);
    axis.position.copy(mesh.position);
    axis.position.y += 0.035;
    axis.rotation.y = ["E", "W"].includes(BP.normalizeEdge(item.edge))
      ? Math.PI / 2
      : (BP.normalizeRotation(item.rotation) % 180 === 0 ? 0 : Math.PI / 2);
    axis.renderOrder = 41;
    axis.userData.sharedGeometry = true;
    selectionRoot.add(axis);
  }
  positionBuildHandles();
}
function requestRender(duration = 0) {
  state.renderUntil = Math.max(state.renderUntil, performance.now() + duration);
  state.lastActivity = performance.now();
  ui.idleStatus.textContent = "rendering";
  if (state.renderPending) return;
  state.renderPending = true;
  requestAnimationFrame(renderFrame);
}
function animateReveals(now) {
  let active = false;
  state.chunks.forEach((group) => {
    if (!group.userData.revealStart) return;
    const t = Math.min(1, (now - group.userData.revealStart) / 420);
    const eased = 1 - Math.pow(1 - t, 3);
    group.position.y = -0.45 * (1 - eased);
    if (t < 1) active = true;
    else group.userData.revealStart = 0;
  });
  return active;
}
function renderFrame(now) {
  state.renderPending = false;
  const started = performance.now();
  const animating = animateReveals(now);
  renderer.render(scene, camera);
  state.lastFrameMs = performance.now() - started;
  updateMetrics();
  if (animating || now < state.renderUntil) {
    state.renderPending = true;
    requestAnimationFrame(renderFrame);
  } else {
    ui.idleStatus.textContent = "idle · loop stopped";
    ui.idleStatus.className = "status good";
  }
}

function resize() {
  const rect = ui.threeStage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
  sizeScrawl();
  positionBuildHandles();
  requestRender();
}
function applyQuality(key) {
  state.quality = QUALITY[key] ? key : "balanced";
  const profile = QUALITY[state.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatio));
  renderer.shadowMap.enabled = profile.shadows;
  sun.castShadow = profile.shadows;
  sun.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  scene.fog.density = state.quality === "cinematic" ? 0.028 : (state.quality === "basic" ? 0.018 : 0.024);
  document.querySelectorAll("[data-quality]").forEach((button) => button.classList.toggle("active", button.dataset.quality === state.quality));
  if (state.chunks.size) rebuildAll();
  else buildLights();
  resize();
}

function updateMetrics() {
  const info = renderer.info;
  ui.metricCalls.textContent = info.render.calls.toLocaleString();
  ui.metricTriangles.textContent = info.render.triangles.toLocaleString();
  ui.metricTextures.textContent = info.memory.textures.toLocaleString();
  ui.metricFrame.textContent = state.lastFrameMs.toFixed(2) + " ms";
  ui.metricChunks.textContent = state.chunks.size + " / " + BP.chunkCount(state.blueprint);
  ui.metricCells.textContent = (state.map.cols * state.map.rows).toLocaleString();
}
function audit() {
  const valid = BP.validateMap(state.map);
  const connectivity = BP.tacticalConnectivity(state.map);
  ui.contractStatus.textContent = valid.ok ? "field valid" : "field invalid";
  ui.contractStatus.className = "status " + (valid.ok ? "good" : "bad");
  ui.connectivityStatus.textContent = connectivity.ok ? "connected" : connectivity.reason || connectivity.missing.length + " isolated";
  ui.connectivityStatus.className = "status " + (connectivity.ok ? "good" : "bad");
}

function sizeScrawl() {
  [ui.scrawlStage, ui.artworkStage].forEach((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
  });
  drawScrawl();
  drawArtwork();
}
function scrawlColor(materialKey) {
  return {
    nave: "#b8ae98", cloister: "#7e8a70", crypt: "#7a858a",
    timber: "#846b4f", water: "#557d83"
  }[materialKey] || "#aaa18d";
}
function drawSourceStudy(ctx, cell, ox, oy, force = false) {
  if (!force && (!state.sourceUnderlay || state.blueprint.source?.kind !== "imported")) return;
  ctx.save();
  if (importedUnderlayImage) {
    ctx.fillStyle = "#171c19";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalAlpha = 1;
    ctx.drawImage(
      importedUnderlayImage,
      ox, oy,
      state.map.cols * cell,
      state.map.rows * cell
    );
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#b0a68e";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info) continue;
    const tone = (c * 19 + r * 37) % 4;
    ctx.fillStyle = ["#c9bfa4", "#bfb59a", "#aea88e", "#d0c5aa"][tone];
    ctx.globalAlpha = 0.76;
    ctx.fillRect(ox + c * cell - 0.6, oy + r * cell - 0.6, cell + 1.2, cell + 1.2);
    if ((c * 11 + r * 7) % 9 === 0) {
      ctx.strokeStyle = "rgba(75,70,56,.32)";
      ctx.lineWidth = Math.max(1, cell * 0.08);
      ctx.beginPath();
      ctx.moveTo(ox + c * cell, oy + (r + 0.8) * cell);
      ctx.lineTo(ox + (c + 0.7) * cell, oy + r * cell);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 0.24;
  ctx.fillStyle = "#657b59";
  ctx.beginPath();
  ctx.arc(ox + 23 * cell, oy + 7 * cell, cell * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawCalibratedGrid(ctx, ox, oy, mapWidth, mapHeight) {
  if (!state.gridVisible) return;
  const cal = state.calibration;
  const sx = mapWidth / cal.nativeW, sy = mapHeight / cal.nativeH;
  ctx.save();
  ctx.strokeStyle = "rgba(245,226,169,.52)";
  ctx.lineWidth = Math.max(1, Math.min(mapWidth, mapHeight) * 0.0014);
  ctx.beginPath();
  for (let x = cal.originX; x <= cal.nativeW; x += cal.cellPx) {
    ctx.moveTo(ox + x * sx, oy);
    ctx.lineTo(ox + x * sx, oy + mapHeight);
  }
  for (let y = cal.originY; y <= cal.nativeH; y += cal.cellPx) {
    ctx.moveTo(ox, oy + y * sy);
    ctx.lineTo(ox + mapWidth, oy + y * sy);
  }
  ctx.stroke();
  ctx.restore();
}
function drawAreaOverlay(ctx, cell, ox, oy) {
  if (!state.areaHighlight || !state.areaFocus) return;
  const selected = state.blueprint.discoveryRegions.find((region) => region.id === state.areaFocus);
  const cells = [];
  ctx.save();
  ctx.fillStyle = "rgba(238,194,93,.26)";
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info || info.region !== state.areaFocus) continue;
    cells.push({ c, r });
    ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
  }
  cells.forEach(({ c, r }) => {
    const x = ox + c * cell, y = oy + r * cell;
    [
      { dc: 0, dr: -1, a: [x, y], b: [x + cell, y] },
      { dc: 1, dr: 0, a: [x + cell, y], b: [x + cell, y + cell] },
      { dc: 0, dr: 1, a: [x + cell, y + cell], b: [x, y + cell] },
      { dc: -1, dr: 0, a: [x, y + cell], b: [x, y] }
    ].forEach((edge) => {
      const nc = c + edge.dc, nr = r + edge.dr;
      const neighbor = nc >= 0 && nr >= 0 && nc < state.map.cols && nr < state.map.rows ? cellInfo(nc, nr) : null;
      if (neighbor?.region === state.areaFocus) return;
      const connected = !!neighbor?.region;
      ctx.strokeStyle = connected ? "#f4c960" : "rgba(111,87,38,.76)";
      ctx.lineWidth = Math.max(2, cell * (connected ? 0.18 : 0.1));
      ctx.beginPath(); ctx.moveTo(edge.a[0], edge.a[1]); ctx.lineTo(edge.b[0], edge.b[1]); ctx.stroke();
    });
  });
  BP.areaSummary(state.blueprint, state.areaFocus).thresholds.forEach((threshold) => {
    const mx = ox + threshold.markerC * cell, my = oy + threshold.markerR * cell, d = Math.max(3, cell * 0.17);
    ctx.fillStyle = "#f8df91";
    ctx.beginPath(); ctx.moveTo(mx, my - d); ctx.lineTo(mx + d, my); ctx.lineTo(mx, my + d); ctx.lineTo(mx - d, my); ctx.closePath(); ctx.fill();
  });
  if (cells.length && selected) {
    const cx = cells.reduce((sum, value) => sum + value.c + 0.5, 0) / cells.length;
    const cy = cells.reduce((sum, value) => sum + value.r + 0.5, 0) / cells.length;
    const label = selected.label.toUpperCase();
    ctx.font = "bold " + Math.max(10, cell * 0.48) + "px Arial";
    const width = ctx.measureText(label).width + cell * 0.8;
    ctx.fillStyle = "rgba(18,23,21,.88)";
    ctx.fillRect(ox + cx * cell - width / 2, oy + cy * cell - cell * 0.55, width, cell * 0.82);
    ctx.fillStyle = "#f8df91";
    ctx.textAlign = "center";
    ctx.fillText(label, ox + cx * cell, oy + cy * cell);
    ctx.textAlign = "left";
  }
  ctx.restore();
}
function drawCanvasFlags(ctx, cell, ox, oy) {
  state.groups.forEach((group) => {
    if (!group.anchor) return;
    const info = cellInfo(group.anchor.c, group.anchor.r);
    if (!info || !isDiscovered(info.region)) return;
    const x = ox + (group.anchor.c + 0.5) * cell, y = oy + (group.anchor.r + 0.5) * cell;
    ctx.save();
    ctx.strokeStyle = "#3d3328"; ctx.lineWidth = Math.max(1, cell * 0.11);
    ctx.beginPath(); ctx.moveTo(x, y + cell * 0.34); ctx.lineTo(x, y - cell * 0.38); ctx.stroke();
    ctx.fillStyle = group.role === "party" ? "#c99a38" : (group.role === "ally" ? "#4f8a72" : "#a14c43");
    ctx.beginPath(); ctx.moveTo(x, y - cell * 0.38); ctx.lineTo(x + cell * 0.43, y - cell * 0.23);
    ctx.lineTo(x + cell * 0.12, y - cell * 0.04); ctx.lineTo(x, y + cell * 0.06); ctx.closePath(); ctx.fill();
    ctx.restore();
  });
}
function roomPreviewCells() {
  if (!state.roomPreview) return [];
  const minC = Math.min(state.roomPreview.from.c, state.roomPreview.to.c);
  const maxC = Math.max(state.roomPreview.from.c, state.roomPreview.to.c);
  const minR = Math.min(state.roomPreview.from.r, state.roomPreview.to.r);
  const maxR = Math.max(state.roomPreview.from.r, state.roomPreview.to.r);
  const cells = [];
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) cells.push({ c, r });
  return cells;
}
function drawCanvasEdge(ctx, cell, ox, oy, value) {
  const edge = BP.normalizeEdge(value.edge);
  const x = ox + value.c * cell, y = oy + value.r * cell;
  ctx.beginPath();
  if (edge === "N") { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
  if (edge === "E") { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
  if (edge === "S") { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
  if (edge === "W") { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
  ctx.stroke();
}
function drawCanvasSelection(ctx, cell, ox, oy) {
  ctx.save();
  ctx.fillStyle = "rgba(238,194,93,.23)";
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info || !state.layoutSpaces.includes(info.space) && state.layoutPassage !== info.corridor) continue;
    ctx.fillRect(ox + c * cell + 1, oy + r * cell + 1, cell - 2, cell - 2);
  }
  ctx.fillStyle = "rgba(255,220,119,.52)";
  state.linePreview.concat(roomPreviewCells()).forEach((value) => {
    if (value.edge) {
      ctx.strokeStyle = "rgba(255,220,119,.92)";
      ctx.lineWidth = Math.max(3, cell * 0.24);
      drawCanvasEdge(ctx, cell, ox, oy, value);
    } else {
      ctx.fillRect(ox + value.c * cell + 2, oy + value.r * cell + 2, cell - 4, cell - 4);
    }
  });
  if (state.selected) {
    ctx.strokeStyle = "#f2d27c";
    ctx.lineWidth = Math.max(2, cell * 0.16);
    if (state.selected.edge) drawCanvasEdge(ctx, cell, ox, oy, state.selected);
    else ctx.strokeRect(ox + state.selected.c * cell + 1, oy + state.selected.r * cell + 1, cell - 2, cell - 2);
  }
  ctx.restore();
}
function drawArtwork() {
  const canvas = ui.artworkStage, ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#171c19"; ctx.fillRect(0, 0, width, height);
  const pad = Math.min(width, height) * 0.065;
  const cell = Math.min((width - pad * 2) / state.map.cols, (height - pad * 2) / state.map.rows);
  const ox = (width - state.map.cols * cell) / 2, oy = (height - state.map.rows * cell) / 2;
  state.artworkTransform = { cell, ox, oy };
  if (importedUnderlayImage) {
    drawSourceStudy(ctx, cell, ox, oy, true);
  } else {
    ctx.save();
    ctx.beginPath();
    for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
      const info = cellInfo(c, r);
      if (!isAuthoringVisible(info)) continue;
      ctx.rect(ox + c * cell, oy + r * cell, cell + 0.5, cell + 0.5);
    }
    ctx.clip();
    drawSourceStudy(ctx, cell, ox, oy, true);
    ctx.restore();
  }
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!isAuthoringVisible(info)) continue;
    const x = ox + c * cell, y = oy + r * cell;
    ctx.strokeStyle = "rgba(49,46,38,.86)"; ctx.lineWidth = Math.max(1.5, cell * 0.16);
    boundaryEdges(c, r).forEach((side) => {
      ctx.beginPath();
      if (side === "n") { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (side === "e") { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (side === "s") { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (side === "w") { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      ctx.stroke();
    });
    explicitArchitectureItemsAt(c, r).forEach((item) => drawScrawlArchitecture(ctx, item, x, y, cell));
  }
  drawScrawlProps(ctx, cell, ox, oy);
  drawCalibratedGrid(ctx, ox, oy, state.map.cols * cell, state.map.rows * cell);
  drawAreaOverlay(ctx, cell, ox, oy);
  drawScrawlSpawns(ctx, cell, ox, oy);
  drawCanvasFlags(ctx, cell, ox, oy);
  drawCanvasSelection(ctx, cell, ox, oy);
  ctx.fillStyle = "rgba(233,226,209,.78)";
  ctx.font = Math.max(11, cell * 0.6) + "px Georgia";
  ctx.fillText("ARTWORK · " + state.blueprint.name, ox, Math.max(18, oy - cell * 0.7));
}
function drawScrawl() {
  const canvas = ui.scrawlStage, ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#d7cfba"; ctx.fillRect(0, 0, width, height);
  const pad = Math.min(width, height) * 0.065;
  const cell = Math.min((width - pad * 2) / state.map.cols, (height - pad * 2) / state.map.rows);
  const ox = (width - state.map.cols * cell) / 2, oy = (height - state.map.rows * cell) / 2;
  state.scrawlTransform = { cell, ox, oy };
  drawSourceStudy(ctx, cell, ox, oy);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info) continue;
    const discovered = isDiscovered(info.region);
    ctx.fillStyle = discovered ? scrawlColor(info.material) : "#8b8b84";
    ctx.globalAlpha = discovered ? (state.sourceUnderlay && state.blueprint.source?.kind === "imported" ? 0.5 : 0.88) : 0.48;
    ctx.fillRect(ox + c * cell, oy + r * cell, cell + 0.4, cell + 0.4);
    if (!discovered) {
      ctx.strokeStyle = "rgba(53,58,55,.24)"; ctx.lineWidth = Math.max(1, cell * 0.06);
      ctx.beginPath(); ctx.moveTo(ox + c * cell, oy + (r + 1) * cell); ctx.lineTo(ox + (c + 1) * cell, oy + r * cell); ctx.stroke();
    } else if (info.elevationFt) {
      ctx.fillStyle = "rgba(246,231,190,.42)";
      ctx.fillRect(ox + c * cell + cell * 0.1, oy + r * cell + cell * 0.1, cell * 0.8, cell * 0.8);
    }
  }
  ctx.globalAlpha = 1;
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!isAuthoringVisible(info)) continue;
    const x = ox + c * cell, y = oy + r * cell;
    ctx.strokeStyle = "#3f4541"; ctx.lineWidth = Math.max(1.4, cell * 0.12);
    boundaryEdges(c, r).forEach((side) => {
      ctx.beginPath();
      if (side === "n") { ctx.moveTo(x, y); ctx.lineTo(x + cell, y); }
      if (side === "e") { ctx.moveTo(x + cell, y); ctx.lineTo(x + cell, y + cell); }
      if (side === "s") { ctx.moveTo(x, y + cell); ctx.lineTo(x + cell, y + cell); }
      if (side === "w") { ctx.moveTo(x, y); ctx.lineTo(x, y + cell); }
      ctx.stroke();
    });
    explicitArchitectureItemsAt(c, r).forEach((item) => drawScrawlArchitecture(ctx, item, x, y, cell));
  }
  drawScrawlProps(ctx, cell, ox, oy);
  drawCalibratedGrid(ctx, ox, oy, state.map.cols * cell, state.map.rows * cell);
  drawAreaOverlay(ctx, cell, ox, oy);
  drawScrawlSpawns(ctx, cell, ox, oy);
  drawCanvasFlags(ctx, cell, ox, oy);
  drawCanvasSelection(ctx, cell, ox, oy);
  ctx.fillStyle = "rgba(44,48,45,.72)";
  ctx.font = Math.max(11, cell * 0.6) + "px Georgia";
  ctx.fillText("BLUEPRINT · " + state.blueprint.name, ox, Math.max(18, oy - cell * 0.7));
}
function drawScrawlArchitecture(ctx, item, x, y, cell) {
  const edge = BP.normalizeEdge(item.edge);
  const horizontal = BP.normalizeRotation(item.rotation) % 180 === 0;
  ctx.save();
  if (edge) {
    const points = {
      N: [x + cell * 0.06, y, x + cell * 0.94, y],
      E: [x + cell, y + cell * 0.06, x + cell, y + cell * 0.94],
      S: [x + cell * 0.06, y + cell, x + cell * 0.94, y + cell],
      W: [x, y + cell * 0.06, x, y + cell * 0.94]
    }[edge];
    ctx.strokeStyle = item.kind === "door" ? "#674932" : item.kind === "lowWall" ? "#b08e4d" : "#3e4541";
    ctx.lineWidth = Math.max(2, cell * (item.kind === "lowWall" ? 0.16 : item.kind === "door" ? 0.18 : 0.28));
    ctx.beginPath();
    if (item.kind === "door") {
      const mx = (points[0] + points[2]) / 2, my = (points[1] + points[3]) / 2;
      ctx.moveTo(points[0], points[1]);
      ctx.lineTo(points[0] + (mx - points[0]) * 0.58, points[1] + (my - points[1]) * 0.58);
      ctx.moveTo(points[2], points[3]);
      ctx.lineTo(points[2] + (mx - points[2]) * 0.58, points[3] + (my - points[3]) * 0.58);
    } else {
      ctx.moveTo(points[0], points[1]);
      ctx.lineTo(points[2], points[3]);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (item.kind === "door" || item.kind === "arch") {
    ctx.strokeStyle = item.kind === "door" ? "#674932" : "#9d8958";
    ctx.lineWidth = Math.max(2, cell * 0.18);
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(x + cell * 0.18, y + cell * 0.5); ctx.lineTo(x + cell * 0.82, y + cell * 0.5); }
    else { ctx.moveTo(x + cell * 0.5, y + cell * 0.18); ctx.lineTo(x + cell * 0.5, y + cell * 0.82); }
    ctx.stroke();
  } else if (item.kind === "lowWall" || item.kind === "wall" || item.kind === "window") {
    ctx.strokeStyle = item.kind === "lowWall" ? "#b08e4d" : "#3e4541";
    ctx.lineWidth = Math.max(2, cell * (item.kind === "lowWall" ? 0.16 : 0.28));
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(x + cell * 0.1, y + cell * 0.5); ctx.lineTo(x + cell * 0.9, y + cell * 0.5); }
    else { ctx.moveTo(x + cell * 0.5, y + cell * 0.1); ctx.lineTo(x + cell * 0.5, y + cell * 0.9); }
    ctx.stroke();
  } else if (item.kind === "stairs") {
    ctx.strokeStyle = "#635f56"; ctx.lineWidth = 1;
    for (let i = 2; i <= 8; i += 2) {
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(x + cell * 0.1, y + cell * i / 10); ctx.lineTo(x + cell * 0.9, y + cell * i / 10); }
      else { ctx.moveTo(x + cell * i / 10, y + cell * 0.1); ctx.lineTo(x + cell * i / 10, y + cell * 0.9); }
      ctx.stroke();
    }
  }
  ctx.restore();
}
function drawScrawlProps(ctx, cell, ox, oy) {
  (state.blueprint.props || []).forEach((item) => {
    const info = cellInfo(item.c, item.r);
    if (!isAuthoringVisible(info)) return;
    const x = ox + (item.c + 0.5) * cell, y = oy + (item.r + 0.5) * cell;
    ctx.fillStyle = item.kind === "pool" ? "#4d7d83" : (item.kind === "brazier" ? "#bd7846" : "#625e55");
    ctx.beginPath();
    if (item.kind === "crates") ctx.rect(x - cell * 0.22, y - cell * 0.22, cell * 0.44, cell * 0.44);
    else ctx.arc(x, y, cell * (item.kind === "pillar" ? 0.22 : 0.18), 0, Math.PI * 2);
    ctx.fill();
  });
}
function drawScrawlSpawns(ctx, cell, ox, oy) {
  runtimeSpawns().forEach((item) => {
    const info = cellInfo(item.c, item.r);
    if (!info || !isDiscovered(info.region)) return;
    ctx.fillStyle = item.side === "pc" ? "#56827e" : "#aa4e43";
    ctx.strokeStyle = "#ece1c8"; ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath(); ctx.arc(ox + (item.c + 0.5) * cell, oy + (item.r + 0.5) * cell, cell * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
}

function setView(view) {
  state.view = ["artwork", "board", "blueprint"].includes(view) ? view : "board";
  ui.threeStage.style.display = state.view === "board" ? "block" : "none";
  ui.artworkStage.style.display = state.view === "artwork" ? "block" : "none";
  ui.scrawlStage.style.display = state.view === "blueprint" ? "block" : "none";
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  if (state.view === "board") resize();
  else sizeScrawl();
  positionBuildHandles();
}
const WORKFLOW_COPY = {
  map: "Shape the battlefield directly. Layout, appearance, objects, and reveal areas share one selection.",
  source: "Choose how this battlefield begins.",
  structure: "Confirm the map’s structure, then build directly on it.",
  dress: "Give the structure a material and furnishing language.",
  encounter: "Stage creatures, discovery, and the reveal sequence.",
  present: "Choose how this location should read at the table."
};
function setWorkflow(workflow, preserveView = false) {
  if (!WORKFLOW_COPY[workflow]) return;
  state.workflow = workflow;
  if (workflow !== "map" && state.mode === "build") setMode("browse");
  state.areaHighlight = workflow === "map" && state.mapTab === "areas";
  document.querySelectorAll("[data-workflow]").forEach((button) => button.classList.toggle("active", button.dataset.workflow === workflow));
  document.querySelectorAll("[data-workflow-page]").forEach((page) => {
    const active = page.dataset.workflowPage === workflow;
    page.hidden = !active;
    page.classList.toggle("active", active);
  });
  ui.workflowStatus.textContent = WORKFLOW_COPY[workflow];
  const workbench = document.querySelector(".workbench");
  if (workbench) workbench.scrollTop = 0;
  buildAreaOverlay();
  drawScrawl();
  drawArtwork();
  updateAreaInspector();
  if (workflow === "present") renderLocalCombat();
  requestRender();
}
function setMapTab(tab) {
  state.mapTab = ["layout", "appearance", "objects", "areas"].includes(tab) ? tab : "layout";
  document.querySelectorAll("[data-map-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mapTab === state.mapTab);
  });
  document.querySelectorAll("[data-map-tab-page]").forEach((page) => {
    const active = page.dataset.mapTabPage === state.mapTab;
    page.hidden = !active;
    page.classList.toggle("active", active);
  });
  state.areaHighlight = state.mapTab === "areas" && state.layoutSpaces.length > 0;
  if (state.areaHighlight) {
    const space = state.blueprint.spaces.find((item) => item.id === state.layoutSpaces[0]);
    state.areaFocus = space?.discoveryRegion || state.areaFocus;
  }
  buildAreaOverlay();
  drawScrawl();
  drawArtwork();
  syncBuildBrushContext();
  updateDirectUI();
  requestRender();
}
function syncBuildBrushContext() {
  if (!ui.buildBrushRail) return;
  const labels = { layout: "Layout", appearance: "Appearance", objects: "Objects", areas: "Areas" };
  const hints = {
    layout: "Shape the map here. Right-click for the radial layout tools.",
    appearance: "Choose a room, then change its material or elevation.",
    objects: "Choose an object here, then click any DM-visible playable square.",
    areas: "Choose one or more rooms. This changes player reveal grouping only."
  };
  ui.brushTitle.textContent = "Build · " + (labels[state.mapTab] || "Layout");
  ui.brushContextHint.textContent = hints[state.mapTab] || hints.layout;
  ui.buildBrushRail.querySelectorAll("[data-brush-context]").forEach((button) => {
    button.hidden = button.dataset.brushContext !== state.mapTab;
  });
}
function activateLayoutTool(kind) {
  if (state.workflow === "map" && state.mapTab !== "layout") setMapTab("layout");
  setLayoutTool(kind);
}
function sourceSummary() {
  const source = state.blueprint.source || { kind: "fixture", label: "Topology study" };
  if (source.kind === "seeded") return {
    title: source.label + " · Seed " + source.seed,
    detail: source.generator + " · " + state.blueprint.topology
  };
  if (source.kind === "imported") return {
    title: source.label + " · " + source.sourceName,
    detail: source.interpretation
      ? source.interpretation.engine + " · " + source.interpretation.scene
      : source.sourceRights + " · confirmation required"
  };
  if (source.kind === "blank") return {
    title: source.label + " · Untitled Battlefield",
    detail: state.blueprint.spaces.length ? "DM-drawn structure" : "Zero rooms · first room required"
  };
  return { title: "Topology study · " + state.blueprint.name, detail: "forge-blueprint/v1 · Forge Combat fixture" };
}
function loadImportedUnderlay() {
  importedUnderlayImage = null;
  const source = state.blueprint.source || {};
  if (!source.underlayKey) return;
  let imageData = null;
  try {
    imageData = source.underlayStorage === "local"
      ? localStorage.getItem(source.underlayKey)
      : sessionStorage.getItem(source.underlayKey);
    if (!imageData) imageData = sessionStorage.getItem(source.underlayKey) || localStorage.getItem(source.underlayKey);
  } catch (error) {
    imageData = null;
  }
  if (!imageData) return;
  const image = new Image();
  image.onload = () => {
    importedUnderlayImage = image;
    drawScrawl();
    drawArtwork();
  };
  image.src = imageData;
}
function updateSourceReceipt() {
  const summary = sourceSummary();
  const valid = BP.validateMap(state.map);
  const connected = BP.tacticalConnectivity(state.map);
  ui.sourceReceipt.textContent = summary.title;
  ui.sourceReceiptDetail.textContent = "forge-blueprint/v1 · "
    + (connected.ok ? "connected" : connected.reason || "needs repair") + " · "
    + (valid.ok ? "field valid" : "field invalid") + " · " + summary.detail
    + (state.handoff ? " · received " + state.handoff.fingerprint : "");
}
function renderReviewFindings() {
  ui.reviewFindings.replaceChildren();
  const source = state.blueprint.source || {};
  const findings = Array.isArray(source.review) ? source.review : [];
  ui.toggleUnderlay.disabled = !source.underlay;
  ui.toggleUnderlay.textContent = source.underlay
    ? (state.sourceUnderlay ? "Hide source underlay" : "Show source underlay")
    : "Source underlay unavailable";
  ui.acceptAllFindings.disabled = !findings.some((finding) => !finding.accepted);
  if (!findings.length) {
    const message = document.createElement("p");
    message.textContent = "No uncertain import findings. This Blueprint is ready to edit.";
    ui.reviewFindings.appendChild(message);
    return;
  }
  findings.forEach((finding) => {
    const row = document.createElement("div");
    row.className = "finding" + (finding.accepted ? " accepted" : "");
    const title = document.createElement("strong");
    title.textContent = finding.label;
    const detail = document.createElement("small");
    detail.textContent = Math.round(finding.confidence * 100) + "% proposal confidence";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = finding.accepted ? "Accepted" : "Confirm";
    button.disabled = finding.accepted;
    button.addEventListener("click", () => {
      state.blueprint = BP.acceptImportFinding(state.blueprint, finding.id);
      state.themeBase = BP.copy(state.blueprint);
      refreshDocument();
      renderReviewFindings();
      updateSourceReceipt();
      recordHistory("Import finding confirmed");
    });
    row.append(title, detail, button);
    ui.reviewFindings.appendChild(row);
  });
}
function useBlueprint(blueprint, handoff = null) {
  state.fight = null;
  state.fightTarget = null;
  document.querySelector(".stage-shell")?.classList.remove("fight-active");
  state.blueprint = BP.copy(blueprint);
  state.handoff = handoff ? BP.copy(handoff) : null;
  state.themeBase = BP.copy(blueprint);
  state.fixtureKey = state.blueprint.source?.fixtureKey || "custom";
  state.areaFocus = state.blueprint.discoveryRegions[0]?.id || "";
  state.areaHighlight = false;
  state.edits = {};
  state.selected = null;
  state.layoutSpaces = [];
  state.layoutPassage = null;
  state.buildAnchor = null;
  state.sourceUnderlay = !!state.blueprint.source?.underlay;
  loadImportedUnderlay();
  state.discovered = new Set(state.blueprint.discoveryRegions.map((region) => region.id));
  document.querySelectorAll("[data-fixture]").forEach((button) => button.classList.toggle("active", button.dataset.fixture === state.fixtureKey));
  updateRegionControls();
  refreshDocument();
  state.groups = defaultGroups();
  renderReviewFindings();
  if (state.rosterCandidates.length) syncRosterGroups(); else renderDeploymentGroups();
  renderLocalCombat();
  updateSourceReceipt();
  setLayoutTool("select");
  setRotation(0, false);
  rebuildAll();
  frameBoard();
  setMode("browse");
  resetHistory();
  setWorkflow("map");
}
function openBlankBuild(size = "medium") {
  useBlueprint(BP.produceBlank({ size }));
  setMapTab("layout");
  setView("blueprint");
  setMode("build");
  setLayoutTool("room");
  ui.layoutToolGuidance.innerHTML = "<strong>Room:</strong> This grid is genuinely empty. Drag the first room; the tactical field will remain unavailable until playable floor exists.";
  ui.chunkStatus.textContent = "first room required";
  ui.chunkStatus.className = "status bad";
}
function drawCreationPreview(canvas, blueprint) {
  const context = canvas.getContext("2d"), width = canvas.width, height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0b1110";
  context.fillRect(0, 0, width, height);
  let map;
  try { map = BP.compile(blueprint, {}); } catch (error) { return; }
  const scale = Math.min((width - 12) / map.cols, (height - 12) / map.rows);
  const left = (width - map.cols * scale) / 2, top = (height - map.rows * scale) / 2;
  const colors = { nave: "#9b927f", cloister: "#657660", crypt: "#687174", timber: "#7c6248", water: "#467783" };
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const index = BP.idx(map.cols, c, r), cell = map.meta.regions[index];
    context.fillStyle = map.wall[index] ? "#202725" : colors[cell?.material] || "#8a816f";
    context.fillRect(left + c * scale, top + r * scale, Math.max(1, scale - .45), Math.max(1, scale - .45));
    if (!map.wall[index] && map.h[index] > 0) {
      context.fillStyle = "rgba(218,187,112," + Math.min(.72, .24 + map.h[index] / 40) + ")";
      context.fillRect(left + c * scale, top + r * scale, Math.max(1, scale - .45), Math.max(1, scale - .45));
    }
  }
}
function stageCreation(blueprint, label, detail) {
  creation.draft = BP.copy(blueprint);
  creation.draftKind = blueprint.source?.kind || "fixture";
  creation.draftLabel = label || blueprint.name;
  creation.draftDetail = detail || blueprint.topology;
  ui.creationSelection.textContent = creation.draftLabel;
  ui.creationSelectionDetail.textContent = creation.draftDetail + " · current battlefield unchanged";
  ui.confirmMapChoice.disabled = false;
}
function renderCreationCandidates() {
  ui.creationCandidateDeck.replaceChildren();
  creation.candidates.forEach((blueprint, index) => {
    const button = document.createElement("button"), canvas = document.createElement("canvas"), copy = document.createElement("span");
    canvas.width = 240; canvas.height = 112;
    const label = blueprint.topology === "linear procession" ? "Processional" : blueprint.topology === "loop / hub" ? "Loop / hub" : "Branching";
    button.type = "button";
    button.className = creation.draft && BP.fingerprint(creation.draft) === BP.fingerprint(blueprint) ? "active" : "";
    copy.innerHTML = "<b>" + label + " direction</b><small>" + blueprint.spaces.length + " rooms · " + BP.structuralFingerprint(blueprint).replace("struct-", "") + "</small>";
    button.append(canvas, copy);
    button.addEventListener("click", () => {
      stageCreation(blueprint, label + " direction", "Seed " + blueprint.source.seed + " · candidate " + (index + 1));
      renderCreationCandidates();
    });
    ui.creationCandidateDeck.appendChild(button);
    drawCreationPreview(canvas, blueprint);
  });
}
function makeCreationCandidates(nextSeed = false) {
  if (nextSeed) ui.creationSeed.value = String((Number(ui.creationSeed.value) || 0) + 1);
  const options = {
    seed: Number(ui.creationSeed.value) || 0,
    topology: ui.creationTopology.value,
    size: ui.creationSize.value,
    density: Number(ui.creationDensity.value),
    verticality: ui.creationVerticality.value
  };
  creation.candidates = [0, 1, 2].map((candidate) => {
    const blueprint = BP.produceSeeded({ ...options, candidate });
    blueprint.source.authoredNote = ui.creationBrief.value.trim();
    return blueprint;
  });
  const fingerprints = creation.candidates.map(BP.structuralFingerprint);
  if (new Set(fingerprints).size !== 3) throw new Error("Generated directions were not structurally distinct.");
  stageCreation(creation.candidates[0], "Generated direction 1", "Seed " + options.seed + " · choose any of the three");
  renderCreationCandidates();
}
function renderCreationTemplates() {
  document.querySelectorAll("[data-creation-template]").forEach((button) => {
    const key = button.dataset.creationTemplate;
    drawCreationPreview(button.querySelector("canvas"), BP.FIXTURES[key]);
    button.classList.toggle("active", creation.draftKind === "fixture" && creation.draft?.source?.fixtureKey === key);
  });
}
function setCreationMethod(method) {
  creation.method = ["generate", "template", "import", "blank"].includes(method) ? method : "generate";
  document.querySelectorAll("[data-creation-method]").forEach((button) => button.classList.toggle("active", button.dataset.creationMethod === creation.method));
  document.querySelectorAll("[data-creation-panel]").forEach((panel) => {
    const active = panel.dataset.creationPanel === creation.method;
    panel.hidden = !active; panel.classList.toggle("active", active);
  });
  if (creation.method === "template") renderCreationTemplates();
}
function openMapCreation() {
  ui.mapCreationDialog.hidden = false;
  document.body.classList.add("creation-open");
  setCreationMethod(creation.method);
  if (!creation.candidates.length) makeCreationCandidates();
}
function closeMapCreation() {
  ui.mapCreationDialog.hidden = true;
  document.body.classList.remove("creation-open");
}
function storeCurrentMapForImport() {
  const key = "forge-combat-return:" + Date.now();
  try {
    const handoff = BP.createHandoff(state.blueprint, {
      armed: state.mode === "build", tool: state.layoutTool, edits: BP.copy(state.edits)
    });
    sessionStorage.setItem(key, JSON.stringify(handoff));
  } catch (error) {
    ui.creationSelection.textContent = "The current map could not be held for return.";
    ui.creationSelectionDetail.textContent = error?.message || "Browser storage is unavailable.";
    return;
  }
  window.location.href = "import.html#return=" + encodeURIComponent(key);
}
function confirmCreatedMap() {
  if (!creation.draft) return;
  const chosen = BP.copy(creation.draft), blank = chosen.source?.kind === "blank";
  closeMapCreation();
  useBlueprint(chosen);
  if (blank) {
    setMapTab("layout"); setView("blueprint"); setMode("build"); setLayoutTool("room");
    ui.layoutToolGuidance.innerHTML = "<strong>Room:</strong> This grid is genuinely empty. Drag the first room; the tactical field will remain unavailable until playable floor exists.";
    ui.chunkStatus.textContent = "first room required"; ui.chunkStatus.className = "status bad";
  }
}
function chooseSource(kind) {
  document.querySelectorAll("[data-source-choice]").forEach((button) => button.classList.toggle("active", button.dataset.sourceChoice === kind));
  document.querySelectorAll("[data-source-detail]").forEach((panel) => {
    const active = panel.dataset.sourceDetail === kind;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
}
function applyThemePreset(theme) {
  const out = BP.copy(state.themeBase || state.blueprint);
  if (theme === "moss") {
    out.spaces.forEach((space, index) => { if (space.material !== "water") space.material = index % 3 === 0 ? "crypt" : "cloister"; });
    out.theme = "mossbound-cloister";
  } else if (theme === "bare") {
    out.spaces.forEach((space) => { space.material = "nave"; });
    out.props = [];
    out.lights = [];
    out.theme = "bare-structure";
  } else {
    out.theme = "ruined-abbey";
  }
  out.elevationZones = out.spaces.map((space) => ({ id: "elevation-" + space.id, polygon: BP.copy(space.polygon), elevationFt: space.elevationFt, material: space.material, discoveryRegion: space.discoveryRegion }));
  out.materialZones = out.spaces.map((space) => ({ id: "material-" + space.id, polygon: BP.copy(space.polygon), material: space.material, discoveryRegion: space.discoveryRegion }));
  state.blueprint = out;
  document.querySelectorAll("[data-theme]").forEach((button) => button.classList.toggle("active", button.dataset.theme === theme));
  refreshDocument();
  rebuildAll();
  recordHistory("Theme changed");
}
function updateRegionControls() {
  const preferred = state.areaFocus || ui.zoneRegion.value;
  ui.zoneRegion.replaceChildren();
  state.blueprint.discoveryRegions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.id; option.textContent = region.label;
    ui.zoneRegion.appendChild(option);
  });
  if (state.blueprint.discoveryRegions.some((region) => region.id === preferred)) ui.zoneRegion.value = preferred;
  state.areaFocus = ui.zoneRegion.value;
  syncZoneValues();
  updateAreaInspector();
}
function syncZoneValues() {
  const region = ui.zoneRegion.value;
  const space = state.blueprint.spaces.find((item) => item.discoveryRegion === region);
  if (!space) return;
  ui.zoneElevation.value = String(space.elevationFt || 0);
  ui.zoneMaterial.value = space.material || "nave";
}
function areaLabel(regionId) {
  return state.blueprint.discoveryRegions.find((region) => region.id === regionId)?.label || regionId;
}
function areaSettings(regionId) {
  return Object.assign({
    dressTogether: true,
    revealTogether: true,
    provenance: "Authored topology study"
  }, state.blueprint.areaSettings?.[regionId] || {});
}
function updateAreaInspector() {
  if (!state.blueprint || !ui.zoneRegion) return;
  const regionId = state.areaFocus || ui.zoneRegion.value;
  const region = state.blueprint.discoveryRegions.find((item) => item.id === regionId);
  if (!region) {
    ui.areaStageLabel.hidden = true;
    return;
  }
  const summary = BP.areaSummary(state.blueprint, regionId);
  const settings = areaSettings(regionId);
  const pendingOpening = (state.blueprint.source?.review || []).find((finding) => finding.id === "openings" && !finding.accepted);
  state.areaFocus = regionId;
  ui.areaName.value = region.label;
  ui.areaProvenance.textContent = settings.provenance;
  ui.areaFootprint.textContent = summary.cellCount + " cells · " + summary.boundaryEdges + " perimeter edges";
  ui.areaDressTogether.checked = settings.dressTogether;
  ui.areaRevealTogether.checked = settings.revealTogether;
  ui.toggleAreaHighlight.classList.toggle("active", state.areaHighlight);
  ui.toggleAreaHighlight.setAttribute("aria-pressed", String(state.areaHighlight));
  ui.toggleAreaHighlight.textContent = state.areaHighlight ? "Hide footprint" : "Show footprint";
  ui.areaBoundaryStatus.textContent = pendingOpening ? "Boundary needs confirmation" : "Boundary derived from membership";
  ui.areaConnectionSummary.textContent = summary.connectionCount + " connected area" + (summary.connectionCount === 1 ? "" : "s")
    + " · " + summary.thresholdCount + " derived threshold" + (summary.thresholdCount === 1 ? "" : "s");
  ui.areaConnections.replaceChildren();
  summary.neighborIds.forEach((neighborId) => {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    const detail = document.createElement("span");
    const thresholdCount = summary.thresholds.filter((threshold) => threshold.neighborId === neighborId).length;
    name.textContent = areaLabel(neighborId);
    detail.textContent = thresholdCount + " threshold" + (thresholdCount === 1 ? "" : "s");
    item.append(name, detail);
    ui.areaConnections.appendChild(item);
  });
  if (!summary.neighborIds.length) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    const detail = document.createElement("span");
    name.textContent = "Self-contained";
    detail.textContent = "no neighboring area membership";
    item.append(name, detail);
    ui.areaConnections.appendChild(item);
  }
  const report = ui.areaBoundaryNote.closest(".boundary-report");
  report?.classList.toggle("warn", !!pendingOpening || !summary.complete);
  ui.areaBoundaryNote.textContent = pendingOpening
    ? "The imported doorway proposal is still unconfirmed. This area remains provisional until Structure confirms it."
    : "Threshold markers are generated wherever adjacent cells belong to different areas. A missing marker cannot silently join them.";
  ui.areaMergeTarget.replaceChildren();
  summary.neighborIds.forEach((neighborId) => {
    const option = document.createElement("option");
    option.value = neighborId;
    option.textContent = areaLabel(neighborId);
    ui.areaMergeTarget.appendChild(option);
  });
  ui.mergeArea.disabled = !summary.neighborIds.length;
  ui.mergeArea.title = summary.neighborIds.length ? "Join this area to the selected neighboring area" : "This area has no neighboring area to merge";
  const stageStrong = ui.areaStageLabel.querySelector("strong");
  const stageSmall = ui.areaStageLabel.querySelector("small");
  if (stageStrong) stageStrong.textContent = region.label;
  if (stageSmall) stageSmall.textContent = summary.cellCount + " cells · boundaries derived";
  ui.areaStageLabel.hidden = !(state.areaHighlight && state.workflow === "dress");
}
function refreshAreaFocus() {
  buildAreaOverlay();
  drawScrawl();
  drawArtwork();
  updateAreaInspector();
  requestRender();
}
function syncHeroButton() {
  const available = state.fixtureKey === "processional" && state.discovered.has("choir");
  ui.focusHero.disabled = !available;
  ui.focusHero.title = available ? "Frame the finished Raised Choir and its threshold" : (
    state.fixtureKey === "processional" ? "Reveal the Raised Choir first" : "The finished hero room is in Processional Abbey"
  );
}
function refreshDocument() {
  state.map = BP.compile(state.blueprint, state.edits);
  const firstRegion = state.blueprint.discoveryRegions[0];
  if (!state.discovered.size && firstRegion) state.discovered.add(firstRegion.id);
  ui.mapName.textContent = state.blueprint.name;
  ui.topologyLabel.textContent = state.blueprint.topology;
  ui.discoveryLabel.textContent = state.discovered.size + " of " + state.blueprint.discoveryRegions.length + " regions discovered";
  syncHeroButton();
  audit();
  updateSourceReceipt();
  drawScrawl();
  drawArtwork();
  updateAreaInspector();
  updateDirectUI();
}
function loadFixture(key) {
  if (!BP.FIXTURES[key]) return;
  state.fight = null;
  state.fightTarget = null;
  document.querySelector(".stage-shell")?.classList.remove("fight-active");
  state.fixtureKey = key;
  state.blueprint = BP.withSource(BP.FIXTURES[key], "fixture", { fixtureKey: key });
  state.themeBase = BP.copy(state.blueprint);
  state.areaFocus = state.blueprint.discoveryRegions[0]?.id || "";
  state.areaHighlight = false;
  state.edits = {};
  state.selected = null;
  state.layoutSpaces = [];
  state.layoutPassage = null;
  state.buildAnchor = null;
  state.sourceUnderlay = false;
  state.discovered = new Set(state.blueprint.discoveryRegions.map((region) => region.id));
  document.querySelectorAll("[data-fixture]").forEach((button) => button.classList.toggle("active", button.dataset.fixture === key));
  updateRegionControls();
  refreshDocument();
  state.groups = defaultGroups();
  renderReviewFindings();
  if (state.rosterCandidates.length) syncRosterGroups(); else renderDeploymentGroups();
  renderLocalCombat();
  setLayoutTool("select");
  setRotation(0, false);
  rebuildAll();
  frameBoard();
  setMode("browse");
  resetHistory();
}
function frameBoard() {
  const span = Math.max(state.blueprint.grid.cols, state.blueprint.grid.rows);
  controls.target.set(0, 0, 0);
  camera.position.set(span * 0.72, span * 0.8, span * 0.9);
  controls.update();
  requestRender();
}
function frameTopDown() {
  if (!state.blueprint) return;
  const span = Math.max(state.blueprint.grid.cols, state.blueprint.grid.rows);
  controls.target.set(0, 0, 0);
  camera.position.set(0, span * 1.48, 0.01);
  controls.update();
  requestRender();
}
function defaultGroups() {
  const regions = state.blueprint.discoveryRegions;
  const first = regions[0], last = regions[regions.length - 1];
  const spawns = state.blueprint.spawns || [];
  const pcs = spawns.filter((spawn) => spawn.side === "pc");
  const foes = spawns.filter((spawn) => spawn.side === "foe");
  return [
    {
      id: "party-main", label: "Main Party", role: "party", formation: "wedge",
      unitIds: pcs.map((spawn) => spawn.key || "Party member"),
      anchor: pcs[0] ? { c: pcs[0].c, r: pcs[0].r } : regionCenter(first?.id),
      seed: 3
    },
    {
      id: "enemy-main", label: "Reliquary Guard", role: "enemy", formation: "cluster",
      unitIds: foes.map((spawn) => spawn.key || "Enemy"),
      anchor: foes[0] ? { c: foes[0].c, r: foes[0].r } : regionCenter(last?.id),
      seed: 7
    }
  ];
}
function regionCenter(regionId) {
  const cells = [];
  state.map?.meta.regions.forEach((info, index) => {
    if (info?.region === regionId && !state.map.wall[index]) cells.push({ c: index % state.map.cols, r: Math.floor(index / state.map.cols) });
  });
  return cells[Math.floor(cells.length / 2)] || null;
}
function authoringSnapshot() {
  return {
    blueprint: BP.copy(state.blueprint),
    themeBase: BP.copy(state.themeBase),
    edits: BP.copy(state.edits),
    discovered: [...state.discovered],
    groups: BP.copy(state.groups),
    calibration: BP.copy(state.calibration),
    gridVisible: state.gridVisible
  };
}
function resetHistory() {
  state.history = BP.historyStart(authoringSnapshot());
  updateHistoryControls();
}
function recordHistory(label) {
  state.history = BP.historyCommit(state.history || BP.historyStart(authoringSnapshot()), label, authoringSnapshot());
  updateHistoryControls();
}
function updateHistoryControls() {
  const canUndo = !!state.history?.past.length, canRedo = !!state.history?.future.length;
  [ui.undoAction, ui.pinnedUndo, ui.brushUndo, ui.radialUndo].forEach((button) => {
    button.disabled = !canUndo;
    button.title = canUndo ? "Undo " + state.history.present.label : "Nothing to undo";
  });
  [ui.redoAction, ui.pinnedRedo, ui.brushRedo, ui.radialRedo].forEach((button) => {
    button.disabled = !canRedo;
    button.title = canRedo ? "Redo " + state.history.future[0].label : "Nothing to redo";
  });
}
function restoreSnapshot(snapshot, direction) {
  state.blueprint = BP.copy(snapshot.blueprint);
  state.themeBase = BP.copy(snapshot.themeBase);
  state.edits = BP.copy(snapshot.edits);
  state.discovered = new Set(snapshot.discovered || []);
  state.groups = BP.copy(snapshot.groups || []);
  state.calibration = BP.normalizeGridCalibration(snapshot.calibration);
  state.gridVisible = snapshot.gridVisible !== false;
  state.selected = null;
  state.layoutSpaces = [];
  state.layoutPassage = null;
  state.buildAnchor = null;
  state.linePreview = [];
  state.roomPreview = null;
  refreshDocument();
  updateRegionControls();
  syncGridControls();
  renderReviewFindings();
  renderDeploymentGroups();
  rebuildAll();
  updateDirectUI();
  ui.massBuildCallout.querySelector("span").textContent = direction + " restored the previous complete map state.";
  ui.chunkStatus.textContent = direction + " · " + state.history.present.label;
  ui.chunkStatus.className = "status good";
  updateHistoryControls();
}
function travelHistory(direction) {
  if (!state.history) return;
  const next = direction === "Undo" ? BP.historyUndo(state.history) : BP.historyRedo(state.history);
  if (!next || next.present === state.history.present) return;
  if (JSON.stringify(next) === JSON.stringify(state.history)) return;
  state.history = next;
  restoreSnapshot(next.present.snapshot, direction);
}
function hideBuildRadial() {
  if (ui.buildRadial) ui.buildRadial.hidden = true;
}
function showBuildRadial(clientX, clientY) {
  if (state.mode !== "build" || !ui.buildRadial) return;
  const shell = document.querySelector(".stage-shell");
  const rect = shell.getBoundingClientRect();
  const x = Math.max(140, Math.min(rect.width - 140, clientX - rect.left));
  const y = Math.max(140, Math.min(rect.height - 140, clientY - rect.top));
  ui.buildRadial.style.left = x + "px";
  ui.buildRadial.style.top = y + "px";
  ui.buildRadial.hidden = false;
}
function setMode(mode) {
  if (mode === "build" && state.fight) {
    ui.chunkStatus.textContent = "Finish or leave the local fight before editing its accepted map snapshot.";
    ui.chunkStatus.className = "status bad";
    return;
  }
  const previousMode = state.mode;
  state.mode = mode === "build" ? "build" : "browse";
  const building = state.mode === "build";
  document.querySelector(".stage-shell")?.classList.toggle("build-mode", building);
  document.querySelector('[data-workflow-page="structure"]')?.classList.toggle("build-armed", building);
  document.querySelector('[data-workflow-page="map"]')?.classList.toggle("build-armed", building);
  ui.buildBrushRail.hidden = !building;
  if (!building) hideBuildRadial();
  controls.mouseButtons.RIGHT = building ? null : THREE.MOUSE.PAN;
  ui.browseMode.classList.toggle("active", !building);
  ui.buildMode.classList.toggle("active", building);
  ui.buildModeInline.classList.toggle("active", building);
  ui.buildModeInline.querySelector("strong").textContent = building ? "Exit Build mode" : "Enter Build mode";
  ui.buildModeInline.querySelector("span").textContent = building ? "Map clicks now place or select architecture." : "Map clicks are safe until this is armed.";
  ui.pinnedBuild.classList.toggle("active", building);
  ui.pinnedBuild.querySelector("span").textContent = building ? "Exit" : "Build";
  ui.modeNarration.innerHTML = building
    ? "<strong>DM authoring view</strong><span>Hidden rooms are visible here but remain hidden from players. Near walls use a solid cutaway.</span>"
    : "<strong>Browse safe</strong><span>Orbit, inspect, or place an armed group flag. Building is off.</span>";
  syncBuildBrushContext();
  updateCutaway();
  if (state.map && previousMode !== state.mode) rebuildAll();
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
}
function setComparison(active) {
  state.compareActive = !!active;
  document.querySelector(".stage-shell")?.classList.toggle("compare-active", state.compareActive);
  ui.compareHold.classList.toggle("active", state.compareActive);
  if (state.compareActive) {
    sizeScrawl();
    ui.modeNarration.innerHTML = "<strong>Source comparison</strong><span>Release to return. Discovery and camera state are unchanged.</span>";
  } else setMode(state.mode);
}
function syncGridControls() {
  ui.gridCellPx.value = state.calibration.cellPx.toFixed(1).replace(/\.0$/, "");
  ui.gridOriginX.value = state.calibration.originX.toFixed(1).replace(/\.0$/, "");
  ui.gridOriginY.value = state.calibration.originY.toFixed(1).replace(/\.0$/, "");
  ui.gridStatus.textContent = state.calibration.cellPx.toFixed(1) + " px · " + state.calibration.cols + "×" + state.calibration.rows;
  ui.gridToggle.classList.toggle("active", state.gridVisible);
  ui.gridToggle.setAttribute("aria-pressed", String(state.gridVisible));
}
function applyGridCalibration(label = "Grid calibrated") {
  state.calibration = BP.normalizeGridCalibration({
    cellPx: Number(ui.gridCellPx.value),
    originX: Number(ui.gridOriginX.value),
    originY: Number(ui.gridOriginY.value),
    nativeW: 784,
    nativeH: 560
  });
  syncGridControls();
  drawScrawl();
  drawArtwork();
  recordHistory(label);
}
function syncGroupSpawns() {
  const spawns = [];
  state.groups.forEach((group) => {
    const positions = BP.formationPositions(state.map, group.anchor, group.unitIds.length, group.seed, group.formation);
    positions.forEach((position, index) => spawns.push({
      c: position.c, r: position.r,
      side: group.role === "enemy" ? "foe" : "pc",
      key: group.unitIds[index] || group.id + "-" + index
    }));
  });
  state.blueprint.spawns = spawns;
  state.themeBase.spawns = BP.copy(spawns);
}
function renderDeploymentGroups() {
  ui.deploymentGroups.replaceChildren();
  state.groups.forEach((group) => {
    const card = document.createElement("section");
    card.className = "deploy-group" + (state.flagPlacement === group.id ? " armed" : "");
    const roleOptions = ["party", "ally", "npc", "enemy"].map((role) =>
      '<option value="' + role + '"' + (group.role === role ? " selected" : "") + ">" + role[0].toUpperCase() + role.slice(1) + "</option>"
    ).join("");
    const safeId = escapeHtml(group.id), safeLabel = escapeHtml(group.label);
    card.innerHTML =
      '<div class="deploy-head"><i class="flag-swatch" style="background:#' + groupColor(group).toString(16).padStart(6, "0") + '"></i><strong>' + safeLabel + '</strong><small>' + (group.anchor ? "ready" : "unresolved") + '</small></div>' +
      '<div class="deploy-fields"><label>Role<select data-group-role="' + safeId + '">' + roleOptions + '</select></label>' +
      '<label>Formation<select data-group-formation="' + safeId + '"><option value="wedge"' + (group.formation === "wedge" ? " selected" : "") + '>Wedge</option><option value="cluster"' + (group.formation === "cluster" ? " selected" : "") + '>Cluster</option><option value="line"' + (group.formation === "line" ? " selected" : "") + '>Line</option></select></label></div>' +
      '<div class="deploy-members">' + group.unitIds.map(escapeHtml).join(" · ") + '</div>' +
      '<div class="deploy-actions"><button class="primary" data-group-flag="' + safeId + '">' + (group.anchor ? "Move flag" : "Place flag") + '</button><button data-group-reseed="' + safeId + '">Reseed</button></div>';
    ui.deploymentGroups.appendChild(card);
  });
  ui.spawnStatus.textContent = state.groups.filter((group) => group.anchor).length + " / " + state.groups.length + " flags placed";
  ui.deploymentGroups.querySelectorAll("[data-group-flag]").forEach((button) => button.addEventListener("click", () => {
    state.flagPlacement = button.dataset.groupFlag;
    setMode("browse");
    setView("board");
    const group = state.groups.find((item) => item.id === state.flagPlacement);
    ui.flagMessage.textContent = "Click a playable cell to place " + group.label + "’s flag. This is flag placement, not Build mode.";
    renderDeploymentGroups();
  }));
  ui.deploymentGroups.querySelectorAll("[data-group-reseed]").forEach((button) => button.addEventListener("click", () => {
    const group = state.groups.find((item) => item.id === button.dataset.groupReseed);
    group.seed = (group.seed + 1) >>> 0;
    syncGroupSpawns();
    refreshDocument();
    rebuildAll();
    renderDeploymentGroups();
    recordHistory(group.label + " formation reseeded");
  }));
  ui.deploymentGroups.querySelectorAll("[data-group-role]").forEach((select) => select.addEventListener("change", () => {
    const group = state.groups.find((item) => item.id === select.dataset.groupRole);
    group.role = select.value;
    syncGroupSpawns();
    refreshDocument();
    rebuildAll();
    renderDeploymentGroups();
    recordHistory(group.label + " role changed");
  }));
  ui.deploymentGroups.querySelectorAll("[data-group-formation]").forEach((select) => select.addEventListener("change", () => {
    const group = state.groups.find((item) => item.id === select.dataset.groupFormation);
    group.formation = select.value;
    group.seed = (group.seed + 3) >>> 0;
    syncGroupSpawns();
    refreshDocument();
    rebuildAll();
    renderDeploymentGroups();
    recordHistory(group.label + " formation changed");
  }));
}
function placeGroupFlag(c, r) {
  const group = state.groups.find((item) => item.id === state.flagPlacement);
  const info = cellInfo(c, r);
  if (!group || !info || state.map.wall[BP.idx(state.map.cols, c, r)]) {
    ui.flagMessage.textContent = "That is not open battlefield ground. The flag remains armed.";
    return;
  }
  group.anchor = { c, r };
  state.flagPlacement = null;
  syncGroupSpawns();
  refreshDocument();
  rebuildAll();
  renderDeploymentGroups();
  ui.flagMessage.textContent = group.label + " placed. Formation resolved around the flag.";
  recordHistory(group.label + " flag placed");
}
function ensureCombatAuth() {
  if (window.__tok?.sb && window.__tok?.ready) return window.__tok;
  if (!window.supabase?.createClient) throw new Error("The character service did not load.");
  const query = new URLSearchParams(window.location.search);
  const client = window.supabase.createClient(
    query.get("url") || "https://cfthwspwpcfamgbfqzuq.supabase.co",
    query.get("key") || "sb_publishable_12KUwzDbVvcar0zjh2KE6g_6IRBfmMJ"
  );
  window.__tok = { sb: client, ready: client.auth.getSession().then(() => true, () => true) };
  return window.__tok;
}
function selectedParty() {
  const selected = new Set(state.selectedPartyKeys);
  return state.rosterCandidates.filter((candidate) => candidate.projection.ok && selected.has(candidate.row.key))
    .map((candidate) => BP.copy(candidate.projection.unit));
}
function syncRosterGroups() {
  const party = state.groups.find((group) => group.id === "party-main" || group.role === "party");
  const enemy = state.groups.find((group) => group.id === "enemy-main" || group.role === "enemy");
  if (party) party.unitIds = state.selectedPartyKeys.slice();
  if (enemy) enemy.unitIds = LocalCombat.TRAINING_FOES.map((unit) => unit.unit);
  renderDeploymentGroups();
}
function updateFightGate(message, bad = false) {
  const ready = selectedParty().length;
  ui.prepareLocalCombat.disabled = !ready;
  ui.combatFightGate.textContent = message || (ready
    ? ready + " real character" + (ready === 1 ? " is" : "s are") + " ready. Three local training guards will provide the opposing side."
    : "Choose at least one combat-ready character. This proof does not create a shared session or write combat results back to a sheet.");
  ui.combatFightGate.className = "fight-gate " + (bad ? "bad" : ready ? "good" : "");
}
function renderCombatRoster() {
  ui.combatRoster.replaceChildren();
  const readyCount = state.rosterCandidates.filter((candidate) => candidate.projection.ok).length;
  ui.combatRosterStatus.textContent = readyCount + " / " + state.rosterCandidates.length + " ready";
  ui.combatRosterStatus.className = "status " + (readyCount ? "good" : "bad");
  if (!state.rosterCandidates.length) {
    const empty = document.createElement("div");
    empty.className = "combat-roster-empty";
    empty.textContent = "No active characters were found in the Campaign Characters folder.";
    ui.combatRoster.appendChild(empty);
    updateFightGate();
    return;
  }
  state.rosterCandidates.forEach((candidate) => {
    const projection = candidate.projection, selected = state.selectedPartyKeys.includes(candidate.row.key);
    const label = document.createElement("label");
    label.className = "combat-character" + (selected ? " selected" : "") + (projection.ok ? "" : " unready");
    const input = document.createElement("input");
    input.type = "checkbox"; input.checked = selected; input.disabled = !projection.ok;
    const copyBlock = document.createElement("span"), title = document.createElement("strong"), detail = document.createElement("small");
    title.textContent = projection.name;
    detail.textContent = projection.ok
      ? projection.unit.hp + "/" + projection.unit.hpMax + " HP · AC " + projection.unit.ac + " · " + projection.unit.speed + " ft · " + projection.unit.action.label
      : projection.reason;
    copyBlock.append(title, detail); label.append(input, copyBlock); ui.combatRoster.appendChild(label);
    input.addEventListener("change", () => {
      const next = new Set(state.selectedPartyKeys);
      if (input.checked) next.add(candidate.row.key); else next.delete(candidate.row.key);
      state.selectedPartyKeys = PartySelection.selectedKeys(state.rosterCandidates.map((item) => item.row), [...next]);
      if (state.fight) {
        state.fight = null; state.fightTarget = null;
        document.querySelector(".stage-shell")?.classList.remove("fight-active");
        rebuildAll(); renderLocalCombat();
      }
      syncRosterGroups(); renderCombatRoster(); updateFightGate();
    });
  });
  updateFightGate();
}
async function loadCombatRoster() {
  ui.combatRosterStatus.textContent = "loading";
  try {
    ensureCombatAuth();
    if (!window.CharacterData) throw new Error("Character authority is unavailable.");
    const [party, layout] = await Promise.all([window.CharacterData.loadParty(), window.CharacterData.loadLayout()]);
    const result = PartySelection.candidates(party, layout);
    if (!result.ok) throw new Error(result.reason);
    state.rosterCandidates = result.rows.map((row) => ({ row, projection: LocalCombat.projectCharacter(row) }));
    state.selectedPartyKeys = PartySelection.selectedKeys(result.rows, state.selectedPartyKeys);
    syncRosterGroups(); renderCombatRoster();
  } catch (error) {
    state.rosterCandidates = []; state.selectedPartyKeys = [];
    ui.combatRosterStatus.textContent = "unavailable";
    ui.combatRosterStatus.className = "status bad";
    ui.combatRoster.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "combat-roster-empty";
    empty.textContent = "The campaign roster could not be read: " + (error?.message || "unknown error") + " Sign in, then reload Forge Combat.";
    ui.combatRoster.appendChild(empty);
    updateFightGate("The real roster is required before this local fight can begin.", true);
  }
}
function fightFinished() {
  if (!state.fight) return false;
  return !state.fight.units.some((unit) => unit.alive && unit.side === "pc") || !state.fight.units.some((unit) => unit.alive && unit.side === "foe");
}
function renderLocalCombat() {
  ui.combatCombatants.replaceChildren(); ui.combatFightLog.replaceChildren();
  if (!state.fight) {
    ui.combatFightStatus.textContent = "not prepared"; ui.combatFightStatus.className = "status";
    ui.combatFightInstruction.textContent = "Choose characters first. Combat will use this exact Blueprint field without changing the authored map.";
    ui.combatTurn.hidden = true; ui.combatAttack.disabled = true; ui.combatEndTurn.disabled = true;
    return;
  }
  const active = LocalCombat.activeUnit(state.fight), finished = fightFinished();
  if (!state.fight.units.some((unit) => unit.unit === state.fightTarget && unit.alive && active && unit.side !== active.side)) state.fightTarget = null;
  ui.combatFightStatus.textContent = finished ? "complete" : "round " + state.fight.round;
  ui.combatFightStatus.className = "status good";
  ui.combatFightInstruction.textContent = finished
    ? "This local proof is complete. No character sheet or shared session was changed."
    : "Click an open highlighted-reachable cell to move. Click an opposing token or combatant row to target it.";
  ui.combatTurn.hidden = false;
  ui.combatTurn.replaceChildren();
  const turnName = document.createElement("strong"), turnDetail = document.createElement("small");
  turnName.textContent = finished ? "Encounter resolved" : active.name + " is active";
  turnDetail.textContent = finished ? "The authored Blueprint remains unchanged." : active.action.label + " · +" + active.action.hit + " to hit · " + active.action.dmg + " · " + active.speed + " ft";
  ui.combatTurn.append(turnName, turnDetail);
  state.fight.units.forEach((unit) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "combat-combatant " + unit.side + (unit === active ? " active" : "") + (unit.unit === state.fightTarget ? " target" : "") + (unit.alive ? "" : " dead");
    const name = document.createElement("span"), facts = document.createElement("small"), hp = document.createElement("b");
    name.textContent = unit.name; facts.textContent = "AC " + unit.ac + " · init " + unit.initiative + " · " + unit.c + "," + unit.r;
    hp.textContent = unit.hp + "/" + unit.hpMax; button.append(name, facts, hp);
    button.disabled = !unit.alive || finished;
    button.addEventListener("click", () => {
      if (!active || unit.side === active.side) return;
      state.fightTarget = unit.unit; renderLocalCombat();
    });
    ui.combatCombatants.appendChild(button);
  });
  state.fight.log.slice(-8).forEach((entry) => {
    const line = document.createElement("p"); line.textContent = entry; ui.combatFightLog.appendChild(line);
  });
  ui.combatFightLog.scrollTop = ui.combatFightLog.scrollHeight;
  ui.combatAttack.disabled = finished || !state.fightTarget || active.acted;
  ui.combatEndTurn.disabled = finished;
}
function prepareLocalCombat() {
  const party = selectedParty();
  if (!party.length) { updateFightGate("Choose at least one combat-ready character first.", true); return; }
  refreshDocument();
  const connectivity = BP.tacticalConnectivity(state.map);
  if (!connectivity.ok) { updateFightGate("The map is not yet a connected tactical field: " + connectivity.reason, true); return; }
  const deployment = LocalCombat.deployCombatants(state.map, party, BP.copy(LocalCombat.TRAINING_FOES), state.groups);
  if (!deployment.ok) { updateFightGate(deployment.errors.join(" "), true); return; }
  const identity = { blueprintId: state.blueprint.id, fingerprint: BP.fingerprint(state.blueprint), structuralFingerprint: BP.structuralFingerprint(state.blueprint) };
  state.fight = LocalCombat.createFight(state.map, deployment, party, BP.copy(LocalCombat.TRAINING_FOES), identity);
  state.fightTarget = null;
  document.querySelector(".stage-shell")?.classList.add("fight-active");
  setWorkflow("present"); setView("board"); frameTopDown(); rebuildAll(); renderLocalCombat();
  ui.chunkStatus.textContent = "Local fight prepared · Blueprint " + identity.fingerprint;
  ui.chunkStatus.className = "status good";
}
function refreshFightBoard(message, ok) {
  rebuildAll(); drawScrawl(); drawArtwork(); renderLocalCombat();
  ui.chunkStatus.textContent = message; ui.chunkStatus.className = "status " + (ok ? "good" : "bad");
}
function fightCellAction(c, r) {
  const active = LocalCombat.activeUnit(state.fight);
  const occupant = state.fight.units.find((unit) => unit.alive && unit.c === c && unit.r === r);
  if (occupant) {
    if (active && occupant.side !== active.side) { state.fightTarget = occupant.unit; renderLocalCombat(); refreshFightBoard(occupant.name + " targeted", true); }
    else refreshFightBoard("That cell is occupied by an ally.", false);
    return;
  }
  const result = LocalCombat.moveActive(state.fight, c, r);
  if (result.ok) state.fight = result.fight;
  refreshFightBoard(result.message, result.ok);
}
function focusHeroRoom() {
  if (state.fixtureKey !== "processional" || !state.discovered.has("choir")) {
    ui.chunkStatus.textContent = state.fixtureKey === "processional" ? "reveal the Raised Choir first" : "hero room belongs to Processional Abbey";
    ui.chunkStatus.className = "status bad";
    return;
  }
  const room = state.blueprint.spaces.find((space) => space.discoveryRegion === "choir");
  const xs = room.polygon.map((point) => point[0]), zs = room.polygon.map((point) => point[1]);
  const centerC = (Math.min(...xs) + Math.max(...xs)) / 2 - 0.5;
  const centerR = (Math.min(...zs) + Math.max(...zs)) / 2 - 0.5;
  const target = new THREE.Vector3(worldX(centerC), rise(room.elevationFt) + 0.35, worldZ(centerR));
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(5.8, 6.6, 7.4));
  controls.update();
  ui.chunkStatus.textContent = "finished Choir framed for review";
  ui.chunkStatus.className = "status good";
  requestRender();
}
function revealNext() {
  const next = state.blueprint.discoveryRegions.find((region) => !state.discovered.has(region.id));
  if (!next) {
    ui.discoveryLabel.textContent = "All regions discovered";
    return;
  }
  state.discovered.add(next.id);
  refreshDocument();
  rebuildRegion(next.id, true);
  ui.discoveryLabel.textContent = state.discovered.size + " of " + state.blueprint.discoveryRegions.length + " regions discovered";
  drawScrawl();
  recordHistory("Room revealed");
}
function resetDiscovery() {
  const first = state.blueprint.discoveryRegions[0];
  state.discovered = new Set(first ? [first.id] : []);
  refreshDocument();
  rebuildAll();
  recordHistory("Player darkness restored");
}
function selectedSpaces() {
  return state.layoutSpaces.map((id) => state.blueprint.spaces.find((space) => space.id === id)).filter(Boolean);
}
function updateDirectUI() {
  const spaces = selectedSpaces();
  const passage = state.blueprint.corridors.find((item) => item.id === state.layoutPassage);
  const selectedArchitecture = state.selected?.edge
    ? explicitArchitectureAt(state.selected.c, state.selected.r, state.selected.edge)
    : null;
  const building = state.mode === "build";
  ui.directBuildStatus.textContent = building ? "Build armed" : "Browse safe";
  ui.directBuildStatus.className = "status " + (building ? "good" : "");
  ui.directBuildMode.classList.toggle("active", building);
  ui.directBuildMode.querySelector("strong").textContent = building ? "Exit Build mode" : "Enter Build mode";
  ui.directBuildMode.querySelector("span").textContent = building
    ? "Map touches now use the selected tool."
    : "Nothing changes until this is armed.";
  const edgePlacement = !!selectedArchitecture && ["wall", "lowWall", "door"].includes(selectedArchitecture.kind);
  ui.directRotationValue.textContent = edgePlacement ? state.selected.edge + " edge" : state.rotation + "°";
  ui.directRotateLeft.disabled = edgePlacement;
  ui.directRotateRight.disabled = edgePlacement;
  ui.directRotateLeft.title = ui.directRotateRight.title = edgePlacement
    ? "This piece follows the clicked square edge."
    : "Rotate the selected or next piece.";
  if (selectedArchitecture) {
    ui.layoutSelectionTitle.textContent = moduleLabel(selectedArchitecture.kind) + " selected";
    ui.layoutSelectionDetail.textContent = "Boundary " + state.selected.edge + " · selectable from either adjacent square. Remove it here or press Delete.";
  } else if (passage) {
    ui.layoutSelectionTitle.textContent = passage.label || "Selected passage";
    ui.layoutSelectionDetail.textContent = "This exact connection is selected. Remove it without changing either room.";
  } else if (spaces.length === 1) {
    const bounds = BP.spaceBounds(spaces[0]);
    ui.layoutSelectionTitle.textContent = spaces[0].label;
    ui.layoutSelectionDetail.textContent = (bounds.maxX - bounds.minX) + " × " + (bounds.maxY - bounds.minY) + " cells · divide it, change its appearance, or Shift-click another room.";
  } else if (spaces.length > 1) {
    ui.layoutSelectionTitle.textContent = spaces.length + " rooms selected";
    ui.layoutSelectionDetail.textContent = spaces.map((space) => space.label).join(" + ") + ". Connect exactly these rooms.";
  } else {
    ui.layoutSelectionTitle.textContent = "Nothing selected";
    ui.layoutSelectionDetail.textContent = "Select a room to divide it, or select two rooms to draw a passage between them.";
  }
  ui.divideVertical.disabled = !building || spaces.length !== 1;
  ui.divideHorizontal.disabled = !building || spaces.length !== 1;
  ui.connectSelected.disabled = !building || spaces.length !== 2;
  ui.removeSelectedPassage.disabled = !building || !passage;
  ui.removeSelectedArchitecture.disabled = !building || !selectedArchitecture;
  ui.selectionActionNote.textContent = building
    ? "These actions change only what is visibly selected."
    : "Enter Build mode to use a contextual map action.";
  const appearance = spaces[0];
  ui.appearanceSelectionTitle.textContent = appearance ? appearance.label : "Select a room";
  ui.applySelectedAppearance.disabled = !building || spaces.length !== 1;
  if (appearance) {
    ui.selectedElevation.value = String(appearance.elevationFt || 0);
    ui.selectedMaterial.value = appearance.material || "nave";
  }
  ui.revealSelectionTitle.textContent = spaces.length > 1
    ? spaces.length + " rooms selected"
    : "Select two or more rooms on the map.";
  ui.revealSelectionDetail.textContent = spaces.length > 1
    ? spaces.map((space) => space.label).join(" + ") + " will reveal together; their walls and paths will not change."
    : "Their physical layout stays untouched.";
  ui.groupRevealSelected.disabled = !building || spaces.length < 2;
  ui.directGridStatus.textContent = state.calibration.cellPx.toFixed(1) + " px · " + state.map.cols + "×" + state.map.rows;
  positionBuildHandles();
}
function setLayoutTool(kind) {
  const allowed = ["select", "room", "corridor", "wall", "lowWall", "door", "erase"];
  state.layoutTool = allowed.includes(kind) ? kind : "select";
  if (["wall", "lowWall", "door", "erase"].includes(state.layoutTool)) setTool(state.layoutTool, false);
  document.querySelectorAll("[data-layout-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.layoutTool === state.layoutTool);
  });
  document.querySelectorAll("[data-radial-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.radialTool === state.layoutTool);
  });
  const copy = {
    select: ["Select", "Click a room or passage. Shift-click adds a second room so you can connect exactly those two."],
    room: ["Room", "Drag a rectangle on the map. A room must be at least 3 × 3 cells and cannot overlap existing floor."],
    corridor: ["Passage", "Click a starting cell, then hold or drag a gold arrow to build the path in that direction."],
    wall: ["Wall", "Click near a square edge; the wall snaps between squares. Click an end arrow for one segment, or hold and drag for a longer run."],
    lowWall: ["Ledge", "Click near a square edge. The ledge sits on that boundary and repeats from either end."],
    door: ["Door", "Click near a square edge to place an opening on that boundary."],
    erase: ["Erase", "Click near an architectural edge to remove that exact piece. Select a passage for the safer Remove passage action."]
  }[state.layoutTool];
  ui.radialToolLabel.textContent = copy[0];
  ui.layoutToolGuidance.innerHTML = "<strong>" + copy[0] + ":</strong> " + copy[1];
  state.buildAnchor = null;
  state.linePreview = [];
  ui.buildHandles.hidden = true;
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
}
function clearLayoutSelection() {
  state.layoutSpaces = [];
  state.layoutPassage = null;
  state.selected = null;
  state.buildAnchor = null;
  state.areaHighlight = false;
  buildAreaOverlay();
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
  requestRender();
}
function selectArchitectureAtBoundary(c, r, edge) {
  const resolved = explicitArchitectureBoundaryAt(c, r, edge);
  if (!resolved) return false;
  state.selected = { c: resolved.c, r: resolved.r, edge: resolved.edge };
  state.layoutSpaces = [];
  state.layoutPassage = null;
  state.buildAnchor = ["wall", "lowWall"].includes(resolved.item.kind)
    ? { c: resolved.c, r: resolved.r, edge: resolved.edge }
    : null;
  ui.chunkStatus.textContent = moduleLabel(resolved.item.kind) + " selected from its physical boundary";
  ui.chunkStatus.className = "status good";
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
  requestRender();
  return true;
}
function selectLayoutAt(c, r, additive) {
  const info = cellInfo(c, r);
  if (!info) {
    if (!additive) clearLayoutSelection();
    ui.selectionActionNote.textContent = "That cell is outside the current map.";
    return;
  }
  state.selected = null;
  state.buildAnchor = null;
  if (info.corridor) {
    state.layoutPassage = info.corridor;
    state.layoutSpaces = [];
  } else if (info.space) {
    state.layoutPassage = null;
    if (additive) {
      state.layoutSpaces = state.layoutSpaces.includes(info.space)
        ? state.layoutSpaces.filter((id) => id !== info.space)
        : state.layoutSpaces.concat(info.space).slice(-2);
    } else state.layoutSpaces = [info.space];
    const space = state.blueprint.spaces.find((item) => item.id === info.space);
    state.areaFocus = space?.discoveryRegion || state.areaFocus;
  }
  state.areaHighlight = state.mapTab === "areas" && state.layoutSpaces.length > 0;
  buildAreaOverlay();
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
  requestRender();
}
function commitRoom(from, to) {
  const next = BP.addRoom(state.blueprint, from, to);
  state.roomPreview = null;
  if (next === state.blueprint) {
    ui.layoutToolGuidance.innerHTML = "<strong>Room not placed:</strong> use at least 3 × 3 empty cells with no existing floor.";
    drawSelection();
    drawScrawl();
    drawArtwork();
    return;
  }
  const before = new Set(state.blueprint.spaces.map((space) => space.id));
  state.blueprint = next;
  state.themeBase = BP.copy(next);
  const created = state.blueprint.spaces.find((space) => !before.has(space.id));
  if (created) {
    state.layoutSpaces = [created.id];
    state.discovered.add(created.discoveryRegion);
    state.areaFocus = created.discoveryRegion;
  }
  updateRegionControls();
  refreshDocument();
  rebuildAll();
  updateDirectUI();
  recordHistory("Room drawn");
  const connectivity = BP.tacticalConnectivity(state.map);
  ui.chunkStatus.textContent = connectivity.ok ? "first room drawn · connected" : connectivity.reason;
  ui.chunkStatus.className = "status " + (connectivity.ok ? "good" : "bad");
}
function placeObject(c, r) {
  const next = BP.placeProp(state.blueprint, c, r, state.objectKind, state.rotation);
  if (next === state.blueprint) {
    ui.objectToolGuidance.innerHTML = "<strong>Placement refused.</strong> Choose open playable ground.";
    return;
  }
  state.blueprint = next;
  state.themeBase = BP.copy(next);
  refreshDocument();
  rebuildCellChunk(c, r);
  ui.objectToolGuidance.innerHTML = "<strong>" + moduleLabel(state.objectKind) + " placed.</strong> Click another cell or rotate before placing.";
  recordHistory(moduleLabel(state.objectKind) + " placed");
}
function lineToolActive() {
  return ["wall", "lowWall", "corridor"].includes(state.layoutTool);
}
function lineCellsFor(direction, length) {
  if (["wall", "lowWall"].includes(state.layoutTool) && state.buildAnchor?.edge) {
    const edge = BP.normalizeEdge(state.buildAnchor.edge);
    const tangent = ["N", "S"].includes(edge) ? ["e", "w"] : ["n", "s"];
    if (!tangent.includes(direction)) return [];
    return BP.lineEdges(state.buildAnchor, direction, length, state.map.cols, state.map.rows)
      .filter(({ c, r }) => !!cellInfo(c, r));
  }
  const cells = BP.lineCells(state.buildAnchor, direction, length, state.map.cols, state.map.rows);
  if (state.layoutTool === "corridor") return cells;
  return cells.filter(({ c, r }) => {
    if (!cellInfo(c, r)) return false;
    return !(state.blueprint.spawns || []).concat(state.blueprint.props || []).some((item) => item.c === c && item.r === r);
  });
}
function previewLine(direction, length) {
  state.linePreview = lineCellsFor(direction, length);
  drawSelection();
  drawScrawl();
  drawArtwork();
  const unit = state.linePreview[0]?.edge ? "edge segment" : "cell";
  ui.massBuildCallout.querySelector("span").textContent = state.linePreview.length
    ? state.linePreview.length + " " + unit + (state.linePreview.length === 1 ? "" : "s") + " previewed · release to commit as one Undo."
    : "That direction has no buildable cells.";
  requestRender();
}
function commitLine() {
  if (!state.linePreview.length) return;
  const cells = state.linePreview.slice();
  if (state.layoutTool === "corridor") {
    const last = cells[cells.length - 1];
    const next = BP.addPassage(state.blueprint, state.buildAnchor, last, 1, cellInfo(state.buildAnchor.c, state.buildAnchor.r)?.region);
    if (next !== state.blueprint) {
      state.blueprint = next;
      state.themeBase = BP.copy(next);
      refreshDocument();
      rebuildAll();
      recordHistory("Passage repeated " + cells.length + " cells");
    }
  } else {
    cells.forEach(({ c, r, edge }) => {
      state.edits = BP.editCell(state.edits, c, r, state.layoutTool, state.rotation, edge);
    });
    refreshDocument();
    rebuildAll();
    const historyUnit = cells[0].edge ? "edge segment" : "cell";
    recordHistory(moduleLabel(state.layoutTool) + " repeated " + cells.length + " " + historyUnit + (cells.length === 1 ? "" : "s"));
  }
  const last = cells[cells.length - 1];
  state.buildAnchor = { c: last.c, r: last.r, edge: last.edge };
  state.selected = { c: last.c, r: last.r, edge: last.edge };
  state.linePreview = [];
  ui.massBuildCallout.querySelector("span").textContent = cells.length + (last.edge ? " edge segment" + (cells.length === 1 ? "" : "s") : " cell" + (cells.length === 1 ? "" : "s")) + " committed together. Undo removes the whole run.";
  drawSelection();
  drawScrawl();
  drawArtwork();
  updateDirectUI();
}
function positionBuildHandles() {
  if (!ui.buildHandles || state.mode !== "build" || !state.buildAnchor || !lineToolActive()) {
    if (ui.buildHandles) ui.buildHandles.hidden = true;
    return;
  }
  const shell = document.querySelector(".stage-shell");
  const shellRect = shell.getBoundingClientRect();
  let x = 0, y = 0, stepPx = 32;
  if (state.view === "board") {
    const info = cellInfo(state.buildAnchor.c, state.buildAnchor.r);
    const edgeAt = state.buildAnchor.edge ? edgeWorld(state.buildAnchor.c, state.buildAnchor.r, state.buildAnchor.edge) : null;
    const point = new THREE.Vector3(edgeAt?.x ?? worldX(state.buildAnchor.c), rise(info?.elevationFt || 0) + 0.22, edgeAt?.z ?? worldZ(state.buildAnchor.r));
    point.project(camera);
    const rect = renderer.domElement.getBoundingClientRect();
    x = rect.left - shellRect.left + (point.x + 1) * rect.width / 2;
    y = rect.top - shellRect.top + (1 - point.y) * rect.height / 2;
    stepPx = Math.max(22, rect.height / Math.max(state.map.rows, 12));
  } else {
    const canvas = state.view === "artwork" ? ui.artworkStage : ui.scrawlStage;
    const transform = state.view === "artwork" ? state.artworkTransform : state.scrawlTransform;
    if (!transform) { ui.buildHandles.hidden = true; return; }
    const rect = canvas.getBoundingClientRect();
    const edgeOffset = { N: [0, -0.5], E: [0.5, 0], S: [0, 0.5], W: [-0.5, 0] }[BP.normalizeEdge(state.buildAnchor.edge)] || [0, 0];
    x = rect.left - shellRect.left + (transform.ox + (state.buildAnchor.c + 0.5 + edgeOffset[0]) * transform.cell) / canvas.width * rect.width;
    y = rect.top - shellRect.top + (transform.oy + (state.buildAnchor.r + 0.5 + edgeOffset[1]) * transform.cell) / canvas.height * rect.height;
    stepPx = transform.cell / canvas.width * rect.width;
  }
  ui.buildHandles.style.left = x + "px";
  ui.buildHandles.style.top = y + "px";
  ui.buildHandles.hidden = x < 0 || y < 0 || x > shellRect.width || y > shellRect.height;
  const edge = BP.normalizeEdge(state.buildAnchor.edge);
  const edgeAxis = edge ? (["N", "S"].includes(edge) ? "ew" : "ns") : "";
  const lowAxis = !edge && state.layoutTool === "lowWall" ? (state.rotation % 180 === 0 ? "ns" : "ew") : "";
  ui.buildHandles.querySelectorAll("[data-build-direction]").forEach((button) => {
    const direction = button.dataset.buildDirection;
    const axis = edgeAxis || lowAxis;
    button.hidden = axis === "ns" ? !["n", "s"].includes(direction) : (axis === "ew" ? !["e", "w"].includes(direction) : false);
    button.dataset.stepPx = String(stepPx);
  });
}
function moduleLabel(kind) { return kind === "lowWall" ? "Low wall" : kind.charAt(0).toUpperCase() + kind.slice(1); }
function setTool(kind, clearSelection) {
  state.tool = kind;
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === kind));
  if (clearSelection) {
    state.selected = null;
    ui.rotationLabel.textContent = "Placement angle";
    ui.chunkStatus.textContent = kind === "erase" ? "choose a piece to erase" : "choose a cell to place";
    ui.chunkStatus.className = "status";
    drawSelection();
    drawScrawl();
  }
}
function setRotation(value, rotateSelected = true) {
  if (rotateSelected && state.selected?.edge) {
    ui.rotationLabel.textContent = state.selected.edge + " edge selected";
    ui.chunkStatus.textContent = "Edge placement follows the square boundary · choose a different edge to turn.";
    ui.chunkStatus.className = "status good";
    return;
  }
  state.rotation = BP.normalizeRotation(value);
  ui.rotationValue.textContent = state.rotation + "°";
  ui.directRotationValue.textContent = state.rotation + "°";
  positionBuildHandles();
  if (!rotateSelected || !state.selected) return;
  const item = explicitArchitectureAt(state.selected.c, state.selected.r, state.selected.edge);
  if (!item) {
    ui.rotationLabel.textContent = "Placement angle";
    return;
  }
  if (!["wall", "lowWall", "door"].includes(item.kind)) {
    ui.chunkStatus.textContent = item.kind + " is fixed · rotation refused";
    ui.chunkStatus.className = "status bad";
    return;
  }
  state.edits = BP.editCell(state.edits, state.selected.c, state.selected.r, item.kind, state.rotation);
  refreshDocument();
  rebuildCellChunk(state.selected.c, state.selected.r);
  drawSelection();
  drawScrawl();
  const chunk = BP.chunkFor(state.blueprint, state.selected.c, state.selected.r);
  ui.rotationLabel.textContent = moduleLabel(item.kind) + " selected";
  ui.chunkStatus.textContent = moduleLabel(item.kind) + " " + state.rotation + "° · chunk " + chunk.key + " · 1/" + BP.chunkCount(state.blueprint);
  ui.chunkStatus.className = "status good";
  recordHistory(moduleLabel(item.kind) + " rotated");
}
function applyEdgeEdit(c, r, edge) {
  const info = cellInfo(c, r);
  edge = BP.normalizeEdge(edge);
  if (!info || !edge) {
    ui.chunkStatus.textContent = "Choose the edge of a playable square";
    ui.chunkStatus.className = "status bad";
    return;
  }
  const resolved = explicitArchitectureBoundaryAt(c, r, edge);
  if (state.layoutTool === "erase") {
    if (!resolved) {
      ui.chunkStatus.textContent = isDerivedBoundary(c, r, edge)
        ? "That is the room perimeter, not a placed wall · reshape the room or add a passage"
        : "Nothing authored on that boundary · no map change";
      ui.chunkStatus.className = "status bad";
      return;
    }
    state.selected = { c: resolved.c, r: resolved.r, edge: resolved.edge };
    state.edits = BP.editCell(state.edits, resolved.c, resolved.r, "erase", 0, resolved.edge);
    state.buildAnchor = null;
    refreshDocument();
    rebuildAll();
    ui.rotationLabel.textContent = "Placement angle";
    ui.chunkStatus.textContent = isDerivedBoundary(c, r, edge)
      ? moduleLabel(resolved.item.kind) + " removed · the room perimeter wall is restored"
      : moduleLabel(resolved.item.kind) + " removed from the boundary";
    ui.chunkStatus.className = "status good";
    updateDirectUI();
    recordHistory("Edge architecture erased");
    return;
  }
  if (resolved) {
    const existing = resolved.item;
    state.selected = { c: resolved.c, r: resolved.r, edge: resolved.edge };
    state.layoutTool = existing.kind;
    setTool(existing.kind, false);
    document.querySelectorAll("[data-layout-tool]").forEach((button) => {
      button.classList.toggle("active", button.dataset.layoutTool === existing.kind);
    });
    document.querySelectorAll("[data-radial-tool]").forEach((button) => {
      button.classList.toggle("active", button.dataset.radialTool === existing.kind);
    });
    ui.radialToolLabel.textContent = moduleLabel(existing.kind);
    state.buildAnchor = ["wall", "lowWall"].includes(existing.kind)
      ? { c: resolved.c, r: resolved.r, edge: resolved.edge }
      : null;
    ui.rotationLabel.textContent = resolved.edge + " edge selected";
    ui.chunkStatus.textContent = moduleLabel(existing.kind) + " selected from either side of its boundary";
    ui.chunkStatus.className = "status good";
    drawSelection();
    drawScrawl();
    drawArtwork();
    updateDirectUI();
    requestRender();
    return;
  }
  if (state.layoutTool === "wall" && isDerivedBoundary(c, r, edge)) {
    ui.chunkStatus.textContent = "That edge already has the room’s perimeter wall · no duplicate was added";
    ui.chunkStatus.className = "status bad";
    return;
  }
  state.selected = { c, r, edge };
  state.edits = BP.editCell(state.edits, c, r, state.layoutTool, BP.edgeRotation(edge), edge);
  state.buildAnchor = ["wall", "lowWall"].includes(state.layoutTool) ? { c, r, edge } : null;
  refreshDocument();
  rebuildAll();
  ui.rotationLabel.textContent = edge + " edge selected";
  ui.chunkStatus.textContent = moduleLabel(state.layoutTool) + " placed between squares";
  ui.chunkStatus.className = "status good";
  updateDirectUI();
  recordHistory(moduleLabel(state.layoutTool) + " placed on edge");
}
function removeSelectedArchitecture() {
  if (!state.selected?.edge) return;
  const item = explicitArchitectureAt(state.selected.c, state.selected.r, state.selected.edge);
  if (!item) return;
  const removed = moduleLabel(item.kind);
  state.edits = BP.editCell(state.edits, state.selected.c, state.selected.r, "erase", 0, state.selected.edge);
  state.selected = null;
  state.buildAnchor = null;
  refreshDocument();
  rebuildAll();
  ui.chunkStatus.textContent = removed + " removed from its boundary";
  ui.chunkStatus.className = "status good";
  updateDirectUI();
  recordHistory("Selected architecture removed");
}
function applyEdit(c, r) {
  const info = cellInfo(c, r);
  if (!info) {
    ui.chunkStatus.textContent = "select a playable cell";
    ui.chunkStatus.className = "status bad";
    return;
  }
  const existing = explicitArchitectureAt(c, r);
  if (existing && state.tool !== "erase") {
    state.selected = { c, r };
    if (["wall", "lowWall", "door"].includes(existing.kind)) {
      state.layoutTool = existing.kind;
      setTool(existing.kind, false);
      document.querySelectorAll("[data-layout-tool]").forEach((button) => {
        button.classList.toggle("active", button.dataset.layoutTool === existing.kind);
      });
    }
    setRotation(existing.rotation, false);
    state.buildAnchor = ["wall", "lowWall"].includes(existing.kind) ? { c, r } : null;
    ui.rotationLabel.textContent = moduleLabel(existing.kind) + " selected";
    ui.chunkStatus.textContent = ["wall", "lowWall", "door"].includes(existing.kind)
      ? "selected · arrows rotate in place"
      : moduleLabel(existing.kind) + " selected · fixed module";
    ui.chunkStatus.className = "status good";
    drawSelection();
    drawScrawl();
    requestRender();
    return;
  }
  const occupied = (state.blueprint.spawns || []).concat(state.blueprint.props || []).some((item) => item.c === c && item.r === r);
  if (occupied) {
    ui.chunkStatus.textContent = "occupied cell · edit refused";
    ui.chunkStatus.className = "status bad";
    return;
  }
  state.selected = { c, r };
  state.edits = BP.editCell(state.edits, c, r, state.tool, state.rotation);
  state.buildAnchor = ["wall", "lowWall"].includes(state.layoutTool) && state.tool !== "erase" ? { c, r } : null;
  refreshDocument();
  rebuildCellChunk(c, r);
  drawSelection();
  drawScrawl();
  ui.rotationLabel.textContent = state.tool === "erase" ? "Placement angle" : moduleLabel(state.tool) + " selected";
  updateDirectUI();
  recordHistory(state.tool === "erase" ? "Architecture erased" : moduleLabel(state.tool) + " placed");
}
function inspectCell(c, r) {
  const info = cellInfo(c, r);
  if (!info) {
    ui.chunkStatus.textContent = "Browse safe · outside playable ground";
    ui.chunkStatus.className = "status";
    return;
  }
  const existing = explicitArchitectureAt(c, r);
  if (existing) {
    state.selected = { c, r };
    setRotation(existing.rotation, false);
    ui.rotationLabel.textContent = moduleLabel(existing.kind) + " inspected";
    ui.chunkStatus.textContent = "Browse safe · no map change";
    ui.chunkStatus.className = "status good";
    drawSelection();
    drawScrawl();
    drawArtwork();
    requestRender();
  } else {
    state.selected = null;
    ui.chunkStatus.textContent = "Browse safe · " + (info.space || info.corridor || info.region);
    ui.chunkStatus.className = "status good";
    drawSelection();
    drawScrawl();
    drawArtwork();
  }
}
function applyMapClick(c, r, options = {}) {
  if (state.workflow === "present" && state.fight) fightCellAction(c, r);
  else if (state.flagPlacement) placeGroupFlag(c, r);
  else if (state.workflow === "map") {
    if (state.mode !== "build") {
      selectLayoutAt(c, r, !!options.additive);
    } else if (state.mapTab === "objects") placeObject(c, r);
    else if (state.mapTab === "layout" && state.layoutTool === "select") {
      if (!options.additive && selectArchitectureAtBoundary(c, r, options.edge)) return;
      selectLayoutAt(c, r, !!options.additive);
    } else if (state.mapTab === "appearance" || state.mapTab === "areas") {
      selectLayoutAt(c, r, !!options.additive);
    }
    else if (state.layoutTool === "corridor") {
      state.buildAnchor = { c, r };
      state.selected = { c, r };
      state.linePreview = [];
      ui.layoutToolGuidance.innerHTML = "<strong>Passage anchor set.</strong> Hold or drag a gold arrow to choose its direction and length.";
      drawSelection();
      drawScrawl();
      drawArtwork();
      updateDirectUI();
      requestRender();
    } else if (["wall", "lowWall", "door", "erase"].includes(state.layoutTool)) {
      applyEdgeEdit(c, r, options.edge);
    } else if (state.layoutTool !== "room") applyEdit(c, r);
  } else if (state.mode === "build") applyEdit(c, r);
  else inspectCell(c, r);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let boardPointerStart = null;
function nearestCellEdge(localX, localY) {
  const distances = { W: localX, E: 1 - localX, N: localY, S: 1 - localY };
  return Object.keys(distances).reduce((best, edge) => distances[edge] < distances[best] ? edge : best, "N");
}
function boardCellFromEvent(event, allowEmpty) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = [];
  boardRoot.traverse((child) => { if (child.userData.pickableFloor) meshes.push(child); });
  const hit = raycaster.intersectObjects(meshes, false)[0];
  let point = hit?.point || null;
  let cell = hit && hit.instanceId != null ? hit.object.userData.cells[hit.instanceId] : null;
  if (!cell) {
    point = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (raycaster.ray.intersectPlane(ground, point)) {
      const c = Math.floor(point.x + state.map.cols / 2), r = Math.floor(point.z + state.map.rows / 2);
      if (c >= 0 && r >= 0 && c < state.map.cols && r < state.map.rows && (allowEmpty || cellInfo(c, r))) cell = { c, r };
    }
  }
  if (cell && point) {
    const localX = Math.max(0, Math.min(1, point.x - worldX(cell.c) + 0.5));
    const localY = Math.max(0, Math.min(1, point.z - worldZ(cell.r) + 0.5));
    cell = { ...cell, edge: nearestCellEdge(localX, localY) };
  }
  return cell;
}
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  hideBuildRadial();
  const roomBuilding = state.workflow === "map" && state.mode === "build" && state.mapTab === "layout" && state.layoutTool === "room";
  const cell = roomBuilding ? boardCellFromEvent(event, true) : null;
  boardPointerStart = { x: event.clientX, y: event.clientY, cell };
  if (roomBuilding && cell) {
    controls.enabled = false;
    state.roomPreview = { from: cell, to: cell };
    drawSelection();
    drawScrawl();
    drawArtwork();
  }
}, true);
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!state.roomPreview) return;
  const cell = boardCellFromEvent(event, true);
  if (!cell) return;
  state.roomPreview.to = cell;
  drawSelection();
  drawScrawl();
  drawArtwork();
  requestRender();
}, true);
renderer.domElement.addEventListener("pointerup", (event) => {
  if (event.button !== 0) return;
  if (state.roomPreview) {
    const from = state.roomPreview.from;
    const to = boardCellFromEvent(event, true) || state.roomPreview.to;
    controls.enabled = true;
    commitRoom(from, to);
    boardPointerStart = null;
    return;
  }
  if (boardPointerStart && Math.hypot(event.clientX - boardPointerStart.x, event.clientY - boardPointerStart.y) > 5) return;
  const cell = boardCellFromEvent(event, false);
  if (cell) applyMapClick(cell.c, cell.r, { additive: event.shiftKey, edge: cell.edge });
  else {
    ui.chunkStatus.textContent = "No battlefield cell there";
    ui.chunkStatus.className = "status bad";
  }
}, true);
function bindCanvasMap(canvas, transformName) {
  let start = null;
  function canvasCell(event) {
    const rect = canvas.getBoundingClientRect(), transform = state[transformName];
    if (!transform) return null;
    const ratioX = canvas.width / rect.width, ratioY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * ratioX, y = (event.clientY - rect.top) * ratioY;
    const mapX = (x - transform.ox) / transform.cell, mapY = (y - transform.oy) / transform.cell;
    const c = Math.floor(mapX), r = Math.floor(mapY);
    return c >= 0 && r >= 0 && c < state.map.cols && r < state.map.rows
      ? { c, r, edge: nearestCellEdge(mapX - c, mapY - r) }
      : null;
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    hideBuildRadial();
    const cell = canvasCell(event);
    start = { x: event.clientX, y: event.clientY, cell };
    if (cell && state.workflow === "map" && state.mode === "build" && state.mapTab === "layout" && state.layoutTool === "room") {
      state.roomPreview = { from: cell, to: cell };
      canvas.setPointerCapture?.(event.pointerId);
      drawSelection();
      drawScrawl();
      drawArtwork();
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!state.roomPreview) return;
    const cell = canvasCell(event);
    if (!cell) return;
    state.roomPreview.to = cell;
    drawSelection();
    drawScrawl();
    drawArtwork();
  });
  canvas.addEventListener("pointerup", (event) => {
    const cell = canvasCell(event);
    if (state.roomPreview) {
      const from = state.roomPreview.from;
      commitRoom(from, cell || state.roomPreview.to);
      start = null;
      return;
    }
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5) return;
    if (cell) applyMapClick(cell.c, cell.r, { additive: event.shiftKey, edge: cell.edge });
  });
}
bindCanvasMap(ui.scrawlStage, "scrawlTransform");
bindCanvasMap(ui.artworkStage, "artworkTransform");
document.querySelector(".stage-shell")?.addEventListener("contextmenu", (event) => {
  if (state.mode !== "build" || event.target.closest("button,nav,.authoring-bar,.build-radial")) return;
  event.preventDefault();
  showBuildRadial(event.clientX, event.clientY);
});
document.addEventListener("pointerdown", (event) => {
  if (!ui.buildRadial.hidden && !event.target.closest("#buildRadial")) hideBuildRadial();
});

let lineGesture = null;
function moveLineGesture(event) {
  if (!lineGesture) return;
  const vectors = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  const vector = vectors[lineGesture.direction];
  const projected = (event.clientX - lineGesture.startX) * vector[0] + (event.clientY - lineGesture.startY) * vector[1];
  const length = Math.max(1, Math.min(40, 1 + Math.floor(projected / Math.max(16, Number(lineGesture.button.dataset.stepPx) || 28))));
  if (length !== lineGesture.length) {
    lineGesture.length = length;
    previewLine(lineGesture.direction, length);
  }
}
function endLineGesture(commit) {
  if (!lineGesture) return;
  clearInterval(lineGesture.timer);
  lineGesture.button.classList.remove("active");
  document.querySelector(".stage-shell")?.classList.remove("line-building");
  if (commit) commitLine();
  else {
    state.linePreview = [];
    drawSelection();
    drawScrawl();
    drawArtwork();
  }
  lineGesture = null;
}
ui.buildHandles.querySelectorAll("[data-build-direction]").forEach((button) => {
  button.addEventListener("pointerdown", (event) => {
    if (!state.buildAnchor || state.mode !== "build") return;
    event.preventDefault();
    event.stopPropagation();
    button.setPointerCapture?.(event.pointerId);
    const direction = button.dataset.buildDirection;
    lineGesture = {
      button,
      direction,
      startX: event.clientX,
      startY: event.clientY,
      length: 1,
      timer: setInterval(() => {
        if (!lineGesture) return;
        lineGesture.length++;
        previewLine(direction, lineGesture.length);
      }, 240)
    };
    button.classList.add("active");
    document.querySelector(".stage-shell")?.classList.add("line-building");
    previewLine(direction, 1);
  });
  button.addEventListener("pointermove", (event) => {
    if (lineGesture?.button === button) moveLineGesture(event);
  });
  button.addEventListener("pointerup", (event) => {
    event.preventDefault();
    event.stopPropagation();
    endLineGesture(true);
  });
  button.addEventListener("pointercancel", () => endLineGesture(false));
});
document.addEventListener("pointermove", moveLineGesture, true);
document.addEventListener("pointerup", () => endLineGesture(true), true);

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-quality]").forEach((button) => button.addEventListener("click", () => applyQuality(button.dataset.quality)));
document.querySelectorAll("[data-fixture]").forEach((button) => button.addEventListener("click", () => loadFixture(button.dataset.fixture)));
document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool, true)));
document.querySelectorAll("[data-workflow]").forEach((button) => button.addEventListener("click", () => setWorkflow(button.dataset.workflow)));
document.querySelectorAll("[data-open-workflow]").forEach((button) => button.addEventListener("click", () => setWorkflow(button.dataset.openWorkflow)));
document.querySelectorAll("[data-continue]").forEach((button) => button.addEventListener("click", () => setWorkflow(button.dataset.continue)));
document.querySelectorAll("[data-source-choice]").forEach((button) => button.addEventListener("click", () => chooseSource(button.dataset.sourceChoice)));
document.querySelectorAll("[data-creation-method]").forEach((button) => button.addEventListener("click", () => setCreationMethod(button.dataset.creationMethod)));
document.querySelectorAll("[data-creation-template]").forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.creationTemplate;
  const blueprint = BP.withSource(BP.FIXTURES[key], "fixture", { fixtureKey: key });
  stageCreation(blueprint, blueprint.name, blueprint.topology + " template");
  renderCreationTemplates();
}));
document.querySelectorAll("[data-theme]").forEach((button) => button.addEventListener("click", () => applyThemePreset(button.dataset.theme)));
document.querySelectorAll("[data-map-tab]").forEach((button) => button.addEventListener("click", () => setMapTab(button.dataset.mapTab)));
document.querySelectorAll("[data-layout-tool]").forEach((button) => button.addEventListener("click", () => activateLayoutTool(button.dataset.layoutTool)));
document.querySelectorAll("[data-radial-tool]").forEach((button) => button.addEventListener("click", () => {
  activateLayoutTool(button.dataset.radialTool);
  hideBuildRadial();
}));
document.querySelectorAll("[data-object-kind]").forEach((button) => button.addEventListener("click", () => {
  state.objectKind = button.dataset.objectKind;
  document.querySelectorAll("[data-object-kind]").forEach((item) => item.classList.toggle("active", item.dataset.objectKind === state.objectKind));
  ui.objectToolGuidance.innerHTML = "<strong>" + moduleLabel(state.objectKind) + " armed.</strong> Enter Build mode, then click a playable cell to place it.";
}));
document.querySelectorAll("[data-context-select]").forEach((button) => button.addEventListener("click", () => {
  state.layoutTool = "select";
  ui.chunkStatus.textContent = button.dataset.contextSelect === "appearance"
    ? "Choose a room to change its appearance"
    : "Choose rooms to edit their player reveal group";
  ui.chunkStatus.className = "status good";
}));
document.querySelectorAll("[data-quick-map]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.quickMap === "blank") openBlankBuild();
  else loadFixture(button.dataset.quickMap);
}));
ui.openMapCreation.addEventListener("click", openMapCreation);
ui.closeMapCreation.addEventListener("click", closeMapCreation);
ui.mapCreationDialog.addEventListener("click", (event) => { if (event.target === ui.mapCreationDialog) closeMapCreation(); });
ui.createDirections.addEventListener("click", () => makeCreationCandidates(false));
ui.newDirections.addEventListener("click", () => makeCreationCandidates(true));
ui.openImageImport.addEventListener("click", storeCurrentMapForImport);
ui.stageBlankMap.addEventListener("click", () => {
  const blueprint = BP.produceBlank({ size: ui.creationBlankSize.value });
  stageCreation(blueprint, "Blank " + ui.creationBlankSize.value + " battlefield", blueprint.grid.cols + " × " + blueprint.grid.rows + " · zero rooms");
});
ui.confirmMapChoice.addEventListener("click", confirmCreatedMap);
document.querySelectorAll("[data-presentation]").forEach((button) => button.addEventListener("click", () => {
  const mode = button.dataset.presentation;
  document.querySelectorAll("[data-presentation]").forEach((item) => item.classList.toggle("active", item === button));
  setMode("browse");
  setView("board");
  if (mode === "topdown") frameTopDown();
  else if (mode === "beauty") {
    if (state.fixtureKey === "processional" && state.discovered.has("choir")) focusHeroRoom();
    else {
      frameBoard();
      ui.chunkStatus.textContent = "Beauty framed current discovery · no rooms revealed";
      ui.chunkStatus.className = "status good";
    }
  } else frameBoard();
}));
ui.createSeeded.addEventListener("click", () => useBlueprint(BP.produceSeeded({
  seed: Number(ui.seedInput.value),
  topology: ui.seedTopology.value
})));
ui.analyzeSample.addEventListener("click", () => useBlueprint(BP.produceImportedSample()));
ui.createBlank.addEventListener("click", () => openBlankBuild());
ui.toggleUnderlay.addEventListener("click", () => {
  if (!state.blueprint.source?.underlay) return;
  state.sourceUnderlay = !state.sourceUnderlay;
  renderReviewFindings();
  setView("artwork");
  drawScrawl();
  drawArtwork();
});
ui.acceptAllFindings.addEventListener("click", () => {
  state.blueprint = BP.acceptImportFinding(state.blueprint, "all");
  state.themeBase = BP.copy(state.blueprint);
  refreshDocument();
  renderReviewFindings();
  recordHistory("All import findings confirmed");
});
ui.revealNext.addEventListener("click", revealNext);
ui.pinnedReveal.addEventListener("click", () => {
  setWorkflow("encounter");
  revealNext();
});
ui.resetDiscovery.addEventListener("click", resetDiscovery);
ui.focusHero.addEventListener("click", focusHeroRoom);
ui.rotateLeft.addEventListener("click", () => setRotation(state.rotation - 90));
ui.rotateRight.addEventListener("click", () => setRotation(state.rotation + 90));
ui.directRotateLeft.addEventListener("click", () => setRotation(state.rotation - 90));
ui.directRotateRight.addEventListener("click", () => setRotation(state.rotation + 90));
ui.directBuildMode.addEventListener("click", () => setMode(state.mode === "build" ? "browse" : "build"));
ui.clearLayoutSelection.addEventListener("click", clearLayoutSelection);
ui.divideVertical.addEventListener("click", () => {
  const space = selectedSpaces()[0];
  if (!space || state.mode !== "build") return;
  state.edits = BP.divideSpace(state.edits, state.blueprint, space.id, "vertical");
  refreshDocument();
  rebuildAll();
  ui.selectionActionNote.textContent = "Divider placed with a doorway. Use Wall on the doorway cell to close it completely.";
  recordHistory(space.label + " divided vertically");
});
ui.divideHorizontal.addEventListener("click", () => {
  const space = selectedSpaces()[0];
  if (!space || state.mode !== "build") return;
  state.edits = BP.divideSpace(state.edits, state.blueprint, space.id, "horizontal");
  refreshDocument();
  rebuildAll();
  ui.selectionActionNote.textContent = "Divider placed with a doorway. Use Wall on the doorway cell to close it completely.";
  recordHistory(space.label + " divided horizontally");
});
ui.connectSelected.addEventListener("click", () => {
  const spaces = selectedSpaces();
  if (spaces.length !== 2 || state.mode !== "build") return;
  const before = new Set(state.blueprint.corridors.map((corridor) => corridor.id));
  const next = BP.connectSpaces(state.blueprint, spaces[0].id, spaces[1].id, 2);
  const created = next.corridors.find((corridor) => !before.has(corridor.id));
  if (!created) return;
  state.blueprint = next;
  state.themeBase = BP.copy(next);
  state.layoutSpaces = [];
  state.layoutPassage = created.id;
  refreshDocument();
  rebuildAll();
  updateDirectUI();
  recordHistory("Selected rooms connected");
});
ui.removeSelectedPassage.addEventListener("click", () => {
  if (!state.layoutPassage || state.mode !== "build") return;
  const next = BP.removePassage(state.blueprint, state.layoutPassage);
  if (next === state.blueprint) return;
  state.blueprint = next;
  state.themeBase = BP.copy(next);
  state.layoutPassage = null;
  refreshDocument();
  rebuildAll();
  updateDirectUI();
  recordHistory("Selected passage removed");
});
ui.removeSelectedArchitecture.addEventListener("click", removeSelectedArchitecture);
ui.applySelectedAppearance.addEventListener("click", () => {
  const space = selectedSpaces()[0];
  if (!space || state.mode !== "build") return;
  state.blueprint = BP.changeSpace(state.blueprint, space.id, Number(ui.selectedElevation.value), ui.selectedMaterial.value);
  state.themeBase = BP.copy(state.blueprint);
  refreshDocument();
  rebuildAll();
  updateDirectUI();
  recordHistory(space.label + " appearance changed");
});
ui.groupRevealSelected.addEventListener("click", () => {
  const spaces = selectedSpaces();
  if (spaces.length < 2 || state.mode !== "build") return;
  const keepId = spaces[0].discoveryRegion;
  const absorbed = [];
  spaces.slice(1).forEach((space) => {
    if (space.discoveryRegion === keepId || absorbed.includes(space.discoveryRegion)) return;
    state.blueprint = BP.mergeAreas(state.blueprint, keepId, space.discoveryRegion);
    absorbed.push(space.discoveryRegion);
  });
  absorbed.forEach((id) => state.discovered.delete(id));
  state.discovered.add(keepId);
  state.themeBase = BP.copy(state.blueprint);
  updateRegionControls();
  refreshDocument();
  rebuildAll();
  updateDirectUI();
  recordHistory("Selected rooms grouped for reveal");
});
ui.openLegacyGrid.addEventListener("click", () => {
  state.gridVisible = true;
  syncGridControls();
  buildGrid();
  drawScrawl();
  drawArtwork();
  setView("blueprint");
  ui.selectionActionNote.textContent = "Blueprint view now shows the same calibrated grid used by Combat.";
  requestRender();
});
ui.zoneRegion.addEventListener("change", () => {
  state.areaFocus = ui.zoneRegion.value;
  syncZoneValues();
  refreshAreaFocus();
});
ui.toggleAreaHighlight.addEventListener("click", () => {
  state.areaHighlight = !state.areaHighlight;
  ui.toggleAreaHighlight.setAttribute("aria-pressed", String(state.areaHighlight));
  refreshAreaFocus();
});
ui.renameArea.addEventListener("click", () => {
  const regionId = state.areaFocus;
  const label = ui.areaName.value.trim();
  if (!regionId || !label || label === areaLabel(regionId)) return;
  state.blueprint = BP.renameArea(state.blueprint, regionId, label);
  state.themeBase = BP.copy(state.blueprint);
  updateRegionControls();
  refreshDocument();
  refreshAreaFocus();
  recordHistory("Area renamed");
});
ui.areaDressTogether.addEventListener("change", () => {
  state.blueprint = BP.setAreaSetting(state.blueprint, state.areaFocus, "dressTogether", ui.areaDressTogether.checked);
  state.themeBase = BP.copy(state.blueprint);
  updateAreaInspector();
  recordHistory("Area dressing link changed");
});
ui.areaRevealTogether.addEventListener("change", () => {
  state.blueprint = BP.setAreaSetting(state.blueprint, state.areaFocus, "revealTogether", ui.areaRevealTogether.checked);
  state.themeBase = BP.copy(state.blueprint);
  updateAreaInspector();
  recordHistory("Area reveal link changed");
});
ui.splitArea.addEventListener("click", () => {
  const regionId = state.areaFocus;
  const beforeIds = new Set(state.blueprint.discoveryRegions.map((region) => region.id));
  const next = BP.splitArea(state.blueprint, regionId);
  const created = next.discoveryRegions.find((region) => !beforeIds.has(region.id));
  if (!created) {
    ui.areaBoundaryNote.textContent = "This area has no rectangular room large enough to split.";
    ui.areaBoundaryNote.closest(".boundary-report")?.classList.add("warn");
    return;
  }
  state.blueprint = next;
  state.themeBase = BP.copy(next);
  if (state.discovered.has(regionId)) state.discovered.add(created.id);
  state.areaFocus = created.id;
  updateRegionControls();
  refreshDocument();
  rebuildAll();
  recordHistory("Area split");
});
ui.mergeArea.addEventListener("click", () => {
  const keepId = state.areaFocus;
  const absorbId = ui.areaMergeTarget.value;
  if (!keepId || !absorbId) return;
  state.blueprint = BP.mergeAreas(state.blueprint, keepId, absorbId);
  state.themeBase = BP.copy(state.blueprint);
  state.discovered.delete(absorbId);
  if (!state.discovered.size) state.discovered.add(keepId);
  updateRegionControls();
  refreshDocument();
  rebuildAll();
  recordHistory("Areas merged");
});
ui.applyZone.addEventListener("click", () => {
  const region = ui.zoneRegion.value;
  state.blueprint = BP.changeZone(state.blueprint, region, Number(ui.zoneElevation.value), ui.zoneMaterial.value);
  state.themeBase = BP.copy(state.blueprint);
  refreshDocument();
  rebuildRegion(region, true);
  recordHistory("Region material changed");
});
ui.browseMode.addEventListener("click", () => setMode("browse"));
ui.buildMode.addEventListener("click", () => setMode("build"));
ui.buildModeInline.addEventListener("click", () => setMode(state.mode === "build" ? "browse" : "build"));
ui.pinnedBuild.addEventListener("click", () => {
  const entering = state.mode !== "build";
  if (entering) setWorkflow("map", true);
  setMode(entering ? "build" : "browse");
});
ui.undoAction.addEventListener("click", () => travelHistory("Undo"));
ui.redoAction.addEventListener("click", () => travelHistory("Redo"));
ui.pinnedUndo.addEventListener("click", () => travelHistory("Undo"));
ui.pinnedRedo.addEventListener("click", () => travelHistory("Redo"));
ui.brushExitBuild.addEventListener("click", () => setMode("browse"));
ui.brushUndo.addEventListener("click", () => travelHistory("Undo"));
ui.brushRedo.addEventListener("click", () => travelHistory("Redo"));
ui.radialUndo.addEventListener("click", () => {
  travelHistory("Undo");
  hideBuildRadial();
});
ui.radialRedo.addEventListener("click", () => {
  travelHistory("Redo");
  hideBuildRadial();
});
ui.gridToggle.addEventListener("click", () => {
  state.gridVisible = !state.gridVisible;
  syncGridControls();
  buildGrid();
  drawScrawl();
  drawArtwork();
  requestRender();
  recordHistory(state.gridVisible ? "Grid shown" : "Grid hidden");
});
ui.applyGrid.addEventListener("click", () => applyGridCalibration());
ui.prepareLocalCombat.addEventListener("click", prepareLocalCombat);
ui.combatAttack.addEventListener("click", () => {
  if (!state.fight || !state.fightTarget) return;
  const result = LocalCombat.resolveAttack(state.fight, state.fightTarget);
  if (result.ok) state.fight = result.fight;
  refreshFightBoard(result.message, result.ok);
});
ui.combatEndTurn.addEventListener("click", () => {
  if (!state.fight || fightFinished()) return;
  state.fight = LocalCombat.endTurn(state.fight); state.fightTarget = null;
  refreshFightBoard(LocalCombat.activeUnit(state.fight).name + " is active.", true);
});
document.querySelectorAll("[data-grid-nudge]").forEach((button) => button.addEventListener("click", () => {
  const [axis, delta] = button.dataset.gridNudge.split(":");
  const input = axis === "x" ? ui.gridOriginX : ui.gridOriginY;
  input.value = String((Number(input.value) || 0) + Number(delta));
  applyGridCalibration("Grid origin nudged");
}));
ui.compareHold.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  ui.compareHold.setPointerCapture?.(event.pointerId);
  setComparison(true);
});
["pointerup", "pointercancel", "lostpointercapture"].forEach((name) => {
  ui.compareHold.addEventListener(name, () => setComparison(false));
});
document.addEventListener("keydown", (event) => {
  if (!ui.mapCreationDialog.hidden) {
    if (event.key === "Escape") { event.preventDefault(); closeMapCreation(); }
    return;
  }
  const target = event.target;
  const editing = target && (target.matches?.("input,select,textarea") || target.isContentEditable);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !editing) {
    event.preventDefault();
    travelHistory(event.shiftKey ? "Redo" : "Undo");
  } else if (state.mode === "build" && state.selected?.edge && !editing && ["Delete", "Backspace"].includes(event.key)) {
    event.preventDefault();
    removeSelectedArchitecture();
  } else if (event.key === "Escape") {
    if (!ui.buildRadial.hidden) {
      hideBuildRadial();
      return;
    }
    endLineGesture(false);
    state.roomPreview = null;
    controls.enabled = true;
    state.flagPlacement = null;
    setMode("browse");
    renderDeploymentGroups();
  } else if (state.mode === "build" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const shortcut = { v: "select", r: "room", p: "corridor", w: "wall", l: "lowWall", d: "door", e: "erase" }[event.key.toLowerCase()];
    if (shortcut) {
      event.preventDefault();
      activateLayoutTool(shortcut);
      hideBuildRadial();
    } else if (event.key.toLowerCase() === "c" && !event.repeat) setComparison(true);
  } else if (event.key.toLowerCase() === "c" && !event.repeat && !editing) {
    setComparison(true);
  }
});
document.addEventListener("keyup", (event) => {
  if (event.key.toLowerCase() === "c") setComparison(false);
});
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) requestRender();
});

function incomingHandoff() {
  const directMarker = "#handoff=", storedMarker = "#import=";
  let payload = null;
  if (window.location.hash.startsWith(directMarker)) payload = window.location.hash.slice(directMarker.length);
  else if (window.location.hash.startsWith(storedMarker)) {
    const key = decodeURIComponent(window.location.hash.slice(storedMarker.length));
    const stored = sessionStorage.getItem(key);
    if (!stored) throw new Error("The local map handoff expired. Return to Map and choose the source again.");
    payload = encodeURIComponent(stored);
  }
  if (!payload) return null;
  const decoded = BP.decodeHandoff(payload);
  if (!decoded.ok) throw new Error(decoded.error);
  return decoded.handoff;
}
window.__forgeCombatState = () => ({
  blueprintId: state.blueprint.id,
  fingerprint: BP.fingerprint(state.blueprint),
  receivedFingerprint: state.handoff?.fingerprint || null,
  sourceKind: state.blueprint.source?.kind || null,
  structuralFingerprint: BP.structuralFingerprint(state.blueprint),
  spaces: state.blueprint.spaces.length,
  corridors: state.blueprint.corridors.length,
  connected: BP.tacticalConnectivity(state.map).ok,
  mode: state.mode,
  tool: state.layoutTool,
  view: state.view,
  canUndo: !!state.history?.past.length,
  rosterReady: state.rosterCandidates.filter((candidate) => candidate.projection.ok).length,
  selectedParty: state.selectedPartyKeys.slice(),
  fightActive: !!state.fight,
  fightIdentity: state.fight?.identity || null,
  fightRound: state.fight?.round || null,
  fightUnits: state.fight?.units.map((unit) => ({ unit: unit.unit, side: unit.side, hp: unit.hp, c: unit.c, r: unit.r })) || []
});

try {
  updateRegionControls();
  refreshDocument();
  state.groups = defaultGroups();
  renderReviewFindings();
  renderDeploymentGroups();
  syncGridControls();
  applyQuality("balanced");
  rebuildAll();
  frameTopDown();
  setView("board");
  setMode("browse");
  resetHistory();
  chooseSource("generate");
  setLayoutTool("select");
  setMapTab("layout");
  setWorkflow("map");
  const handoff = incomingHandoff();
  if (handoff) {
    useBlueprint(handoff.blueprint, handoff);
    if (handoff.build?.edits) {
      state.edits = BP.copy(handoff.build.edits);
      refreshDocument(); rebuildAll();
    }
    setMapTab("layout");
    if (handoff.build?.armed) {
      setView("blueprint");
      setMode("build");
      setLayoutTool(handoff.build.tool || "room");
      ui.layoutToolGuidance.innerHTML = "<strong>Room:</strong> This grid is genuinely empty. Drag the first room; the tactical field will remain unavailable until playable floor exists.";
      ui.chunkStatus.textContent = "first room required";
      ui.chunkStatus.className = "status bad";
    } else {
      setView("board");
      setMode("browse");
      setLayoutTool(handoff.build?.tool || "select");
    }
    updateSourceReceipt();
  }
  renderLocalCombat();
  loadCombatRoster();
} catch (error) {
  console.error(error);
  ui.fatal.textContent = "Forge Combat could not start: " + error.message;
  ui.fatal.classList.add("on");
}
