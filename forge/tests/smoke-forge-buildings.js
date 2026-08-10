const assert = require("assert");
const fs = require("fs");
const path = require("path");

const forgeDir = path.join(__dirname, "..");
const BP = require(path.join(forgeDir, "forge-blueprint.js"));
const Buildings = require(path.join(forgeDir, "forge-buildings.js"));
const Snapshot = require(path.join(forgeDir, "forge-combat-snapshot.js"));
const LocalCombat = require(path.join(forgeDir, "forge-combat-local.js"));
const SharedCombat = require(path.join(forgeDir, "forge-combat-shared.js"));
const Replay = require(path.join(forgeDir, "forge-replay.js"));
const Surfaces = require(path.join(forgeDir, "forge-surfaces.js"));
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
const surfaceMap = BP.compile(blueprint, {});
const surfaceContract = Surfaces.attach(surfaceMap);
ok("guarded surface compilation promotes the named building floors",
  surfaceContract.receipt.buildingSurfaces === 8
  && ["surface-lower-garden", "surface-courtyard", "surface-hall", "surface-gallery"].every((id) => Surfaces.surfaceById(surfaceContract, id)));
ok("the gallery opening remains a void rather than walkable upper floor",
  !Surfaces.surfacePosition(surfaceContract, "surface-gallery", 15, 9));
ok("the gallery staircase owns four gradual tactical segments",
  surfaceContract.connectors.find((item) => item.id === "connector-gallery-stairs").path.map((point) => point.elevationFt).join("|") === "0|2.5|5|7.5|10");
const surfaceFight = LocalCombat.createFight(surfaceMap, fieldDeployment, fieldParty, BP.copy(LocalCombat.TRAINING_FOES), {
  blueprintId: blueprint.id, fingerprint: BP.fingerprint(blueprint), structuralFingerprint: BP.structuralFingerprint(blueprint)
});
surfaceFight.turn = surfaceFight.units.findIndex((unit) => unit.unit === "field-pc");
Object.assign(surfaceFight.units[surfaceFight.turn], { c: 17, r: 11, surfaceId: "surface-hall", elevationFt: 0, moved: false });
surfaceFight.units.filter((unit) => unit.side === "foe").forEach((unit, index) => {
  Object.assign(unit, { c: 12 + index, r: 6, surfaceId: "surface-hall", elevationFt: 0 });
});
Object.assign(surfaceFight.units.find((unit) => unit.unit === "reliquary-guard-1"), { c: 17, r: 7 });
const galleryDestination = { c: 17, r: 7, surfaceId: "surface-gallery", elevationFt: 10 };
const galleryReach = LocalCombat.reachableForActive(surfaceFight);
ok("the real local fight reaches the gallery only through its surface-aware stair route",
  galleryReach[Surfaces.positionKey(galleryDestination)]?.costFt === 20
  && surfaceFight.units.some((unit) => unit.c === 17 && unit.r === 7 && unit.surfaceId === "surface-hall"));
const climbed = LocalCombat.moveActive(surfaceFight, galleryDestination);
ok("a real local combatant climbs every stair segment and lands at +10 feet",
  climbed.ok && climbed.path.length === 4
  && climbed.fight.units[climbed.fight.turn].surfaceId === "surface-gallery"
  && climbed.fight.units[climbed.fight.turn].elevationFt === 10);
const surfaceStartSaved = Snapshot.create({ blueprint, edits: {}, fight: surfaceFight });
const sharedClimb = SharedCombat.prepareMove(surfaceFight, galleryDestination, 2);
const surfaceReplay = Snapshot.replayBaseline(surfaceStartSaved);
Replay.applyEvent(surfaceReplay, { seq: 3, unit: "field-pc", kind: "move_declared", payload: { path: sharedClimb.path } }, null);
Replay.applyEvent(surfaceReplay, { seq: 4, unit: "field-pc", kind: "move_resolved", payload: sharedClimb.resolved }, null);
ok("shared movement replay retains the gallery surface instead of flattening to c/r",
  surfaceReplay.units["field-pc"].pos.surfaceId === "surface-gallery"
  && surfaceReplay.units["field-pc"].pos.elevationFt === 10);
