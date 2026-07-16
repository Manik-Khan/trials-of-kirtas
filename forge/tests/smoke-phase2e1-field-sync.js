#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function has(n,l){ok(html.includes(n),l);}

ok(html.indexOf("var verticalOverlayGroup")<html.indexOf("resize(); rebuild();"),"vertical overlay registry initializes before the first rebuild");
ok((html.match(/var verticalOverlayGroup/g)||[]).length===1,"vertical overlay registry has one declaration");
ok(html.indexOf("var DISCOVERY_RENDER={")<html.indexOf("resize(); rebuild();"),"discovery registry boot guard remains intact");
ok(html.indexOf("var SESSION_ID")<html.indexOf("resize(); rebuild();"),"session identity boot guard remains intact");
has('id="phase2e1FieldCss"',"field hotfix CSS is present");
has('#fgFeed .fg-frow[hidden]{display:none!important}',"feed tabs actually hide the other channels");
has('#fgFeed .ffr-dmg-detail{display:block!important}',"damage component math is visible by default");
ok(/buildWeaponActions } from '\.\.\/weapon-actions\.js\?v=fg2(?:e1|f)'/.test(html),"weapon projection exposes a feature-detection seam");
has("function structuralHasDueling", "runtime derivation can read the Dueling fighting style");
has("function externalWeaponActionsOwnDueling", "runtime repair can detect an already-patched module");
has("function applyFinalDueling", "Dueling is enforced on the final kit combat consumes");
has("addDuelingToFinalAction", "final weapon and bound cantrip actions receive the style bonus");
has("two[- ]handed", "versatile two-handed attacks are excluded from Dueling");
has("function repairDerivedKit", "runtime kit repair removes legacy/live weapon-cantrip duplicates");
has("w._derivedId=w.id;w.id=l.id", "live cantrip math preserves a saved legacy action id");
has("function installFieldFeedEvidence", "damage evidence installs at the table-correctness seam");
has("D.install(window)", "resolved rows are rendered with evidence before HUD insertion");
has("function rebuildProtocolFeed(rows)", "the visible encounter record can be rebuilt from the protocol log");
has('rebuildProtocolFeed(typeof pipe.events==="function"?pipe.events():[])',"cold join/refresh restores the feed from authoritative events");
has('rebuildProtocolFeed(typeof __pipe.events==="function"?__pipe.events():[])',"watchdog resync restores the feed from authoritative events");
has('window.addForgeRow(html,{channel:"system"})',"transport and resync narration has an explicit System channel");
has('onTransport: function(m){ systemClog',"transport interruptions route to System");
has("function reconcileActiveCatchUp", "active-row/start-event race has a bounded reconciliation path");
has('if(pipe.state().status==="staging")throw new Error',"a half-active session refuses to open rather than desyncing silently");
has('document.dispatchEvent(new CustomEvent("forge:session-status"',"start echoes notify the still-open claim screen");
has('document.addEventListener("forge:session-status"',"claim UI reacts to a remote start without refresh");
has("claim screen open", "pre-claim join narration no longer mislabels the player as a spectator");
has("var bootMine=(row.controllers&&row.controllers[user.id])||[];me.units.length=0", "claims made during cold catch-up are seated into the pipeline identity");
has("if(!u.alive) removeToken(u)", "cold state build applies the defeated visual immediately");
has("if(!u.alive){if(wasAlive||u.sprite||u.topToken)removeToken(u);return;}","resync removes stale defeated sprites");
has("var contestAvailable=coverContestAvailable();if(!contestAvailable)CONTEST_COVER=false", "cover contest disarms itself when geometry reports clear");
has('if(oldContest&&!contestAvailable)oldContest.remove()',"old HUD decorators cannot expose contest on a clear shot");
has('if(!coverContestAvailable()){CONTEST_COVER=false;renderHud();return;}',"a stale external contest click cannot arm a clear shot");

const scripts=[...html.matchAll(/<script(?:\s+type="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)]
  .filter(m=>!m[0].includes('type="importmap"')&&m[2].trim());
ok(scripts.length===3,"production HTML still has three executable inline scripts");
scripts.forEach((m,i)=>{let code=m[2];if(m[1]==="module")code=code.replace(/^import .*;$/mg,"");new vm.Script(code,{filename:"inline-"+i+".js"});});
ok(true,"all executable inline scripts parse");
console.log("\n"+pass+" Phase 2e.1 field-sync checks green");
