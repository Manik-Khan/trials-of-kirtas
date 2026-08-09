const assert = require("assert");
const fs = require("fs");
const path = require("path");

const forgeDir = path.join(__dirname, "..");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const Buildings = require(path.join(forgeDir, "forge-buildings.js"));
const Snapshot = require(path.join(forgeDir, "forge-combat-snapshot.js"));
const LocalCombat = require(path.join(forgeDir, "forge-combat-local.js"));
const combatHtml = fs.readFileSync(path.join(forgeDir, "combat.html"), "utf8");
const combatJs = fs.readFileSync(path.join(forgeDir, "combat.js"), "utf8");
const combatCss = fs.readFileSync(path.join(forgeDir, "combat.css"), "utf8");

let passed = 0;
function ok(name, value) {
  assert.ok(value, name);
  passed++;
  console.log("✓ " + name);
}

const blueprint = Buildings.createRiverArchive(BP);
const building = blueprint.buildingSet.buildings[0];
const surfaces = building.surfaces;
const connectors = building.connectors;
const map = BP.compile(blueprint, {});

ok("building authority exports versioned schemas",
  Buildings.SCHEMA === "forge-building-set/v1" && Buildings.VIEW_SCHEMA === "forge-camera-view/v1");
ok("River Archive is a valid guarded building record", Buildings.validate(blueprint).ok && blueprint.source.guarded === true);
ok("walk surfaces have stable unique identities", new Set(surfaces.map((surface) => surface.id)).size === surfaces.length);
ok("logical elevations preserve the signed lower floor and gradual storeys",
  [-10, 0, 0, 10, 20].every((height) => surfaces.some((surface) => surface.elevationFt === height)));
ok("renderer datum offsets presentation without mutating logical elevation",
  Buildings.renderDatum(blueprint).offsetFt === 10 && Buildings.surfaceById(blueprint, "surface-lower-garden").elevationFt === -10);
ok("hall and courtyard remain distinct surfaces at the same elevation",
  Buildings.surfaceById(blueprint, "surface-hall").elevationFt === Buildings.surfaceById(blueprint, "surface-courtyard").elevationFt
  && Buildings.surfaceById(blueprint, "surface-hall").id !== Buildings.surfaceById(blueprint, "surface-courtyard").id);
ok("hall and gallery can occupy the same grid footprint without merging",
  BP.stableStringify(Buildings.surfaceById(blueprint, "surface-hall").polygon) === BP.stableStringify(Buildings.surfaceById(blueprint, "surface-gallery").polygon)
  && Buildings.surfaceById(blueprint, "surface-hall").id !== Buildings.surfaceById(blueprint, "surface-gallery").id);
ok("upper gallery authors an open hall instead of rendering one blank platform",
  Buildings.surfaceById(blueprint, "surface-gallery").openings[0].id === "opening-gallery-hall");

const door = connectors.find((item) => item.kind === "door");
const galleryStairs = connectors.find((item) => item.id === "connector-gallery-stairs");
ok("same-level door derives a zero-foot rise", door.riseFt === 0 && door.path.every((point) => point.elevationFt === 0));
ok("gallery stairs derive gradual 2.5-foot steps from their landings",
  BP.stableStringify(galleryStairs.path.map((point) => point.elevationFt)) === BP.stableStringify([0, 2.5, 5, 7.5, 10]));
ok("stair authority authors landings and derives rise, segments, and path",
  galleryStairs.authority.authored.join("|") === "from.surfaceId|to.surfaceId"
  && galleryStairs.authority.derived.includes("path[].elevationFt")
  && !Object.prototype.hasOwnProperty.call(galleryStairs, "heightFt"));

ok("four versioned DM camera views ship with the template",
  blueprint.cameraViews.length === 4 && blueprint.cameraViews.every((view) => view.schema === Buildings.VIEW_SCHEMA && view.dmAuthored));
ok("interior views name an existing floor surface",
  blueprint.cameraViews.filter((view) => view.shellMode === "interior").every((view) => Buildings.surfaceById(blueprint, view.floorSurfaceId)));
ok("hall view requests a roof-and-wall cutaway",
  Buildings.presentation(blueprint, "view-archive-hall").roofOpacity < 1
  && Buildings.presentation(blueprint, "view-archive-hall").nearWallOpacity < 1);
ok("establishing view restores the complete exterior shell",
  Buildings.presentation(blueprint, "view-archive-establishing").roofOpacity === 1
  && Buildings.presentation(blueprint, "view-archive-establishing").floorSurfaceId === null);

ok("guarded template still compiles to a valid production field", BP.validateMap(map).ok);
ok("guarded template keeps its temporary ground footprint connected", BP.tacticalConnectivity(map).ok);
const fieldParty = [{
  unit: "field-pc", name: "Field PC", side: "pc", hp: 20, hpMax: 20, ac: 15, speed: 40, initMod: 20,
  action: { id: "blade", label: "Blade", rng: 1, hit: 5, dmg: "1d8+3", damage: 7 }
}];
const fieldGroups = [
  { id: "party-main", label: "Party", role: "party", formation: "cluster", unitIds: ["field-pc"], anchor: { c: 7, r: 10 }, seed: 1 },
  { id: "enemy-main", label: "Enemy", role: "enemy", formation: "cluster", unitIds: LocalCombat.TRAINING_FOES.map((unit) => unit.unit), anchor: { c: 18, r: 7 }, seed: 2 }
];
const fieldDeployment = LocalCombat.deployCombatants(map, fieldParty, BP.copy(LocalCombat.TRAINING_FOES), fieldGroups);
ok("River Archive can deploy a real local ground-floor fight", fieldDeployment.ok);
const fieldFight = LocalCombat.createFight(map, fieldDeployment, fieldParty, BP.copy(LocalCombat.TRAINING_FOES), {
  blueprintId: blueprint.id, fingerprint: BP.fingerprint(blueprint), structuralFingerprint: BP.structuralFingerprint(blueprint)
});
ok("a courtyard character can move through the entrance into the hall",
  Object.keys(LocalCombat.reachableForActive(fieldFight)).some((key) => Number(key.split(",")[0]) >= 11));
