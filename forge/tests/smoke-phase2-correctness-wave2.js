/* Phase 2 correctness-wave 2 smokes · 2026-07-15
   Run: node forge/tests/smoke-phase2-correctness-wave2.js */
"use strict";
const fs=require("fs");
const path=require("path");
const E=require("../forge-effects.js");
const R=require("../forge-replay.js");
const C=require("../forge-combat-rules.js");
const K=require("../forge-kit-derive.js");
const F=require("../forge-feed-render.js");
const T=require("../forge-table-correctness.js");
const B=require("../forge-board.js");
let pass=0,fail=0;
function ok(name,cond){if(cond){pass++;console.log("✓ "+name);}else{fail++;console.log("✗ "+name);}}
const row=(seq,unit,kind,payload)=>({seq,unit,kind,payload:payload||{},created_at:seq});

ok("raw foe attack shapes cannot bypass Sanctuary",E.harmfulDirect({hit:4,dmg:"1d6+2",rng:1}));
ok("healing dice never trip Sanctuary's hostile fallback",!E.harmfulDirect({kind:"heal",dmg:"1d4+3"}));
ok("area damage still bypasses direct-target Sanctuary",!E.harmfulDirect({kind:"save",dmg:"2d6",aoe:true}));

const blessOps=E.addBlessGroup({source:"liadan",targets:["caim","vesperian","liadan"],nonce:7});
let es=E.replay([row(1,"dm","initiative_set",{order:["liadan","caim"]}),row(2,"liadan","ability_used",{effects:blessOps})]);
ok("Bless creates three independent target effects",blessOps.length===3&&["caim","vesperian","liadan"].every(k=>E.find(es,k,"bless")));
ok("Bless records concentration and a 1d4 modifier",E.find(es,"caim","bless").concentration===true&&E.modifierDie(es,"caim","bless",3).roll===3);
const hexOp=E.addHex({source:"cosmere",target:"goblin",nonce:8});
es=E.replay([row(1,"dm","initiative_set",{order:["cosmere","goblin"]}),row(2,"cosmere","ability_used",{effects:[hexOp]})]);
ok("Hex is a replayable concentration effect",E.find(es,"goblin","hex").source==="cosmere"&&E.find(es,"goblin","hex").die==="1d6");
ok("starting another concentration spell yields removal facts",E.concentrationRemovals(es,"cosmere").length===1);
let cs=E.concentrationSave(es,"cosmere",24,2,8,{});
ok("failed concentration saves use half-damage DC and remove the casting",cs.required&&cs.dc===12&&!cs.saved&&cs.effects.length===1);

const roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:30,maxHp:30,resources:{ki:4}},{unit:"goblin",side:"foe",pos:{c:2,r:1},hp:20,maxHp:20}];
const setup=[row(1,"__session","session_started",{}),row(2,"__session","initiative_set",{order:["caim","goblin"]})];
let rs=R.replayLog(roster,setup.concat([
 row(3,"caim","attack_resolved",{target:"goblin",hit:true,dmg:2,slot:"bonus",resource_spend:{ki:1},resource_spend_id:"flurry:caim:1"}),
 row(4,"caim","attack_resolved",{target:"goblin",hit:true,dmg:2,slot:"bonus",resource_spend:{ki:1},resource_spend_id:"flurry:caim:1"})
]));
ok("reducer enforces one payment per activation id",rs.units.caim.resources.ki===3&&rs.units.goblin.hp===16);
rs=R.replayLog(roster,setup.concat([
 row(3,"caim","ability_used",{slot:"bonus",resource_spend:{ki:1},resource_spend_id:"step:1"}),
 row(4,"caim","ability_used",{slot:"free",resource_spend:{ki:1},resource_spend_id:"step:2"})
]));
ok("a new activation id spends normally",rs.units.caim.resources.ki===2);
rs=R.replayLog(roster,setup.concat([row(3,"caim","ability_used",{ability:"Sanctuary",slot:"bonus",spell:true,spell_level:1})]));
ok("spell casts are authoritative turn-economy facts",R.turnEconomy(rs).spellCasts.length===1&&R.turnEconomy(rs).bonusSpellCast);
rs=R.replayLog(roster,setup.concat([
 row(3,"caim","ability_used",{slot:"action"}),
 row(4,"caim","reaction_declared",{effects:[]}),
 row(5,"__session","initiative_set",{order:["goblin","caim"],resume_at:"caim",preserve_turn:true})
]));
ok("manual initiative edits preserve the active turn economy and reaction state",R.activeUnit(rs)==="caim"&&R.turnEconomy(rs).usedAction===true&&rs.units.caim.reactionUsed===true);

const actionSpell={label:"Bless",spell:true,level:1};
const bonusSpell={label:"Sanctuary",spell:true,level:1,bonus:true};
const actionCantrip={label:"Sacred Flame",spell:true,level:0};
ok("action Bless then bonus Sanctuary is illegal",!C.canCastSpell({spellCasts:[C.spellCastShape(actionSpell)]},bonusSpell).ok);
ok("bonus Sanctuary then action cantrip is legal",C.canCastSpell({spellCasts:[C.spellCastShape(bonusSpell)]},actionCantrip).ok);
ok("bonus Sanctuary then action leveled spell is illegal",!C.canCastSpell({spellCasts:[C.spellCastShape(bonusSpell)]},actionSpell).ok);
ok("two action leveled spells remain legal when action economy permits",C.canCastSpell({spellCasts:[C.spellCastShape(actionSpell)]},{label:"Guiding Bolt",spell:true,level:1}).ok);

