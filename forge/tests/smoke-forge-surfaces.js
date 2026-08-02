#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Surfaces = require("../forge-surfaces.js");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let passed = 0;
function ok(name, value) { assert.ok(value, name); passed++; console.log("✓ " + name); }
function eq(name, actual, expected) { assert.deepStrictEqual(actual, expected, name); passed++; console.log("✓ " + name); }
function throws(name, fn, pattern) { assert.throws(fn, pattern, name); passed++; console.log("✓ " + name); }

function flatMap() {
  return {
    cols: 3, rows: 2,
    h: [0, 5, 10, 15, 20, 25],
    wall: [false, false, true, false, false, false],
    occ: [0, 0, 0, 0, 0, 0],
    connectors: [], meta: { name: "Flat compatibility map" }
  };
}
function bridgeMap(options = {}) {
  const cols = 5, rows = 3, count = cols * rows;
  const map = { cols, rows, h: new Array(count).fill(0), wall: new Array(count).fill(false), occ: new Array(count).fill(0), connectors: [], meta: {} };
  if (options.gap !== false) [1, 2, 3].forEach((c) => { map.wall[1 * cols + c] = true; });
  map.connectors.push({
    id: "market-crossing", kind: "bridge", state: options.state || "open",
    supportsUnderpass: !!options.supportsUnderpass, deckThicknessFt: 1, clearanceFt: 19,
    path: [0, 1, 2, 3, 4].map((c) => ({ c, r: 1, elevationFt: c === 0 || c === 4 ? 0 : 20 }))
  });
  return map;
}

const flat = Surfaces.compileMap(flatMap());
ok("the compatibility contract is explicitly versioned", flat.schema === "forge-walk-surfaces/v1" && flat.version === 1);
ok("surface-aware positions have their own versioned schema", flat.positionSchema === "forge-surface-position/v1");
ok("an existing single-floor map synthesizes exactly one stable ground surface", flat.surfaces.length === 1 && flat.surfaces[0].id === "surface-ground");
ok("legacy walls remain absent from the walk surface", !Surfaces.surfacePosition(flat, "surface-ground", 2, 0));
ok("per-cell legacy elevation survives on the ground surface", Surfaces.surfacePosition(flat, "surface-ground", 1, 1).elevationFt === 20);
eq("a legacy c/r position resolves to the compatible ground surface", Surfaces.normalizePosition(flat, { c: 1, r: 0 }), { schema: "forge-surface-position/v1", c: 1, r: 0, surfaceId: "surface-ground", elevationFt: 5 });
ok("an explicit surface position resolves without changing identity", Surfaces.normalizePosition(flat, { c: 1, r: 0, surfaceId: "surface-ground", elevationFt: 5 }).surfaceId === "surface-ground");
ok("a stale explicit elevation is rejected instead of silently moved", Surfaces.normalizePosition(flat, { c: 1, r: 0, surfaceId: "surface-ground", elevationFt: 10 }) === null);
ok("an unknown explicit surface is rejected", Surfaces.normalizePosition(flat, { c: 1, r: 0, surfaceId: "surface-missing" }) === null);
ok("surface-aware occupancy includes the surface identity", Surfaces.occupiedKey({ c: 1, r: 0, surfaceId: "surface-ground" }) === "1,0@surface-ground");
throws("surface-less occupancy is refused", () => Surfaces.occupiedKey({ c: 1, r: 0 }), /surface-aware/);
ok("the compiled flat contract validates", Surfaces.validate(flat).ok);
ok("compiling the same map recreates the exact fingerprint", Surfaces.compileMap(flatMap()).fingerprint === flat.fingerprint);

const bridge = Surfaces.compileMap(bridgeMap());
const bridgeSurface = bridge.surfaces.find((surface) => surface.kind === "bridge-deck");
ok("a structural bridge receives a stable deck surface", !!bridgeSurface && bridge.receipt.bridgeDecks === 1);
ok("bridge surface identity is deterministic", Surfaces.compileMap(bridgeMap()).surfaces[1].id === bridgeSurface.id);
ok("a gap crossing retains ground only at its land endpoints", bridge.receipt.groundCells === 12 && bridgeSurface.cells.length === 3);
ok("flat bridgeheads remain ground positions instead of duplicate stacked spaces", Surfaces.normalizePosition(bridge, { c: 0, r: 1 }).surfaceId === "surface-ground" && Surfaces.surfacesAt(bridge, 0, 1).length === 1);
ok("legacy positions on the open span prefer the bridge deck", Surfaces.normalizePosition(bridge, { c: 2, r: 1 }).surfaceId === bridgeSurface.id);
ok("the normalized connector names every ground/deck transition", bridge.connectors[0].path.map((point) => point.surfaceId).join("|") === "surface-ground|" + bridgeSurface.id + "|" + bridgeSurface.id + "|" + bridgeSurface.id + "|surface-ground");
ok("generated bridges do not invent underpass occupancy", bridge.receipt.underpassColumns === 0 && bridge.receipt.stackedColumns === 0);
ok("the bridge retains physical clearance and deck thickness", bridgeSurface.clearanceFt === 19 && bridgeSurface.deckThicknessFt === 1);

