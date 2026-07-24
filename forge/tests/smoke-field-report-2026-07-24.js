#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
let pass=0,fail=0;
function ok(label,value){if(value){pass++;console.log("ok",pass,"-",label);}else{fail++;console.log("FAIL -",label);}}

ok("current sheet keys pass through the presentation-key resolver",
  html.includes("function presentationKeyFor(key,name)")&&html.includes("ROSTER_SPRITE[displayKey]"));
ok("initiative strip distinguishes current HP from maximum HP",
  html.includes('Math.max(0,o.hp)+" / "+Math.max(0,o.hpMax)'));
ok("selecting a targeted spell keeps and resolves an already-highlighted target",
  html.includes("preselected=unitByKey(CB.tgtKey)||unitByKey(CB.selKey)")&&
  html.includes('a.kind==="save"||a.kind==="heal"||a.kind==="buff"||a.kind==="buffAlly"'));
ok("opportunity prompts carry and stage the safe movement prefix",
  html.includes("path_prefix:path.slice(0,i)")&&html.includes("function stageOpportunityPrompt")&&
  html.includes("prefix=prefix.slice(stagedAt+1)"));
ok("automatic enemy reasoning is authored as staff-only system evidence",
  html.includes('function staffTactic(html)')&&html.includes('visibility:"staff"'));
ok("cover rulings cannot open while the overseer is presenting Player View",
  html.includes("sess.me.overseer&&!discoveryPlayerView()"));
ok("Silvery Barbs evidence names attacker, target, and attack mode",
  html.includes("attacked \"+targetName+\" with \"+mode")&&html.includes("reaction_context"));
ok("the editable picked roster is visible inside Encounter before suggestions",
  html.indexOf('id="fpPicked"')>html.indexOf('id="encounterReadPanel"')&&
  html.indexOf('id="fpPicked"')<html.indexOf('id="encounterSuggestionsToggle"'));
ok("approved War Caster and Repelling Blast choices are wired to production",
  html.includes("warCasterOpportunityActions")&&html.includes("chooseRepellingBlast")&&
  html.includes("forge-reaction-choices.js?v=frc1"));
ok("pillar cover footprint matches the rendered stone base",
  html.includes("column:{kind:'circle',radius:.40},pillar:{kind:'circle',radius:.40}"));

console.log("\n"+pass+" field-report checks green"+(fail?" · "+fail+" failed":""));
process.exitCode=fail?1:0;
