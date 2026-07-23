#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
let pass = 0, fail = 0;
function ok(name, value) { value ? pass++ : fail++; console.log((value ? "✓ " : "✗ ") + name); }
function has(needle, name) { ok(name, html.includes(needle)); }
function notHas(needle, name) { ok(name, !html.includes(needle)); }

has('id="forgeWorkshopSummary"', "Workshop keeps one persistent encounter and map summary");
has('data-workshop-nav="encounter"', "Encounter is a first-class Workshop step");
has('data-workshop-nav="battlefield"', "Battlefield is a first-class Workshop step");
has('data-workshop-nav="deployment"', "Deployment is a first-class Workshop step");
has('data-workshop-nav="advanced"', "Advanced tools are a first-class Workshop step");
has('data-workshop-step="encounter"', "Encounter owns an independent content pane");
has('Party, enemies, and Encounter Read are available before a battlefield is generated.', "Encounter availability is narrated independently of map generation");
has('id="biomeSelect"', "Battlefield uses one compact biome selector");
has('id="forgeBtn">Generate battlefield</button>', "Map replacement requires an explicit generation action");
has('function markForgeBattlefieldPending(){WORKSHOP_MAP_DIRTY=true;', "Battlefield selections have an explicit pending state");
has("else markForgeBattlefieldPending();", "Generator sliders mark changes pending");
notHas("if(mode==='tiers')rebuild();if(id==='foes'", "Generator sliders no longer silently rebuild the map");
has("markForgeBattlefieldPending();setForgeWorkshopStep('battlefield');", "Temple shortcut selects the recipe without silently generating it");
has('id="forgeDeploymentGate"', "Unsupported deployment remains visible with an explanation");
has('if(!templeField()){if(gate)gate.hidden=false;', "Deployment gating narrates unsupported maps instead of removing the step");
has('<summary>Camera</summary>', "Camera controls are collapsed under Advanced");
has('<summary>Rendering</summary>', "Rendering controls are collapsed under Advanced");
has('<summary>Vertical geometry</summary>', "Vertical diagnostics are collapsed under Advanced");
has('<summary>Architecture preview</summary>', "Architecture tools are collapsed under Advanced");
has("rebuild();setForgeWorkshopStep('encounter');", "Workshop entry returns to encounter-first authoring");

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
