import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const BP = window.ForgeBlueprintProof;
if (!BP) throw new Error("Forge Blueprint proof core did not load");

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
  "threeStage", "scrawlStage", "fatal", "mapName", "topologyLabel", "discoveryLabel",
  "connectivityStatus", "idleStatus", "chunkStatus", "contractStatus",
  "revealNext", "resetDiscovery", "focusHero", "rotationLabel", "rotationValue", "rotateLeft", "rotateRight",
  "zoneRegion", "zoneElevation", "zoneMaterial", "applyZone",
  "metricCalls", "metricTriangles", "metricTextures", "metricFrame", "metricChunks", "metricCells"
].forEach((id) => { ui[id] = document.getElementById(id); });

const state = {
  fixtureKey: "processional",
  blueprint: BP.copy(BP.FIXTURES.processional),
  map: null,
  edits: {},
  discovered: new Set(["gate"]),
  view: "diorama",
  quality: "balanced",
  tool: "wall",
  rotation: 0,
  selected: null,
  chunks: new Map(),
  scrawlTransform: null,
  renderPending: false,
  renderUntil: 0,
  lastFrameMs: 0,
  lastActivity: performance.now()
};

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
scene.add(boardRoot, lightRoot, selectionRoot);

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
[
  floorGeometry, wallGeometryNS, wallGeometryEW, cutGeometryNS, cutGeometryEW,
  lowWallGeometryNS, lowWallGeometryEW, doorGeometryNS, doorGeometryEW,
  pillarGeometry, rubbleGeometry, crateGeometry, brazierGeometry, poolGeometry, tokenGeometry,
  stoneBlockNS, stoneBlockEW, stoneCapNS, stoneCapEW, pewSeatGeometry, pewBackGeometry,
  altarBaseGeometry, altarSlabGeometry, reliquaryGeometry, statueBodyGeometry, statueHeadGeometry,
  fontBaseGeometry, fontBowlGeometry, candleGeometry, flameGeometry, selectionAxisGeometry
].forEach((geometry) => { geometry.userData = { shared: true }; });

