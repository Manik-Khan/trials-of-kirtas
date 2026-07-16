#!/usr/bin/env node
"use strict";
const F = require("../forge-generator-foundation.js");
let pass = 0;
function ok(condition, label) {
  if (!condition) throw new Error("FAIL: " + label);
  pass++;
  console.log("ok", pass, "-", label);
}
function throws(fn, pattern, label) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  ok(err && pattern.test(err.message), label);
}

const a = F.stageSeeds(12345);
const b = F.stageSeeds(12345);
ok(JSON.stringify(a) === JSON.stringify(b), "same root seed gives identical stage seeds");
ok(new Set(Object.values(a)).size === F.STAGES.length, "each stage gets a distinct seed");
ok(F.stageSeeds(12346).layout !== a.layout, "changing root seed changes layout seed");
const override = F.stageSeeds(12345, { decor: 77 });
ok(override.decor === 77, "one stage can be overridden explicitly");
ok(override.layout === a.layout && override.height === a.height && override.semantics === a.semantics && override.foes === a.foes,
  "overriding decor cannot perturb other stages");
ok(F.deriveSeed(9, "layout") === F.deriveSeed(9, "layout"), "deriveSeed is deterministic");
ok(F.assertArchetype() === "legacy-dungeon", "legacy archetype is the compatibility default");
ok(F.assertArchetype("canyon") === "canyon", "ratified archetype is accepted");
throws(() => F.assertArchetype("spiral-potato"), /unknown archetype/, "unknown archetype fails loudly");
ok(F.assertThemeKey("grass", ["grass", "temple"]) === "grass", "known theme passes validation");
throws(() => F.assertThemeKey("frost", ["grass", "tundra"]), /unknown themeKey.*frost/, "unknown theme fails with its name");

const dungeon = {
  seed: 44, entrance: 0, boss: 2, maxDepth: 2,
  rooms: [
    { id: 0, cx: 2, cy: 3, w: 5, h: 5, depth: 0, type: "entrance", degree: 1 },
    { id: 1, cx: 8, cy: 3, w: 4, h: 4, depth: 1, type: "combat", degree: 2 },
    { id: 2, cx: 13, cy: 4, w: 6, h: 6, depth: 2, type: "boss", degree: 1 }
  ],
  edges: [
    { a: 0, b: 1, isLoop: false, isCritical: true },
    { a: 1, b: 2, isLoop: false, isCritical: true }
  ]
};
const graph = F.graphMetadata(dungeon);
ok(graph.nodes.length === 3 && graph.edges.length === 2, "graph metadata preserves nodes and edges");
ok(graph.summary.criticalLength === 2, "critical edge count is exposed");
ok(graph.overlays.criticalRooms.join(",") === "0,1,2", "critical room overlay is ready to draw");
ok(graph.overlays.semantics[2].type === "boss", "room semantics are exposed");
ok(JSON.parse(JSON.stringify(graph)).summary.rooms === 3, "graph metadata is plain JSON");

const map = {
  cols: 2, rows: 2,
  h: new Float32Array([0, 5, 10, 15]),
  wall: new Uint8Array([0, 1, 0, 0]),
  occ: new Float32Array([0, 7, 4.5, 0]),
  spawns: [{ c: 0, r: 0, side: "pc", unit: "caim" }, { x: 1, y: 1, side: "foe", unit: "goblin-1" }],
  props: [{ kind: "rock", x: 0, y: 1, occFt: 4.5 }],
  meta: { name: "Test", mapSnapshot: { recursive: true } }
};
const snap = F.snapshotMap(map);
ok(Array.isArray(snap.h) && snap.h[2] === 10, "typed height array becomes ordinary JSON array");
ok(snap.wall[1] === true && snap.wall[0] === false, "wall values normalize to booleans");
ok(snap.spawns[1].c === 1 && snap.spawns[1].r === 1, "x/y spawn aliases normalize to c/r");
ok(snap.spawns[0].unit === "caim" && snap.spawns[1].unit === "goblin-1", "spawn identity survives exact snapshot normalization");
ok(!Object.prototype.hasOwnProperty.call(snap.meta, "mapSnapshot"), "recursive snapshot metadata is stripped");
const fp1 = F.fingerprintSnapshot(snap);
const fp2 = F.fingerprintSnapshot(F.snapshotMap(map));
ok(fp1 === fp2 && /^[0-9a-f]{8}$/.test(fp1), "snapshot fingerprint is stable and compact");
map.h[0] = 99;
ok(snap.h[0] === 0, "snapshot is detached from the source map");

