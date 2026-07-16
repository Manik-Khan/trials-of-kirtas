#!/usr/bin/env node
"use strict";
const I=require("../forge-initiative.js");
const R=require("../forge-replay.js");
const K=require("../forge-kit-derive.js");
let pass=0,fail=0;function ok(name,cond){if(cond)pass++;else fail++;console.log((cond?"✓ ":"✗ ")+name);}
function seq(values){let i=0;return sides=>{const v=values[i++];return Math.max(1,Math.min(sides,v));};}
const ves={unit:"ves",name:"Vesperian",side:"pc",c:0,r:0,initMod:4,initiativeProfile:{modifier:4,staticSources:[{key:"dexterity",label:"DEX",value:4}],advantageSources:[],disadvantageSources:[],auras:[]}};
let p=I.profile(ves,{}),e=I.resolve(p,{rng:seq([12])});
ok("DEX source is explicit",e.staticSources.length===1&&e.staticSources[0].label==="DEX"&&e.staticTotal===4);
ok("ordinary initiative preserves d20 and total",e.d20Rolls[0]===12&&e.total===16);
const derived=K.initiativeProfileFor({level:7,proficiencyBonus:3,subclass:"Oath of the Watchers",abilities:{dex:{mod:2}},features:[{name:"Alert"},{name:"Aura of the Sentinel"}]},[{name:"Sentinel Shield",equipped:true}],{init:7});
ok("kit derivation names Alert and Sentinel Shield",derived.staticSources.some(x=>x.key==="alert"&&x.value===5)&&derived.advantageSources.some(x=>x.key==="sentinel-shield"));
ok("kit derivation publishes Watchers aura with paladin proficiency",derived.auras.some(x=>x.key==="aura-of-the-sentinel"&&x.value===3&&x.rangeFt===10));
const seeded=K.initiativeProfileFor({level:4,proficiencyBonus:2,abilities:{dex:{mod:2}},initiativeModifiers:[{type:"die",key:"gift-of-alacrity",label:"Gift of Alacrity",die:"1d8"}]},[],{init:2});
ok("sheet-seeded initiative dice remain named evidence",seeded.diceSources.some(x=>x.label==="Gift of Alacrity"&&x.die==="1d8"));
const alert={...ves,unit:"alert",initMod:9,initiativeProfile:{modifier:9,staticSources:[{key:"dexterity",label:"DEX",value:4},{key:"alert",label:"Alert",value:5}],advantageSources:[],disadvantageSources:[],auras:[]}};
e=I.resolve(I.profile(alert,{}),{rng:seq([10])});ok("Alert is a named +5 source",e.total===19&&e.staticSources.some(x=>x.label==="Alert"&&x.value===5));
const shield={...ves,initiativeProfile:{...ves.initiativeProfile,advantageSources:[{key:"sentinel-shield",label:"Sentinel Shield"}]}};
e=I.resolve(I.profile(shield,{}),{rng:seq([7,18])});ok("Sentinel Shield rolls two d20s and keeps the high die",e.d20Rolls.join(",")==="7,18"&&e.d20===18&&e.advantage);
const effects=[{id:"goa",kind:"gift-of-alacrity",label:"Gift of Alacrity",target:"ves",source:"wizard",die:"1d8"},{id:"guid",kind:"guidance",label:"Guidance",target:"ves",source:"cleric",die:"1d4",consumeOnUse:true},{id:"bard",kind:"bardic-inspiration",label:"Bardic Inspiration",target:"ves",source:"bard",die:"1d6",consumeOnUse:true}];
e=I.resolve(I.profile(ves,{effects}),{rng:seq([11,8,4,6])});
ok("Gift, Guidance, and Bardic dice are individually recorded",e.dice.map(x=>x.roll).join(",")==="8,4,6"&&e.total===33);
ok("Gift persists while Guidance and Bardic are consumed",e.effects.length===2&&e.effects.some(x=>x.remove_effect==="guid")&&e.effects.some(x=>x.remove_effect==="bard")&&!e.effects.some(x=>x.remove_effect==="goa"));
const watcher={unit:"watcher",name:"Watcher",side:"pc",c:1,r:0,alive:true,initiativeProfile:{modifier:1,staticSources:[{label:"DEX",value:1}],advantageSources:[],disadvantageSources:[],auras:[{key:"aura-of-the-sentinel",label:"Aura of the Sentinel",value:3,rangeFt:10}]}};
p=I.profile(ves,{units:[ves,watcher],distanceFt:(a,b)=>Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r))*5});
ok("Aura of the Sentinel applies within range",p.staticSources.some(x=>x.label==="Aura of the Sentinel"&&x.value===3));
watcher.c=3;p=I.profile(ves,{units:[ves,watcher],distanceFt:(a,b)=>Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r))*5});ok("Aura of the Sentinel stops outside its radius",!p.staticSources.some(x=>x.label==="Aura of the Sentinel"));
e=I.resolve(I.profile(ves,{}),{mode:"physical-d20",d20:15,rng:seq([])});ok("physical d20 keeps known static components",e.mode==="physical-d20"&&e.d20===15&&e.total===19&&!e.opaque);
e=I.resolve(I.profile(ves,{}),{mode:"manual-total",total:23});ok("manual total is explicitly opaque",e.opaque&&e.total===23&&e.warnings[0].includes("component evidence unavailable"));
const cancel={...ves,initiativeProfile:{...ves.initiativeProfile,advantageSources:[{label:"adv"}],disadvantageSources:[{label:"dis"}]}};
e=I.resolve(I.profile(cancel,{}),{rng:seq([9])});ok("advantage and disadvantage cancel to one d20",e.d20Rolls.length===1&&e.advantageCancelled&&!e.advantage&&!e.disadvantage);
const payload=I.payload(I.resolve(I.profile(ves,{}),{rng:seq([13])}));ok("publish payload carries total, evidence, and effects",payload.roll===17&&payload.initiative_evidence.d20===13&&Array.isArray(payload.effects));
let st=R.initialState([{unit:"ves",side:"pc",pos:{c:0,r:0},hp:20}]);R.applyEvent(st,{seq:1,kind:"initiative_rolled",unit:"ves",payload});ok("replay preserves initiative evidence",st.rolls.ves===17&&st.initiativeEvidence.ves.d20===13);
console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
