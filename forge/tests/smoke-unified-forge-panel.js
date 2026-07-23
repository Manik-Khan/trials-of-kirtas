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
has('forge-deployment.js?v=fd3',"unified Workshop loads the deployment authority");
has('Purpose-built Temple terrain is active in Workshop preview.',"Temple preview status is narrated inside the unified Forge panel");
has('function templeDeploymentPending',"one predicate owns the Temple deployment gate");
has('Place every active encounter-group flag before opening or saving this table.',"shared table doors narrate their placement dependency");
has('id="deploymentPanel"',"approved deployment cards live in the unified Workshop");
has('data-deploy-membership=',"every assigned and unassigned combatant exposes an explicit group menu");
has('ForgeDeployment.assignUnit',"group changes use the deployment membership authority");
has('data-deploy-remove=',"groups can be removed without deleting their combatants");
has('class="deployDelete"',"group deletion is an explicit header control rather than a buried text link");
has('type="hidden" id="foes" value="0"',"legacy generator parameter remains neutral without a base-enemy UI");
has("unit: 'foe-picked-' + slug + '-' + n","picked foes have stable IDs");
has('Choose any creature for this encounter.',"Bestiary is the encounter roster authority");
has('forge-party-selection.js?v=fps1',"Forge loads the active player-folder selection authority");
has("var pcs = forgePartyRows();\n  var foes = [];","roster construction has no all-character fallback");
const rosterStart=html.indexOf('function buildRoster(){'),rosterEnd=html.indexOf('/* Approved Encounter Read:',rosterStart);
const rosterFactory=new Function('CHAR','FOE_PICKED','foeSlug','forgePartyRows','document',html.slice(rosterStart,rosterEnd)+'\nreturn buildRoster;');
const roster=rosterFactory({caim:{}},[{name:'Archer',count:1,statblock:{name:'Archer',hp:{average:16}}}],name=>name.toLowerCase(),()=>[{unit:'caim',kind:'pc',sheet_ref:'caim'}],{getElementById:()=>({value:'2'})})();
const foes=roster.filter(row=>row.kind==='foe');
ok("the real roster builder contains only explicitly picked foes",foes.length===1&&foes[0].unit==='foe-picked-archer-1');
has('envelope.deployment=deployment',"saved map envelope carries the exact deployment record");
has('savedRoster=rosterWithEncounterRegions(rosterWithDeployment(buildRoster(),savedMap.deployment),savedMap.encounterRegions)',"staged roster receives exact authored positions and activation rules");
has('savedDeployment&&[1,2,3].indexOf(Number(savedDeployment.version))>=0',"shared start consumes current and historical deployment records");
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
