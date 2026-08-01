#!/usr/bin/env node
"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
let pass=0,fail=0;function ok(label,value){if(value){pass++;console.log("ok "+pass+" - "+label);}else{fail++;console.error("not ok - "+label);}}
function fnSource(name){const mark="function "+name+"(",at=html.indexOf(mark),start=at>=6&&html.slice(at-6,at)==="async "?at-6:at;if(start<0)throw new Error("missing "+name);let brace=html.indexOf("{",at),depth=0,quote=null,esc=false;for(let i=brace;i<html.length;i++){const c=html[i];if(quote){if(esc)esc=false;else if(c==="\\")esc=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==="{")depth++;if(c==="}"&&--depth===0)return html.slice(start,i+1);}throw new Error("unterminated "+name);}
const ctx={console,clog(){},escapeHtml:String};vm.createContext(ctx);
["statblockHasCombatRules","foeLookupKey","rosterFoeLookupName","hydrateRosterStatblocks"].forEach(name=>vm.runInContext(fnSource(name),ctx));
(async function(){
  const queen={name:"Lizard Queen",source:"MM",action:[{name:"Multiattack",entries:["The queen makes two attacks."]},{name:"Trident",entries:["attack"]}],trait:[{name:"Hold Breath",entries:["text"]}]};
  const roster=[{unit:"lizard-queen-1",kind:"foe",name:"Lizard Queen 1",statblock:{name:"Lizard Queen",cr:5,trait:[{name:"Hold Breath"}]}},{unit:"pc",kind:"pc",name:"Hero"}];
  const result=await ctx.hydrateRosterStatblocks(roster,[{name:"Lizard Queen",raw:queen}]);
  ok("thin saved foe row is hydrated from the bestiary before combat",result.hydrated===1&&roster[0].statblock.action.length===2);
  ok("hydration preserves bestiary identity and source",roster[0].bestiary.name==="Lizard Queen"&&roster[0].bestiary.source==="MM");
  const legacy={unit:"queen",kind:"foe",name:"Lizard Queen 1",statblock:{name:"Lizard Queen",action:[{name:"Javelin"}]}};
  await ctx.hydrateRosterStatblocks([legacy],[{name:"Lizard King/Queen",raw:{name:"Lizard King/Queen",action:[{name:"Multiattack"},{name:"Trident"}]}}]);
  ok("legacy King/Queen aliases refresh even when a partial action already exists",legacy.statblock.name==="Lizard King/Queen"&&legacy.statblock.action[0].name==="Multiattack");
  const authored={unit:"custom",kind:"foe",name:"Custom",statblock:{name:"Custom",action:[{name:"Claw"}]}};
  const unchanged=authored.statblock;await ctx.hydrateRosterStatblocks([authored],[{name:"Elsewhere",raw:{name:"Elsewhere",action:[{name:"Wrong"}]}}]);
  ok("unmatched authored statblocks remain authoritative",authored.statblock===unchanged&&authored.statblock.action[0].name==="Claw");
  if(fail){console.error("\n"+fail+" foe hydration checks failed");process.exit(1);}console.log("\n"+pass+" foe hydration checks green");
})().catch(function(error){console.error(error);process.exit(1);});
