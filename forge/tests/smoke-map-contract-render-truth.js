#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const spec=fs.readFileSync(path.join(root,"FORGE_MAP_CONTRACT_2.md"),"utf8");
let pass=0;
function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function has(t,n,l){ok(t.includes(n),l);}
function before(t,a,b,l){const ai=t.indexOf(a),bi=t.indexOf(b);ok(ai>=0&&bi>=0&&ai<bi,l);}

has(spec,"The gameplay grid remains five feet","contract preserves the 5-ft gameplay grid");
has(spec,"Two-and-a-half-foot increments are allowed","contract permits 2.5-ft authored vertical geometry");
has(spec,"Edges are first-class","contract separates edge walls from full cells");
has(spec,"vertical scale is fixed at 100%","contract forbids deceptive tactical exaggeration");
has(spec,"image-to-dungeon importer","contract explicitly supports the future importer");
has(spec,"edgeBlockers: EdgeBlocker[]","contract defines edge blockers");
has(spec,"connectors: Connector[]","contract defines first-class connectors");

has(html,'<label>Vertical inspection scale <span class="val" id="heightVal">100%</span></label>',"UI names the control as inspection, not rules geometry");
has(html,'id="height" min="50" max="180" value="100"',"inspection scale defaults to truthful 100 percent");
ok(!html.includes("Height exaggeration <span"),"old ambiguous height-exaggeration label is absent");
has(html,"const TACTICAL_STEP=1;","renderer freezes one tactical world-unit step");
has(html,"let STEP=TACTICAL_STEP","initial render starts truthful");
has(html,"function setAuthoringVerticalScale(percent)","authoring-only scale has a named door");
has(html,"function enforceTacticalVerticalScale(reason)","tactical scale has a named enforcement door");
has(html,"return !!SESSION_ID || !!(typeof CB!==\"undefined\"&&CB&&CB.active)","session and active combat lock the inspection control");
has(html,"window.__forgeVerticalScale={truth:TACTICAL_STEP", "vertical-scale contract exposes a diagnostic seam");

before(html,"function startCombatNow(){","enforceTacticalVerticalScale('local combat')","local combat function is present before its lock call");
const localStart=html.indexOf("function startCombatNow(){"), localLock=html.indexOf("enforceTacticalVerticalScale('local combat')",localStart), localClear=html.indexOf("tokenGroup.clear()",localStart);
ok(localStart>=0&&localLock>localStart&&localLock<localClear,"local combat locks scale before tokens are staged");
const sharedStart=html.indexOf("function spawnFromState(state, row){"), sharedLock=html.indexOf("enforceTacticalVerticalScale('shared combat')",sharedStart), sharedClear=html.indexOf("tokenGroup.clear()",sharedStart);
ok(sharedStart>=0&&sharedLock>sharedStart&&sharedLock<sharedClear,"shared combat locks scale before tokens are staged");
has(html,"if (SESSION_ID) {\n  enforceTacticalVerticalScale('session');","session boot locks the view before loading the fight");
has(html,"const WORLD_PER_FT = () => STEP / 5;","props use the same feet-to-world scale");
has(html,"function eyeAt(c,r){ return new THREE.Vector3(wxc(c), tierY(c,r)+STEP, wzc(r)); }","sight eyes use the same vertical scale");
has(html,"const top=F.height[i]*STEP + (OCC[i]/STEP_FT)*STEP;","terrain and occluders share the same scale");

console.log("\n"+pass+" Map Contract 2.0 / render-truth checks green");
