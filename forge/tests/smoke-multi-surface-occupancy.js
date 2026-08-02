const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Core = require("../../_edits/mock-forge-multi-surface-occupancy-core.js");

const html = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-multi-surface-occupancy.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-multi-surface-occupancy.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-multi-surface-occupancy.js"), "utf8");
let passed = 0;
function ok(name, value) { assert.ok(value, name); passed++; console.log("✓ " + name); }

const scene = Core.createScene();
const units = Core.createUnits();
const ground = Core.surfaceById(scene, "surface-ground");
const bridge = Core.surfaceById(scene, "surface-market-bridge");
const stairs = Core.surfaceById(scene, "surface-east-stairs");
const mira = units.find((unit) => unit.id === "mira");
const vale = units.find((unit) => unit.id === "vale");
const groundRaider = units.find((unit) => unit.id === "raider-ground");
const deckRaider = units.find((unit) => unit.id === "raider-deck");

ok("the proof owns an explicit versioned multi-surface scene", scene.schema === "forge-multi-surface-scene/v1" && scene.version === 1);
ok("the authored scene and opening combatants validate", Core.validateScene(scene, units).ok);
ok("every walk surface has a stable distinct ID", new Set(scene.surfaces.map((surface) => surface.id)).size === scene.surfaces.length);
ok("ground and bridge deck both exist at cell 5,4", Core.surfacesAt(scene, 5, 4).map((position) => position.surfaceId).join("|") === "surface-ground|surface-market-bridge");
ok("the bridge retains a 20-ft deck and 19-ft under-clearance", bridge.elevationFt === 20 && bridge.clearanceFt === 19 && bridge.deckThicknessFt === 1);
ok("the east stairs retain separate 15, 10, and 5-ft walk points", stairs.cells.map((cell) => cell.elevationFt).join(",") === "15,10,5");
ok("Mira and Vale share grid coordinates but not a surface", mira.c === vale.c && mira.r === vale.r && mira.surfaceId !== vale.surfaceId);
ok("surface-aware position keys distinguish the above/below pair", Core.positionKey(Core.unitPosition(mira)) !== Core.positionKey(Core.unitPosition(vale)));
ok("surface-aware occupancy retains all four opening combatants", Core.occupiedPositions(units).size === 4);

const stacked = JSON.parse(JSON.stringify(units));
stacked[1].surfaceId = stacked[0].surfaceId; stacked[1].elevationFt = stacked[0].elevationFt;
ok("validation rejects stacking on the same walk surface", !Core.validateScene(scene, stacked).ok);
ok("the ground under the bridge remains a legal walk surface", !!Core.surfacePosition(scene, ground.id, 6, 4));
ok("the bridge deck above it remains independently legal", !!Core.surfacePosition(scene, bridge.id, 6, 4));
ok("the stair connector names every surface transition explicitly", scene.connectors[0].path.every((point) => Core.surfacePosition(scene, point.surfaceId, point.c, point.r)));

const miraReach = Core.reachable(scene, mira, units, 30);
ok("ground movement reaches another ground position below the bridge", !!miraReach["6,4@surface-ground"]);
ok("ordinary 30-ft ground movement does not jump directly to the deck", !miraReach["5,4@surface-market-bridge"]);
const valeReach = Core.reachable(scene, vale, units, 30);
ok("deck movement remains available across the bridge", !!valeReach["7,4@surface-market-bridge"]);
ok("the deck route can enter the explicit stair surface", !!valeReach["9,5@surface-east-stairs"] && valeReach["9,5@surface-east-stairs"].via === "stairs");
const sentryReach = Core.reachable(scene, deckRaider, units, 30);
ok("a deck combatant can descend the complete stair route to ground", !!sentryReach["9,8@surface-ground"]);