ok("a second renderer reconstructs the same climbed surface fight",
  Snapshot.fightFromReplay(surfaceStartSaved, surfaceReplay).units.find((unit) => unit.unit === "field-pc").surfaceId === "surface-gallery");
const surfaceSaved = Snapshot.create({ blueprint, edits: {}, fight: climbed.fight });
const surfaceReopened = Snapshot.restore(surfaceSaved);
ok("exact snapshot reopen preserves the combatant’s gallery identity",
  surfaceSaved.combat.surfaceAware === true
  && surfaceReopened.fight.units[surfaceReopened.fight.turn].surfaceId === "surface-gallery"
  && surfaceReopened.fight.map.surfaceContract.fingerprint === surfaceMap.surfaceContract.fingerprint);
surfaceReopened.fight.units[surfaceReopened.fight.turn].moved = false;
const descended = LocalCombat.moveActive(surfaceReopened.fight, { c: 17, r: 11, surfaceId: "surface-hall", elevationFt: 0 });
ok("the reopened combatant can descend the same authored staircase",
  descended.ok && descended.path.length === 4 && descended.fight.units[descended.fight.turn].elevationFt === 0);
ok("shared restore baseline carries the complete surface position",
  Snapshot.replayBaseline(surfaceSaved).units["field-pc"].pos.surfaceId === "surface-gallery"
  && Snapshot.roster(surfaceSaved).find((row) => row.unit === "field-pc").pos.elevationFt === 10);
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
  && combatHtml.includes('src="forge-surfaces.js?v=fs2"')
  && combatHtml.includes('src="combat.js?v=fc13"')
  && combatHtml.includes('src="forge-combat-local.js?v=fcl3"')
  && combatHtml.includes('src="forge-combat-shared.js?v=fcsw1"')
  && combatHtml.includes('src="forge-replay.js?v=fb20"')
  && combatHtml.includes('src="forge-combat-snapshot.js?v=fcs3"'));
ok("River Archive template is hidden until the explicit building flag", combatHtml.includes('data-building-template="river-archive" hidden'));
ok("template grid cannot override the guarded hidden state", combatCss.includes(".creation-deck>button[hidden]{display:none}"));
ok("runtime guard requires the explicit buildings query value", combatJs.includes('get("buildings") === "1"'));
ok("camera views ease to their framing and leave Orbit controls available",
  combatJs.includes("animateCameraTransition") && combatJs.includes('controls.addEventListener("start"'));
ok("roof has a direct reversible visibility control",
  combatHtml.includes('id="toggleBuildingRoof"') && combatJs.includes("toggleBuildingRoofVisibility") && combatJs.includes("buildingRoofHidden"));
ok("roof, walls, floors, and stairs participate in Board selection",
  combatJs.includes("buildingPartFromEvent") && ["roof", "wall", "floor", "stairs"].every((kind) => combatJs.includes('kind: "' + kind + '"')));
ok("local combat promotes guarded surface movement without changing the flat default",
  !combatJs.includes("Stacked-floor combat is intentionally locked")
  && combatJs.includes("surfacesEnabled()")
  && combatJs.includes("Gold cells follow the current floor and the authored stair route"));
ok("ground-floor combat automatically exposes the hall",
  combatJs.includes('state.buildingRoofHidden = true')
  && combatJs.includes("fightBuildingViewId()")
  && combatJs.includes('return active.surfaceId === "surface-gallery"'));
ok("shared combat publishes movement, attacks, and turns through the existing pipeline",
  combatJs.includes("publishSharedMove") && combatJs.includes("publishSharedAttack") && combatJs.includes("publishSharedEndTurn")
  && combatJs.includes("SharedCombat.transcript"));

console.log("\n" + passed + " Forge building checks passed");
