#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const engine=fs.readFileSync(path.join(root,"forge-engine.js"),"utf8");
const Damage=require(path.join(root,"forge-damage-evidence.js"));
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function has(t,n,l){ok(t.includes(n),l);}

// 1. The resolved-event path must insert evidence BEFORE addForgeRow receives HTML.
const rows=[];
const base={
  factFromEvent(row){const p=row.payload||{};return {kind:"attack",actor:row.unit,target:p.target,mode:p.mode,roll:p.roll,hitBonus:p.hitBonus,hit:!!p.hit,dmg:p.dmg};},
  factHtml(f){return '<div class="forge-result-row"><div class="ffr-dmg-total">'+f.dmg+' dmg</div></div>';},
  pushEvent(){return "";}
};
const fake={ForgeTableCorrectness:base,addForgeRow(h,o){rows.push({html:h,opts:o||{}});}};
ok(Damage.install(fake),"damage evidence installs over the actual table seam");
fake.ForgeTableCorrectness.pushEvent({kind:"attack_resolved",unit:"vesperian",payload:{target:"goblin",mode:"Booming Blade · Longsword",roll:10,hitBonus:6,hit:true,dmg:7,dmgFormula:"1d8+6 Slashing",dmgParts:[{dice:"1d8",rolls:[1],bonus:6,type:"Slashing",total:7}]}});
ok(rows[0].html.includes('data-damage-evidence="2"'),"resolved row carries evidence before HUD insertion");
has(rows[0].html,'1d8 + 6 Slashing',"formula is visible");
has(rows[0].html,'[1] +6 = 7 Slashing',"rolled arithmetic is visible");
ok(rows[0].opts.channel==="table","damage row is a Table row");

rows.length=0;
fake.ForgeTableCorrectness.pushEvent({kind:"attack_resolved",unit:"legacy",payload:{target:"goblin",mode:"Legacy strike",roll:12,hitBonus:4,hit:true,dmg:5}});
has(rows[0].html,"Damage evidence missing", "scalar-only events fail visibly instead of masquerading as complete evidence");
ok(rows.some(r=>r.opts.channel==="system"),"missing evidence also reports to System");

// 2. Extract and execute the final-kit Dueling repair that combat actually consumes.
function extractFunction(name){
  const start=html.indexOf("function "+name+"(");if(start<0)throw new Error("missing "+name);
  const brace=html.indexOf("{",start);let depth=0,quote=null,esc=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];if(quote){if(esc)esc=false;else if(c==='\\')esc=true;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return html.slice(start,i+1);
  }throw new Error("unterminated "+name);
}
const names=["parseDmg","structuralHasDueling","externalWeaponActionsOwnDueling","finalDuelingId","finalDuelingEligible","addDuelingToFinalAction","applyFinalDueling"];
const ctx={console};vm.createContext(ctx);vm.runInContext(names.map(extractFunction).join("\n"),ctx);
const kit={actions:[{label:"Booming Blade · Longsword",kind:"attack",rng:1,_tileId:"cant-boomingblade",dmg:"1d8+4",dmgStack:[{dice:"1d8",bonus:4,type:"Slashing"}]}],tabs:{attacks:[]}};
ctx.applyFinalDueling(kit,{features:[{name:"Dueling"}],classFeatures:{fightingStyle:"Dueling"}});
ok(kit.actions[0].dmg==="1d8+6","final combat action receives Dueling");
ok(kit.actions[0].dmgStack[0].bonus===6,"final component stack receives Dueling");
ctx.applyFinalDueling(kit,{features:[{name:"Dueling"}],classFeatures:{fightingStyle:"Dueling"}});
ok(kit.actions[0].dmg==="1d8+6","Dueling is idempotent on the final action");
const two={actions:[{label:"Longsword (Two-Handed)",_tileId:"wpn-longsword-2h",dmg:"1d10+4",dmgStack:[{dice:"1d10",bonus:4,type:"Slashing"}]}],tabs:{}};
ctx.applyFinalDueling(two,{features:[{name:"Dueling"}]});
ok(two.actions[0].dmg==="1d10+4","two-handed mode is excluded");

// 3. Connector diagnostics must be discoverable in the always-visible authoring panel.
has(html,'id="verticalGeometryPanel"',"vertical diagnostics live in the left panel");
has(html,'id="verticalOverlayPanelBtn"',"visible Show connectors button exists");
has(html,'id="findBridgeSeed"',"visible deterministic bridge-seed finder exists");
has(html,'function refreshVerticalGeometryPanel()',"connector counts are painted");
has(html,'no structural bridge on this seed',"zero-bridge maps say so explicitly");
has(html,'function findNearbyBridgeSeed()',"bridge seed search is executable, not a checklist fiction");
ok(html.includes('engine.findBridgeRecipe(base')&&engine.includes('No active intentional archetype owns bridge placement yet'),"bridge seed search remains available but cannot force a bridge into a legacy map");

// 4. The obsolete post-render decorator must not remain.
ok(!html.includes('D.decorateNewestRow(document,fact)'),"fragile post-render decoration is gone");
has(html,'D.install(window)',"HTML installs the pre-render evidence seam");
has(html,'forge-damage-evidence.js?v=fde3',"cache stamp is bumped");

console.log("\n"+pass+" Phase 2f.1 audited field checks green");