ok("compiled receipt carries the exact building contract",
  BP.stableStringify(map.meta.buildingSet) === BP.stableStringify(blueprint.buildingSet));
ok("compiled receipt carries the exact DM views",
  BP.stableStringify(map.meta.cameraViews) === BP.stableStringify(blueprint.cameraViews));
const ordinary = BP.withSource(BP.FIXTURES.processional, "fixture", { fixtureKey: "processional" });
const ordinaryMap = BP.compile(ordinary, {});
ok("ordinary maps retain their previous compiled receipt shape",
  !Object.prototype.hasOwnProperty.call(ordinaryMap.meta, "buildingSet")
  && !Object.prototype.hasOwnProperty.call(ordinaryMap.meta, "cameraViews"));

const changedBuilding = BP.copy(blueprint);
changedBuilding.buildingSet.buildings[0].surfaces[3].elevationFt = 15;
ok("full Blueprint identity changes when authored building space changes", BP.fingerprint(changedBuilding) !== BP.fingerprint(blueprint));
ok("structural identity changes when authored building space changes", BP.structuralFingerprint(changedBuilding) !== BP.structuralFingerprint(blueprint));
const changedView = BP.copy(blueprint);
changedView.cameraViews[0].target.c += 1;
ok("structural identity includes DM-authored camera views", BP.structuralFingerprint(changedView) !== BP.structuralFingerprint(blueprint));

const saved = Snapshot.create({
  savedAt: "2026-08-08T22:00:00.000Z", blueprint, edits: {},
  renderer: { view: "board", quality: "balanced", buildingViewId: "view-archive-hall", roofHidden: true },
  discovered: blueprint.discoveryRegions.map((region) => region.id)
});
const reopened = Snapshot.restore(saved);
ok("exact snapshot stores the complete building set", BP.stableStringify(saved.authored.blueprint.buildingSet) === BP.stableStringify(blueprint.buildingSet));
ok("exact snapshot reopens every signed floor unchanged", BP.stableStringify(reopened.blueprint.buildingSet) === BP.stableStringify(blueprint.buildingSet));
ok("exact snapshot reopens every authored camera view unchanged", BP.stableStringify(reopened.blueprint.cameraViews) === BP.stableStringify(blueprint.cameraViews));
ok("exact snapshot reopens the active building view and roof visibility",
  reopened.renderer.buildingViewId === "view-archive-hall" && reopened.renderer.roofHidden === true);
ok("exact snapshot verifies all three saved identities",
  saved.authored.blueprintFingerprint === BP.fingerprint(reopened.blueprint)
  && saved.authored.structuralFingerprint === BP.structuralFingerprint(reopened.blueprint)
  && saved.authored.fieldFingerprint === Snapshot.fieldFingerprint(reopened.map));

ok("production loads cache-stamped guarded building authority",
  combatHtml.includes('src="forge-buildings.js?v=fbld2"')
  && combatHtml.includes('src="forge-blueprint.js?v=bp6"')
  && combatHtml.includes('src="combat.js?v=fc10"')
  && combatHtml.includes('src="forge-combat-snapshot.js?v=fcs2"'));
ok("River Archive template is hidden until the explicit building flag", combatHtml.includes('data-building-template="river-archive" hidden'));
ok("template grid cannot override the guarded hidden state", combatCss.includes(".creation-deck>button[hidden]{display:none}"));
ok("runtime guard requires the explicit buildings query value", combatJs.includes('get("buildings") === "1"'));
ok("camera views ease to their framing and leave Orbit controls available",
  combatJs.includes("animateCameraTransition") && combatJs.includes('controls.addEventListener("start"'));
ok("roof has a direct reversible visibility control",
  combatHtml.includes('id="toggleBuildingRoof"') && combatJs.includes("toggleBuildingRoofVisibility") && combatJs.includes("buildingRoofHidden"));
ok("roof, walls, floors, and stairs participate in Board selection",
  combatJs.includes("buildingPartFromEvent") && ["roof", "wall", "floor", "stairs"].every((kind) => combatJs.includes('kind: "' + kind + '"')));
ok("local combat is no longer refused for the building",
  !combatJs.includes("Stacked-floor combat is intentionally locked")
  && combatJs.includes("Ground-floor combat is active")
  && combatJs.includes("upper gallery remains presentation-only"));
ok("ground-floor combat automatically exposes the hall",
  combatJs.includes('state.buildingRoofHidden = true')
  && combatJs.includes('state.fight ? "view-archive-hall" : state.buildingViewId'));
ok("shared combat remains on its existing locked gate", combatJs.includes("Shared combat actions remain locked until the two-device reconnect field gate passes."));

console.log("\n" + passed + " Forge building checks passed");
