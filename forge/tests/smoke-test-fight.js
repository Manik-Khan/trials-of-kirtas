#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const TestFight=require("../forge-test-fight.js");
const Replay=require("../forge-replay.js");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
let pass=0,fail=0;
function ok(label,value){if(value){pass++;console.log("ok",pass,"-",label);}else{fail++;console.log("FAIL -",label);}}

const campaign=[{unit:"caim",kind:"pc",hp:24,maxHp:37,resources:{ki:0}},{unit:"hyena",kind:"foe",hp:45,maxHp:45}];
const facts={caim:{currentHp:24,maxHp:37,currentResources:{ki:0,rebuke:1},maxResources:{ki:4,rebuke:1},
  conditions:["poisoned"],startingEffects:[TestFight.concentrationEffect("caim",{name:"Bless"})]}};

ok("campaign has no TEST flag",!TestFight.isTestFight({mode:"campaign"}));
ok("campaign map remains unflagged",!Object.prototype.hasOwnProperty.call(TestFight.attachToMap({seed:7},null),"testFight"));
const map=TestFight.attachToMap({seed:7},{mode:"test",health:"full",resources:"empty",effects:"clear"});
ok("TEST configuration persists in the map JSON",map.testFight&&map.testFight.mode==="test");
ok("session-shaped TEST records are recognized",TestFight.isTestFight({row:{map:map}}));

let roster=TestFight.applyRoster(campaign,map.testFight,facts);
ok("full-health preset fills only the PC",roster[0].hp===37&&roster[1].hp===45);
ok("empty-resource preset zeros every tracked pool",roster[0].resources.ki===0&&roster[0].resources.rebuke===0);
ok("clear-effects preset removes inherited state",roster[0].conditions.length===0&&roster[0].startingEffects.length===0);

roster=TestFight.applyRoster(campaign,{mode:"test",health:"quarter",resources:"full",effects:"current"},facts);
ok("quarter-health preset rounds up",roster[0].hp===10);
ok("full resources use pool maxima",roster[0].resources.ki===4&&roster[0].resources.rebuke===1);
ok("current effects copy conditions and concentration",roster[0].conditions[0]==="poisoned"&&roster[0].startingEffects.length===1);
const state=Replay.initialState([{unit:"caim",kind:"pc",pos:{c:1,r:1},hp:10,maxHp:37,conditions:roster[0].conditions}]);
ok("replay seeds inherited TEST conditions",state.units.caim.conditions[0]==="poisoned");
ok("inherited concentration becomes a synthetic effect fact",TestFight.startingEffectRows(roster).length===1);

roster=TestFight.applyRoster(campaign,{mode:"test",health:"custom",resources:"custom",effects:"clear",custom:{caim:{hp:12,resources:{ki:2,rebuke:0}}}},facts);
ok("custom health and resources are clamped and applied",roster[0].hp===12&&roster[0].resources.ki===2&&roster[0].resources.rebuke===0);
ok("the approved production controls are present",html.includes('data-tf-mode="test"')&&html.includes('data-tf-group="health"')&&html.includes('id="tfRoster"'));
ok("TEST sessions are refused by every sheet-mirror door",
  html.includes("sess.row.status!=='active' || isTestFightSession(sess)")&&
  html.includes("if(isTestFightSession(sess)){__mirrorQueue.delete(key);return true;}")&&
  html.includes("if(isTestFightSession(sess)){__mirrorQueue.clear();showMirrorChip(false);return;}"));
ok("TEST sessions do not start the sheet-write timer",html.includes("if(!isTestFightSession(window.__forgeSession))__mirrorTimer = setInterval"));
ok("Campaign creation remains the no-config call path",html.includes("openTable(user.id,testFightConfig())")&&html.includes("attachToMap(__forgeSessionMap(),config)"));

console.log("\n"+pass+" Test Fight checks green"+(fail?" · "+fail+" failed":""));
process.exitCode=fail?1:0;
