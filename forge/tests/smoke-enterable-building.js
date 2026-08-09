const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Core = require("../../_edits/mock-forge-enterable-building-core.js");

const html = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-enterable-building.html"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-enterable-building.css"), "utf8");
const js = fs.readFileSync(path.join(__dirname, "../../_edits/mock-forge-enterable-building.js"), "utf8");
let passed = 0;
function ok(name, value) { assert.ok(value, name); passed++; console.log("✓ " + name); }

const scene = Core.createScene();
const validation = Core.validateScene(scene);
const lower = Core.surfaceById(scene, "surface-lower-garden");
const courtyard = Core.surfaceById(scene, "surface-courtyard");
const hall = Core.surfaceById(scene, "surface-hall");
const gallery = Core.surfaceById(scene, "surface-gallery");
const interiorStairs = Core.connectorById(scene, "connector-hall-gallery");
const gardenStairs = Core.connectorById(scene, "connector-garden-stairs");
const door = Core.connectorById(scene, "connector-front-door");

ok("the proof owns a versioned stacked-place document", scene.schema === "forge-stacked-place-proof/v1" && scene.version === 1);
ok("the authored scene validates without inferred repair geometry", validation.ok && validation.errors.length === 0);
ok("every walk surface has a stable distinct ID", new Set(scene.surfaces.map((surface) => surface.id)).size === scene.surfaces.length);
ok("signed logical elevation retains the lower garden below zero", lower.elevationFt === -10);
ok("the courtyard and hall may share zero without becoming the same surface", courtyard.elevationFt === 0 && hall.elevationFt === 0 && courtyard.id !== hall.id);
ok("the upper gallery owns its +10-ft elevation", gallery.elevationFt === 10);
ok("the renderer chooses a +10-ft display offset from the lowest logical surface", Core.renderDatum(scene).offsetFt === 10);
ok("render translation does not mutate signed logical elevations", Core.toRenderElevation(scene, -10) === 0 && lower.elevationFt === -10 && gallery.elevationFt === 10);

ok("interior stairs derive a 10-ft rise from the hall and gallery", interiorStairs.riseFt === 10 && interiorStairs.from.elevationFt === hall.elevationFt && interiorStairs.to.elevationFt === gallery.elevationFt);
ok("interior stairs derive four gradual 2.5-ft segments", interiorStairs.segments === 4 && interiorStairs.path.map((point) => point.elevationFt).join(",") === "0,2.5,5,7.5,10");
ok("garden stairs retain a signed rise between −10 and zero", gardenStairs.riseFt === 10 && gardenStairs.path[0].elevationFt === -10 && gardenStairs.path[gardenStairs.path.length - 1].elevationFt === 0);
ok("the door derives no vertical rise between same-level surfaces", door.riseFt === 0 && door.segments === 1);
ok("connectors author only landing surfaces and derive rise/path height", scene.connectors.every((connector) => connector.authoredFacts.join("|") === "from.surfaceId|to.surfaceId" && connector.derivedFacts.includes("riseFt")));

let state = Core.createState(scene);
ok("the opening token uses a complete surface-owned position", Core.positionKey(state.token) === "5,8@surface-courtyard" && state.token.elevationFt === 0);
ok("only location-valid actions are enabled", Core.availableActions(state).filter((action) => action.available).map((action) => action.id).join("|") === "enter|lower");
const refused = Core.performAction(scene, state, "climb");
ok("an unavailable transition refuses with narration", !refused.ok && /unavailable/.test(refused.message));

const entering = Core.performAction(scene, state, "enter");
state = Core.advanceTransition(scene, entering.state, 1);
ok("entering moves onto the hall surface through the authored door", entering.ok && state.token.surfaceId === hall.id && state.token.elevationFt === 0);
ok("entering requests roof lift, near-wall cutaway, and interior camera", state.presentation.inside && state.presentation.roofOpacity < .1 && state.presentation.nearWallOpacity <= .1 && state.presentation.cameraPreset === "hall");
const climbing = Core.performAction(scene, state, "climb");
const halfway = Core.advanceTransition(scene, climbing.state, .5);
ok("a token occupies the gradual stair height during traversal", halfway.token.elevationFt === 5 && halfway.transition.connectorId === interiorStairs.id);
state = Core.advanceTransition(scene, climbing.state, 1);
ok("climbing lands on the gallery surface at +10 ft", state.token.surfaceId === gallery.id && state.token.elevationFt === 10 && state.presentation.cameraPreset === "gallery");
ok("same grid coordinates remain distinct on hall and gallery", Core.positionKey({ c: 7, r: 7, surfaceId: hall.id }) !== Core.positionKey({ c: 7, r: 7, surfaceId: gallery.id }));

const descending = Core.performAction(scene, state, "descend");
state = Core.advanceTransition(scene, descending.state, 1);
const exiting = Core.performAction(scene, state, "exit");
state = Core.advanceTransition(scene, exiting.state, 1);
ok("leaving restores the complete exterior shell", !state.presentation.inside && state.presentation.roofOpacity === 1 && state.presentation.nearWallOpacity === 1);
const lowering = Core.performAction(scene, state, "lower");
state = Core.advanceTransition(scene, lowering.state, 1);
ok("descending outside lands at logical −10 ft without clamping", state.token.surfaceId === lower.id && state.token.elevationFt === -10 && Core.toRenderElevation(scene, state.token.elevationFt) === 0);

ok("the UI exposes a touch-first walkthrough and reset", html.includes('id="actions"') && html.includes('id="nextStop"') && html.includes('id="resetProof"'));
ok("the relationship-first height stack and exact position receipt are visible", html.includes("Height by relationship") && html.includes("Current position") && html.includes("surface-courtyard"));
ok("the principle explicitly removes a separate stair-height control", html.includes("The stair has no height control") && /lower and upper landings/.test(html));
ok("the canvas renderer includes roof, wall cutaway, camera, interior, and signed-height paths", ["roofOpacity", "nearWallOpacity", "cameraPreset", "surface-gallery", "toRenderElevation"].every((term) => js.includes(term)));
ok("all local assets carry matching cache stamps", html.includes("building.css?v=eb2") && html.includes("building-core.js?v=eb2") && html.includes("building.js?v=eb2"));
ok("the isolated proof has no network, persistence, or production dependency", !/fetch\(|supabase|localStorage|sessionStorage|three/i.test(html + css + js));

console.log(`\n${passed}/${passed} passed\n`);