const root=path.join(__dirname,"..","..");
const cosmere=JSON.parse(fs.readFileSync(path.join(root,"data/characters/cosmere.json"),"utf8"));
const liadan=JSON.parse(fs.readFileSync(path.join(root,"data/characters/liadan.json"),"utf8"));
const ck=K.derive(cosmere,{}),lk=K.derive(liadan,{});
const hex=(ck.tabs.spells||[]).find(a=>a.label==="Hex"),bless=(lk.tabs.spells||[]).find(a=>a.label==="Bless");
ok("Cosmere derives two Pact and two Sorcerer first-level slots",ck.res.pact===2&&ck.res.slot1===2&&ck.pools.some(p=>p.key==="pact"&&p.current===2)&&ck.pools.some(p=>p.key==="slot1"&&p.current===2));
ok("Hex carries first-class effect metadata",hex&&hex.effectKind==="hex"&&hex.concentration===true);
ok("Bless carries three-target effect metadata",bless&&bless.effectKind==="bless"&&bless.targetCount===3&&bless.concentration===true);

let html=F.rollBody({actor:"caim",target:"goblin",mode:"Strike",roll:18,rollTotal:24,hitBonus:3,hit:true,d20Rolls:[7,18],d20KeptIndex:1,mods:[{k:"bless",v:3}]},{unitName:k=>k});
ok("kept die has an explicit visual class and Bless appears in math",html.includes("ffr-keep")&&html.includes("bless +3")&&F.CSS.includes(".ffr-keep{")&&F.CSS.includes(".ffr-reaction-dice{"));
html=F.rollBody({actor:"goblin",target:"liadan",mode:"Scimitar",roll:16,rollTotal:20,hitBonus:4,hit:true,dmg:6,concentration:{required:true,roll:8,baseBonus:2,bless:3,total:13,dc:10,saved:true}},{unitName:k=>k});
ok("concentration evidence is visible in the Chronicle",html.includes("Concentration:")&&html.includes("Bless +3")&&html.includes("holds"));
const oa=T.factFromEvent({unit:"goblin",kind:"prompt_answered",payload:{use:true,context:{kind:"opportunity-attack",actor:"goblin",target:"caim",mode:"Scimitar",roll:15,roll_total:19,hitBonus:4,hit:true,dmg:5,d20_rolls:[15],d20_kept_index:0}}});
ok("opportunity attacks become structured Chronicle facts",oa&&oa.kind==="attack"&&oa.mode==="Scimitar"&&oa.dmg===5&&oa.rollTotal===19);

const before=R.replayLog(roster,setup.concat([row(3,"caim","move_declared",{path:[{c:2,r:1},{c:3,r:1},{c:4,r:1}]})]));
const after=R.snapshot(before);R.applyEvent(after,row(4,"caim","move_resolved",{path:[{c:2,r:1}],final_cell:{c:2,r:1},interrupted_at:{c:2,r:1}}));
const walk=B.verbsFor(row(4,"caim","move_resolved",{path:[{c:2,r:1}],final_cell:{c:2,r:1},interrupted_at:{c:2,r:1}}),before,after).find(v=>v.t==="walk");
ok("interrupted movement animates only the resolved path",walk&&walk.path.length===1&&walk.to.c===2);

const source=fs.readFileSync(path.join(root,"forge/topography-test-mock.html"),"utf8");
const pipelineSource=fs.readFileSync(path.join(root,"forge/forge-pipeline.js"),"utf8");
ok("foe attacks enter Sanctuary as explicit attacks",source.includes('sanctuaryGate(u,Object.assign({kind:"attack"},atk)'));
ok("shared resource payments carry activation identifiers",source.includes("function resourceSpendIdFor")&&source.includes("resource_spend_id:spendFact?resourceSpendId:null"));
ok("Cosmere can choose Pact or ordinary slots",source.includes("function castableSpellSources")&&source.includes('p.kind!=="slot"')&&source.includes("Choose which eligible pool pays for the spell"));
ok("Bless has a three-target picker and replay effects",source.includes("function openBlessPicker")&&source.includes("E.addBlessGroup")&&source.includes("Choose up to "));
ok("multiplayer movement asks opportunity-attack prompts",source.includes('declaredRow.kind==="move_declared"')&&source.includes('react:"opportunityAttack"')&&source.includes("interrupted_at"));
ok("overseer can enter and reorder initiative without refunding the turn",source.includes("function setManualInitiative")&&source.includes("function moveInitiativeDraft")&&source.includes("setInitiative(order,resumeAt,!!st.initiative)")&&source.includes("cbInitCancel")&&source.includes("Apply order")&&pipelineSource.includes("payload.preserve_turn = true"));
ok("soft-reality fog separates broad sight from detail",source.includes("discoveryBroadRadiusFt")&&source.includes("DISCOVERY.detail")&&source.includes("Soft-reality band"));
ok("unknown fog is ground-level instead of an overhead slab",source.includes("veil.position.y=-BASE+.02")&&source.includes("depthTest:true")&&!source.includes("var maxFt=0;for(var i=0;i<CB.map.h.length"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