function boundaryEdges(c, r) {
  const edges = [];
  [[0, -1, "n"], [1, 0, "e"], [0, 1, "s"], [-1, 0, "w"]].forEach(([dc, dr, side]) => {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= state.map.cols || nr >= state.map.rows || !cellInfo(nc, nr)) edges.push(side);
  });
  return edges;
}
function explicitArchitectureAt(c, r) {
  return (state.map.meta.architecture || []).find((item) => item.c === c && item.r === r) || null;
}
function architectureSets(bounds) {
  const out = { wallsNS: [], wallsEW: [], cutNS: [], cutEW: [], lowNS: [], lowEW: [], doorsNS: [], doorsEW: [] };
  for (let r = bounds.minR; r < bounds.maxR; r++) for (let c = bounds.minC; c < bounds.maxC; c++) {
    const info = cellInfo(c, r);
    if (!info || !isDiscovered(info.region)) continue;
    const y = rise(info.elevationFt);
    boundaryEdges(c, r).forEach((side) => {
      const near = side === "s" || side === "e";
      const record = { c, r, side, y };
      if (side === "n" || side === "s") out[near ? "cutNS" : "wallsNS"].push(record);
      else out[near ? "cutEW" : "wallsEW"].push(record);
    });
    const item = explicitArchitectureAt(c, r);
    if (!item) continue;
    const eastWest = BP.normalizeRotation(item.rotation) % 180 === 0;
    if (item.kind === "lowWall") out[eastWest ? "lowNS" : "lowEW"].push({ c, r, y });
    if (item.kind === "door" || item.kind === "arch") out[eastWest ? "doorsNS" : "doorsEW"].push({ c, r, y, kind: item.kind });
    if (item.kind === "wall" || item.kind === "window") out[eastWest ? "wallsNS" : "wallsEW"].push({ c, r, y, centered: true });
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
    const origin = wallOrigin(record, 0);
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
    const record = { c, r, floor: true, y: isDiscovered(info.region) ? rise(info.elevationFt) : 0 };
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
  addInstances(group, lowWallGeometryNS, mats.lowWall, sets.lowNS, (m, value) => wallTransform(m, value, 0.56, 0));
  addInstances(group, lowWallGeometryEW, mats.lowWall, sets.lowEW, (m, value) => wallTransform(m, value, 0.56, 0));
  addInstances(group, doorGeometryNS, mats.wood, sets.doorsNS.filter((value) => value.kind === "door"), (m, value) => wallTransform(m, value, 1.22, 0));
  addInstances(group, doorGeometryEW, mats.wood, sets.doorsEW.filter((value) => value.kind === "door"), (m, value) => wallTransform(m, value, 1.22, 0));
  addInstances(group, stoneBlockNS, mats.wallTop, doorFrameCourses(sets.doorsNS, "ns"), (m, value) => m.makeTranslation(value.x, value.y, value.z));
  addInstances(group, stoneBlockEW, mats.wallTop, doorFrameCourses(sets.doorsEW, "ew"), (m, value) => m.makeTranslation(value.x, value.y, value.z));

  const chunkProps = (state.blueprint.props || []).filter((item) => {
    const info = cellInfo(item.c, item.r);
    return item.c >= bounds.minC && item.c < bounds.maxC && item.r >= bounds.minR && item.r < bounds.maxR && info && isDiscovered(info.region);
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

  const chunkSpawns = (state.blueprint.spawns || []).filter((item) => {
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
function rebuildAll() {
  state.chunks.forEach((group) => { boardRoot.remove(group); disposeObject(group); });
  state.chunks.clear();
  const size = state.blueprint.grid.chunkSize;
  for (let r = 0; r < state.blueprint.grid.rows; r += size) {
    for (let c = 0; c < state.blueprint.grid.cols; c += size) buildChunk(Math.floor(c / size), Math.floor(r / size));
  }
  buildLights();
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
  requestRender(animate ? 520 : 0);
}
function rebuildCellChunk(c, r) {
  const chunk = BP.chunkFor(state.blueprint, c, r);
  buildChunk(chunk.c, chunk.r);
  ui.chunkStatus.textContent = "chunk " + chunk.key + " · 1/" + BP.chunkCount(state.blueprint);
  ui.chunkStatus.className = "status good";
  requestRender();
}

function updateCutaway() {
  const dir = camera.position.clone().sub(controls.target).normalize();
  boardRoot.traverse((child) => {
    if (!child.userData.cutaway || !child.material) return;
    child.material.opacity = Math.abs(dir.y) > 0.86 ? 0.42 : 0.24;
  });
}
function drawSelection() {
  while (selectionRoot.children.length) selectionRoot.remove(selectionRoot.children[0]);
  if (!state.selected) return;
  const info = cellInfo(state.selected.c, state.selected.r);
  if (!info) return;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), mats.select);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(worldX(state.selected.c), (isDiscovered(info.region) ? rise(info.elevationFt) : 0) + 0.09, worldZ(state.selected.r));
  mesh.renderOrder = 40;
  selectionRoot.add(mesh);
  const item = explicitArchitectureAt(state.selected.c, state.selected.r);
  if (item && ["wall", "lowWall", "door"].includes(item.kind)) {
    const axis = new THREE.Mesh(selectionAxisGeometry, mats.selectAxis);
    axis.position.copy(mesh.position);
    axis.position.y += 0.035;
    axis.rotation.y = BP.normalizeRotation(item.rotation) % 180 === 0 ? 0 : Math.PI / 2;
    axis.renderOrder = 41;
    axis.userData.sharedGeometry = true;
    selectionRoot.add(axis);
  }
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
  const connectivity = BP.connectivity(state.map);
  ui.contractStatus.textContent = valid.ok ? "field valid" : "field invalid";
  ui.contractStatus.className = "status " + (valid.ok ? "good" : "bad");
  ui.connectivityStatus.textContent = connectivity.ok ? "connected" : connectivity.missing.length + " isolated";
  ui.connectivityStatus.className = "status " + (connectivity.ok ? "good" : "bad");
}

function sizeScrawl() {
  const rect = ui.scrawlStage.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  ui.scrawlStage.width = Math.max(1, Math.round(rect.width * ratio));
  ui.scrawlStage.height = Math.max(1, Math.round(rect.height * ratio));
  drawScrawl();
}
function scrawlColor(materialKey) {
  return {
    nave: "#b8ae98", cloister: "#7e8a70", crypt: "#7a858a",
    timber: "#846b4f", water: "#557d83"
  }[materialKey] || "#aaa18d";
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
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (let r = 0; r < state.map.rows; r++) for (let c = 0; c < state.map.cols; c++) {
    const info = cellInfo(c, r);
    if (!info) continue;
    const discovered = isDiscovered(info.region);
    ctx.fillStyle = discovered ? scrawlColor(info.material) : "#8b8b84";
    ctx.globalAlpha = discovered ? 0.88 : 0.48;
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
    if (!info || !isDiscovered(info.region)) continue;
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
    const item = explicitArchitectureAt(c, r);
    if (item) drawScrawlArchitecture(ctx, item, x, y, cell);
  }
  drawScrawlProps(ctx, cell, ox, oy);
  drawScrawlSpawns(ctx, cell, ox, oy);
  if (state.selected) {
    ctx.strokeStyle = "#f2d27c"; ctx.lineWidth = Math.max(2, cell * 0.16);
    ctx.strokeRect(ox + state.selected.c * cell + 1, oy + state.selected.r * cell + 1, cell - 2, cell - 2);
  }
  ctx.fillStyle = "rgba(44,48,45,.72)";
  ctx.font = Math.max(11, cell * 0.6) + "px Georgia";
  ctx.fillText("SCrawl · " + state.blueprint.name, ox, Math.max(18, oy - cell * 0.7));
}
function drawScrawlArchitecture(ctx, item, x, y, cell) {
  const horizontal = BP.normalizeRotation(item.rotation) % 180 === 0;
  ctx.save();
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
    if (!info || !isDiscovered(info.region)) return;
    const x = ox + (item.c + 0.5) * cell, y = oy + (item.r + 0.5) * cell;
    ctx.fillStyle = item.kind === "pool" ? "#4d7d83" : (item.kind === "brazier" ? "#bd7846" : "#625e55");
    ctx.beginPath();
    if (item.kind === "crates") ctx.rect(x - cell * 0.22, y - cell * 0.22, cell * 0.44, cell * 0.44);
    else ctx.arc(x, y, cell * (item.kind === "pillar" ? 0.22 : 0.18), 0, Math.PI * 2);
    ctx.fill();
  });
}
function drawScrawlSpawns(ctx, cell, ox, oy) {
  (state.blueprint.spawns || []).forEach((item) => {
    const info = cellInfo(item.c, item.r);
    if (!info || !isDiscovered(info.region)) return;
    ctx.fillStyle = item.side === "pc" ? "#56827e" : "#aa4e43";
    ctx.strokeStyle = "#ece1c8"; ctx.lineWidth = Math.max(1, cell * 0.08);
    ctx.beginPath(); ctx.arc(ox + (item.c + 0.5) * cell, oy + (item.r + 0.5) * cell, cell * 0.27, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  });
}

function setView(view) {
  state.view = view === "scrawl" ? "scrawl" : "diorama";
  ui.threeStage.style.display = state.view === "diorama" ? "block" : "none";
  ui.scrawlStage.style.display = state.view === "scrawl" ? "block" : "none";
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  if (state.view === "scrawl") sizeScrawl(); else resize();
}
function updateRegionControls() {
  ui.zoneRegion.replaceChildren();
  state.blueprint.discoveryRegions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region.id; option.textContent = region.label;
    ui.zoneRegion.appendChild(option);
  });
  syncZoneValues();
}
function syncZoneValues() {
  const region = ui.zoneRegion.value;
  const space = state.blueprint.spaces.find((item) => item.discoveryRegion === region);
  if (!space) return;
  ui.zoneElevation.value = String(space.elevationFt || 0);
  ui.zoneMaterial.value = space.material || "nave";
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
  drawScrawl();
}
function loadFixture(key) {
  if (!BP.FIXTURES[key]) return;
  state.fixtureKey = key;
  state.blueprint = BP.copy(BP.FIXTURES[key]);
  state.edits = {};
  state.selected = null;
  state.discovered = new Set([state.blueprint.discoveryRegions[0].id]);
  document.querySelectorAll("[data-fixture]").forEach((button) => button.classList.toggle("active", button.dataset.fixture === key));
  updateRegionControls();
  refreshDocument();
  setTool("wall", true);
  setRotation(0, false);
  rebuildAll();
  frameBoard();
}
function frameBoard() {
  const span = Math.max(state.blueprint.grid.cols, state.blueprint.grid.rows);
  controls.target.set(0, 0, 0);
  camera.position.set(span * 0.72, span * 0.8, span * 0.9);
  controls.update();
  requestRender();
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
}
function resetDiscovery() {
  state.discovered = new Set([state.blueprint.discoveryRegions[0].id]);
  refreshDocument();
  rebuildAll();
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
  state.rotation = BP.normalizeRotation(value);
  ui.rotationValue.textContent = state.rotation + "°";
  if (!rotateSelected || !state.selected) return;
  const item = explicitArchitectureAt(state.selected.c, state.selected.r);
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
    if (["wall", "lowWall", "door"].includes(existing.kind)) setTool(existing.kind, false);
    setRotation(existing.rotation, false);
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
  refreshDocument();
  rebuildCellChunk(c, r);
  drawSelection();
  drawScrawl();
  ui.rotationLabel.textContent = state.tool === "erase" ? "Placement angle" : moduleLabel(state.tool) + " selected";
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener("pointerup", (event) => {
  if (event.button !== 0) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = (event.clientX - rect.left) / rect.width * 2 - 1;
  pointer.y = -(event.clientY - rect.top) / rect.height * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const meshes = [];
  boardRoot.traverse((child) => { if (child.userData.pickableFloor) meshes.push(child); });
  const hit = raycaster.intersectObjects(meshes, false)[0];
  if (!hit || hit.instanceId == null) return;
  const cell = hit.object.userData.cells[hit.instanceId];
  if (cell) applyEdit(cell.c, cell.r);
});
ui.scrawlStage.addEventListener("pointerup", (event) => {
  const rect = ui.scrawlStage.getBoundingClientRect(), transform = state.scrawlTransform;
  if (!transform) return;
  const ratioX = ui.scrawlStage.width / rect.width, ratioY = ui.scrawlStage.height / rect.height;
  const x = (event.clientX - rect.left) * ratioX, y = (event.clientY - rect.top) * ratioY;
  const c = Math.floor((x - transform.ox) / transform.cell), r = Math.floor((y - transform.oy) / transform.cell);
  if (c >= 0 && r >= 0 && c < state.map.cols && r < state.map.rows) applyEdit(c, r);
});

document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
document.querySelectorAll("[data-quality]").forEach((button) => button.addEventListener("click", () => applyQuality(button.dataset.quality)));
document.querySelectorAll("[data-fixture]").forEach((button) => button.addEventListener("click", () => loadFixture(button.dataset.fixture)));
document.querySelectorAll("[data-tool]").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool, true)));
ui.revealNext.addEventListener("click", revealNext);
ui.resetDiscovery.addEventListener("click", resetDiscovery);
ui.focusHero.addEventListener("click", focusHeroRoom);
ui.rotateLeft.addEventListener("click", () => setRotation(state.rotation - 90));
ui.rotateRight.addEventListener("click", () => setRotation(state.rotation + 90));
ui.zoneRegion.addEventListener("change", syncZoneValues);
ui.applyZone.addEventListener("click", () => {
  const region = ui.zoneRegion.value;
  state.blueprint = BP.changeZone(state.blueprint, region, Number(ui.zoneElevation.value), ui.zoneMaterial.value);
  refreshDocument();
  rebuildRegion(region, true);
});
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) requestRender();
});

try {
  updateRegionControls();
  refreshDocument();
  applyQuality("balanced");
  rebuildAll();
  frameBoard();
  setView("diorama");
} catch (error) {
  console.error(error);
  ui.fatal.textContent = "The standalone proof could not start: " + error.message;
  ui.fatal.classList.add("on");
}