const climber = { id: "climber", name: "Climber", c: 2, r: 4, surfaceId: "surface-ground", elevationFt: 0, speedFt: 40, climbSpeedFt: 0, alive: true };
const ordinaryClimb = Core.reachable(scene, climber, [climber], 40);
ok("an ordinary 20-ft climb costs 40 feet", ordinaryClimb["2,4@surface-market-bridge"].costFt === 40);
climber.climbSpeedFt = 30;
const skilledClimb = Core.reachable(scene, climber, [climber], 20);
ok("a climbing speed reduces that same rise to 20 feet", skilledClimb["2,4@surface-market-bridge"].costFt === 20);
const climbed = Core.moveUnit(scene, [climber], "climber", { c: 2, r: 4, surfaceId: "surface-market-bridge", elevationFt: 20 }, 20);
ok("a connector may change surface without changing grid coordinates", climbed.ok && climbed.units[0].c === 2 && climbed.units[0].r === 4 && climbed.units[0].surfaceId === "surface-market-bridge");

const underpassSight = Core.sightVerdict(scene, mira, groundRaider);
ok("ground-to-ground sight remains clear through the underpass", underpassSight.canTarget && underpassSight.cover === "none");
const verticalSight = Core.sightVerdict(scene, mira, vale);
ok("the physical deck blocks a vertical shot through the same cell", !verticalSight.canTarget && verticalSight.culprits["bridge-deck"] === 3);
const deckSight = Core.sightVerdict(scene, vale, deckRaider);
ok("combatants sharing the bridge surface retain clear deck sight", deckSight.canTarget && deckSight.cover === "none");
ok("range uses the actual 20-ft vertical separation", Core.range3d(mira, vale) === 20);

const moved = Core.moveUnit(scene, units, "raider-deck", { c: 9, r: 8, surfaceId: "surface-ground", elevationFt: 0 }, 30);
ok("surface-aware movement returns the exact connector path and cost", moved.ok && moved.costFt === 25 && moved.path.some((step) => step.connectorId === "connector-east-stairs"));
const snapshot = Core.createSnapshot(scene, moved.units);
const restored = Core.restoreSnapshot(JSON.parse(JSON.stringify(snapshot)));
ok("snapshots carry a versioned multi-surface contract", snapshot.schema === "forge-multi-surface-snapshot/v1");
ok("snapshot reload preserves every exact surface position", restored.units.map((unit) => Core.positionKey(Core.unitPosition(unit))).join("|") === moved.units.map((unit) => Core.positionKey(Core.unitPosition(unit))).join("|"));
const corrupt = JSON.parse(JSON.stringify(snapshot)); corrupt.units[0].position.surfaceId = "surface-missing";
let corruptRejected = false; try { Core.restoreSnapshot(corrupt); } catch (_) { corruptRejected = true; }
ok("snapshot reload refuses an unknown surface instead of inferring a floor", corruptRejected);

ok("the UI exposes tactical, height, and split views", ["board", "height", "split"].every((view) => html.includes(`data-view="${view}"`)));
ok("the UI exposes both, ground, and raised surface filters", ["all", "ground", "raised"].every((layer) => html.includes(`data-layer="${layer}"`)));
ok("the position contract is visible before interaction", html.includes("{ c, r, surfaceId, elevationFt }") && html.includes("Two floors, one grid coordinate"));
ok("the proof draws both the tactical board and a truthful height canvas", /id="board"/.test(html) && /id="heightPreview"/.test(html) && /drawHeightPreview/.test(js));
ok("the proof includes movement, sight, climb-speed, and snapshot controls", /moveUnit/.test(js) && /sightVerdict/.test(js) && /climbSpeed/.test(html) && /roundTrip/.test(html));
ok("all local assets carry cache stamps after the interaction revision", html.includes("occupancy.css?v=mso1") && html.includes("occupancy-core.js?v=mso2") && html.includes("occupancy.js?v=mso2"));
ok("the mock is isolated from production sessions and network data", !/fetch\(|supabase|localStorage|sessionStorage/i.test(html + js + css));

console.log(`\n${passed}/${passed} passed\n`);
