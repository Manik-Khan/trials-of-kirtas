#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const html=fs.readFileSync(path.resolve(__dirname,"..","index.html"),"utf8");
let pass=0,fail=0;
function ok(name,value){value?pass++:fail++;console.log((value?"✓ ":"✗ ")+name);}
function has(needle,name){ok(name,html.includes(needle));}
function notHas(needle,name){ok(name,!html.includes(needle));}

has('id="forgeShell"',"one top-left Forge shell exists");
has('function setForgePanelOpen(open)',"one function owns expanded state");
has('window.setForgePanelOpen=setForgePanelOpen',"the panel-state owner crosses the module boundary");
has('window.setForgePanelOpen(true);',"Workshop entry expands the shell");
has('window.setForgePanelOpen(false);',"combat or party transitions collapse the shell");
has('id="forgeTableSettings"',"combat settings live inside the unified panel");
has('setActiveChip("tiers");paintBiomeControl(BIOME)',"bridge search leaves its fallback biome visibly selected");
has('forge-temple-terraces.js?v=tt1',"unified Workshop loads the intentional Temple generator");
has('forge-deployment.js?v=fd1',"unified Workshop loads the deployment authority");
has('Purpose-built Temple terrain is active in Workshop preview.',"Temple preview status is narrated inside the unified Forge panel");
has('function templeDeploymentPending',"one predicate owns the Temple deployment gate");
has('Place deployment groups before opening or saving this Temple battlefield.',"shared Temple doors narrate their deployment dependency");
has('id="deploymentPanel"',"approved deployment cards live in the unified Workshop");
has('envelope.deployment=deployment',"saved map envelope carries the exact deployment record");
has('savedRoster=rosterWithDeployment(buildRoster(),savedMap.deployment)',"staged roster receives the exact authored positions");
has('savedDeployment&&savedDeployment.version===1',"shared start consumes versioned deployment records");
has('Historical rows keep the established one-time compatibility placement.',"legacy shared rows retain their placement fallback");
notHas('id="sceneModeMenu"',"the competing black flyout is removed");
notHas('id="sceneForgeControls"',"the Forge-controls indirection is removed");
notHas('forge-peek',"the second-panel reveal state is retired");

const shellStart=html.indexOf('id="forgeShell"');
const shellEnd=html.indexOf('</div><!-- /forgeShell -->',shellStart);
const shell=html.slice(shellStart,shellEnd);
ok("header, seed, and settings share one shell",shell.includes('id="sceneModeToggle"')&&shell.includes('id="seedGroup"')&&shell.includes('id="forgePanel"'));
ok("Workshop return door shares the shell",shell.includes('id="psReturn"'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
