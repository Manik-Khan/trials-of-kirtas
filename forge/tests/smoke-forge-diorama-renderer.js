#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Diorama = require("../forge-diorama-renderer.js");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
let passed = 0;
function ok(name, value) { assert.ok(value, name); passed++; console.log("✓ " + name); }
function eq(name, actual, expected) { assert.deepStrictEqual(actual, expected, name); passed++; console.log("✓ " + name); }
function throws(name, fn, pattern) { assert.throws(fn, pattern, name); passed++; console.log("✓ " + name); }

function fixture() {
  return {
    W: 3, H: 3,
    foot: Uint8Array.from([1, 1, 1, 1, 1, 0, 1, 1, 1]),
    type: Uint8Array.from([4, 0, 2, 1, 3, 0, 1, 1, 4]),
    height: Float32Array.from([0, 0, 1, 0, 2, 0, 0, 1, 0]),
    occ: Float32Array.from([10, 0, 0, 0, 0, 0, 0, 0, 15]),
    props: [{ kind: "column", x: 1, y: 1, h: 2 }, { kind: "tree", x: 0, y: 2, h: 0 }]
  };
}

ok("the scenery receipt has an explicit production schema", Diorama.SCHEMA === "forge-diorama-render/v1");
const source = fixture();
const before = JSON.stringify({ foot: Array.from(source.foot), type: Array.from(source.type), height: Array.from(source.height), occ: Array.from(source.occ), props: source.props });
const plan = Diorama.plan(source, { step: 1, stepFt: 5 });
eq("the known field separates walkable floor, water, and solid volumes", [plan.floors.length, plan.water.length, plan.volumes.length], [5, 1, 5]);
eq("floor elevations retain the Forge five-foot tiers", plan.floors.map((cell) => cell.y), [1, 0, 2, 0, 1]);
eq("rock volume tops include authored occluder height", plan.volumes.filter((cell) => cell.type === Diorama.TYPES.rock).map((cell) => cell.topY), [2, 3]);
eq("the known footprint derives ten perimeter wall edges", plan.walls.length, 10);
eq("near-facing walls become cutaways while far walls stay full", [plan.walls.filter((wall) => wall.cutaway).length, plan.walls.filter((wall) => !wall.cutaway).length], [6, 4]);
eq("prop identity and coordinates survive the scenery plan", plan.props, source.props);
ok("planning scenery never mutates the authoritative field", JSON.stringify({ foot: Array.from(source.foot), type: Array.from(source.type), height: Array.from(source.height), occ: Array.from(source.occ), props: source.props }) === before);
const repeat = Diorama.plan(fixture(), { step: 1, stepFt: 5 });
eq("the same field recreates the same scenery plan exactly", repeat, plan);
const modules = Diorama.buildWallModules(plan);
eq("each known wall expands into a deterministic modular-stone course", modules.length, 77);
ok("wall modules retain their source cell for discovery", modules.every((block) => Number.isInteger(block.c) && Number.isInteger(block.r)));
ok("biomes change materials without changing geometry", Diorama.paletteFor("tundra").grass !== Diorama.paletteFor("grass").grass && Diorama.plan(fixture(), { step: 1, stepFt: 5 }).walls.length === plan.walls.length);
throws("fractional dimensions are refused", () => Diorama.plan({ W: 2.5, H: 2, foot: [], type: [], height: [] }), /positive W and H/);
throws("malformed field arrays are refused", () => Diorama.plan({ W: 2, H: 2, foot: [1], type: [1, 1, 1, 1], height: [0, 0, 0, 0] }), /field\.foot/);
throws("the Three renderer narrates missing runtime dependencies", () => Diorama.render({ field: fixture() }), /THREE and a root group/);

ok("production loads the renderer with a fresh cache stamp", html.includes('<script src="forge-diorama-renderer.js?v=fdr1"></script>'));
ok("the visual switch is guarded by an explicit query flag", html.includes("STORYBOOK_PARAMS.get('renderer')==='diorama'"));
ok("the existing renderer remains the default branch", html.includes("if(DIORAMA_RENDERER_ON){renderDioramaField();return;}") && html.includes("DIORAMA_RECEIPT=null;"));
ok("the guarded branch preserves connectors, characters, discovery, and the storybook backdrop", ["renderVerticalConnectors();", "renderPlaced();", "buildStorybookBackdrop(span);", "refreshDiscovery(true)"].every((needle) => html.includes(needle)));
ok("the Workshop narrates the real renderer receipt", html.includes('id="forgeDioramaSummary"') && html.includes("DIORAMA_RECEIPT.wallModules"));
ok("a read-only field diagnostic exposes flag, readiness, and receipt", html.includes("window.__forgeDioramaState=function()") && html.includes("ready:!!DIORAMA_RECEIPT"));

console.log("\n" + passed + " Forge diorama-renderer checks green");