const envelope = F.encounterEnvelope(map, {
  seed: 101, theme: "temple", archetype: "temple-terraces",
  sliders: { roomCount: 9, foes: 4 }
}, dungeon);
ok(envelope.seed === 101 && envelope.theme === "temple" && envelope.sliders.roomCount === 9,
  "encounter envelope preserves the old top-level session shape");
ok(envelope.generatorVersion === F.GENERATOR_VERSION, "encounter envelope carries generatorVersion");
ok(envelope.archetype === "temple-terraces", "encounter envelope carries archetype");
ok(Object.keys(envelope.stageSeeds).length === 5, "encounter envelope carries all independent sub-seeds");
ok(envelope.mapSnapshot.cols === 2 && envelope.mapFingerprint.length === 8, "encounter envelope stores exact snapshot and fingerprint");
ok(envelope.graph.summary.rooms === 3, "encounter envelope stores graph metadata");

const attached = F.attachMeta({ cols: 1, rows: 1, h: [0], wall: [false], occ: [0] }, { seed: 5 }, graph);
ok(attached.meta.generatorVersion === F.GENERATOR_VERSION, "attachMeta versions a generated map");
ok(attached.meta.archetype === "legacy-dungeon", "attachMeta remains backward-compatible by default");

/* ── clonePlain regressions: shared refs, positions, cycles, scoped strip ── */
const sharedLook = { style: "mossy", tint: 3 };
const dagMap = {
  cols: 2, rows: 1, h: [0, 0], wall: [false, false], occ: [0, 0],
  props: [{ kind: "rock", look: sharedLook }, { kind: "rock", look: sharedLook }],
  meta: {}
};
const dagSnap = F.snapshotMap(dagMap);
ok(dagSnap.props[1] && dagSnap.props[1].look && dagSnap.props[1].look.style === "mossy",
  "a shared (non-cyclic) reference survives on every prop that uses it");
ok(dagSnap.props[0].look !== dagSnap.props[1].look && dagSnap.props[0].look !== sharedLook,
  "shared references are cloned, not aliased, in the snapshot");

const holey = F._internals.clonePlain([1, undefined, 3, function () {}]);
ok(holey.length === 4 && holey[0] === 1 && holey[1] === null && holey[2] === 3 && holey[3] === null,
  "array positions survive: undefined and functions become null, never compact");

const cyc = { name: "loop" }; cyc.self = cyc;
const cycOut = F._internals.clonePlain(cyc);
ok(cycOut.name === "loop" && !("self" in cycOut), "a true cycle degrades instead of recursing forever");

const scoped = F.snapshotMap({
  cols: 1, rows: 1, h: [0], wall: [false], occ: [0],
  props: [{ kind: "sign", mapSnapshot: "painted label" }],
  meta: { note: "keep", mapSnapshot: { recursive: true }, deep: { mapSnapshot: { alsoRecursive: true } } }
});
ok(scoped.props[0].mapSnapshot === "painted label",
  "a prop key merely named mapSnapshot is not eaten — the strip is scoped to meta");
ok(!("mapSnapshot" in scoped.meta) && !("mapSnapshot" in scoped.meta.deep),
  "meta strips nested mapSnapshot keys at any depth to prevent recursive envelopes");

/* ── pin the live contract: combatMapFromF() returns TG.makeMap's shape ──
   {cols, rows, h:Array, wall:Array} + occ, verified against the repo's
   tactics-geometry.js makeMap and index.html combatMapFromF. ── */
const liveShape = { cols: 2, rows: 2,
  h: new Array(4).fill(0), wall: new Array(4).fill(false), occ: new Array(4).fill(0),
  spawns: [], props: [], meta: { source: "topography-test-mock", name: null } };
const liveSnap = F.snapshotMap(liveShape);
ok(liveSnap.cols === 2 && liveSnap.rows === 2 && liveSnap.h.length === 4 && liveSnap.wall.length === 4,
  "the exact combatMapFromF map shape snapshots without a normalizer");

console.log("\n", pass, "generator-foundation checks green");