const guarded = Surfaces.compileMap(bridgeMap({ gap: false, supportsUnderpass: false }));
ok("an unapproved elevated crossing suppresses legacy ground beneath its open span", !Surfaces.surfacePosition(guarded, "surface-ground", 2, 1) && guarded.receipt.stackedColumns === 0);
ok("that unapproved crossing still resolves legacy occupancy to its deck", Surfaces.normalizePosition(guarded, { c: 2, r: 1 }).surfaceId === guarded.surfaces[1].id);

const underpass = Surfaces.compileMap(bridgeMap({ gap: false, supportsUnderpass: true }));
const underDeck = underpass.surfaces.find((surface) => surface.kind === "bridge-deck");
ok("an explicitly approved underpass keeps ground and deck in the same columns", underpass.receipt.underpassColumns === 3 && underpass.receipt.stackedColumns === 3);
eq("the same c/r now exposes two independently walkable positions", Surfaces.surfacesAt(underpass, 2, 1).map((position) => position.surfaceId), ["surface-ground", underDeck.id]);
ok("an explicit ground position stays below the bridge", Surfaces.normalizePosition(underpass, { c: 2, r: 1, surfaceId: "surface-ground", elevationFt: 0 }).surfaceId === "surface-ground");
ok("an explicit deck position stays above the bridge", Surfaces.normalizePosition(underpass, { c: 2, r: 1, surfaceId: underDeck.id, elevationFt: 20 }).surfaceId === underDeck.id);
ok("legacy c/r still prefers the deck so old tokens do not fall through", Surfaces.normalizePosition(underpass, { c: 2, r: 1 }).surfaceId === underDeck.id);
ok("above and below occupancy keys differ at identical coordinates", Surfaces.occupiedKey({ c: 2, r: 1, surfaceId: "surface-ground" }) !== Surfaces.occupiedKey({ c: 2, r: 1, surfaceId: underDeck.id }));
ok("the connector receipt names the authorized underpass surface", underpass.connectors[0].underpassSurfaceId === "surface-ground" && underDeck.underpassSurfaceId === "surface-ground");

const closed = Surfaces.compileMap(bridgeMap({ gap: false, supportsUnderpass: true, state: "closed" }));
ok("closing a bridge preserves its stable surface identity", closed.surfaces[1].id === underDeck.id);
ok("a closed bridge deck is retained but is not walkable", closed.surfaces[1].walkable === false && !Surfaces.surfacePosition(closed, closed.surfaces[1].id, 2, 1));
ok("legacy occupancy falls back to ground when that deck closes", Surfaces.normalizePosition(closed, { c: 2, r: 1 }).surfaceId === "surface-ground");
ok("a closed bridge no longer reports a live underpass stack", closed.receipt.underpassColumns === 0 && closed.receipt.stackedColumns === 0);

const attachedMap = flatMap();
const attached = Surfaces.attach(attachedMap);
ok("attach exposes the compiled runtime contract without changing legacy arrays", attachedMap.surfaceContract === attached && attachedMap.h[1] === 5 && attachedMap.wall[2] === true);
ok("attach leaves a compact schema/fingerprint receipt in map metadata", attachedMap.meta.surfaceContract.schema === Surfaces.SCHEMA && attachedMap.meta.surfaceContract.fingerprint === attached.fingerprint);

const duplicate = JSON.parse(JSON.stringify(flat));
duplicate.surfaces[0].cells.push({ ...duplicate.surfaces[0].cells[0] });
ok("validation catches duplicate cells on one surface", !Surfaces.validate(duplicate).ok);
const badReference = JSON.parse(JSON.stringify(bridge));
badReference.connectors[0].deckSurfaceId = "surface-missing";
ok("validation catches connector references to missing surfaces", !Surfaces.validate(badReference).ok);
throws("fractional map dimensions are refused", () => Surfaces.compileMap({ cols: 2.5, rows: 2, h: [], wall: [] }), /positive integer/);
throws("malformed height arrays are refused", () => Surfaces.compileMap({ cols: 2, rows: 2, h: [0], wall: [false, false, false, false] }), /h cell array length/);
throws("malformed wall arrays are refused", () => Surfaces.compileMap({ cols: 2, rows: 2, h: [0, 0, 0, 0], wall: [false] }), /wall cell array length/);

ok("production loads the new authority with a fresh cache stamp", html.includes('<script src="forge-surfaces.js?v=fs1"></script>'));
ok("production activation is guarded by the explicit surfaces query flag", html.includes("STORYBOOK_PARAMS.get('surfaces')==='1'"));
ok("the default map path attaches no contract unless the flag is active", html.includes("if(typeof SURFACE_CONTRACT_ON!=='undefined'&&SURFACE_CONTRACT_ON)SURFACE_API.attach(map)"));
ok("the Workshop narrates the flagged surface receipt", html.includes('id="forgeSurfaceSummary"') && html.includes("receipt.underpassColumns"));
ok("a read-only field diagnostic exposes flag, readiness, and receipt", html.includes("window.__forgeSurfaceState=function()") && html.includes("receipt:JSON.parse(JSON.stringify(contract.receipt))"));

console.log("\n" + passed + " Forge surface-contract checks green");
