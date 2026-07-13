#!/usr/bin/env node
"use strict";
const E=require("../forge-effects.js");
let pass=0;
function ok(v,label){if(!v)throw new Error("FAIL: "+label);pass++;console.log("ok",pass,"-",label);}
function row(seq,kind,unit,payload){return {seq,kind,unit,payload:payload||{}};}

ok(E.VERSION==="1.0.0","version pinned");
const add=E.addSanctuary({source:"liadan",target:"vesperian",dc:13,nonce:7});
ok(add.add_effect.kind==="sanctuary"&&add.add_effect.dc===13,"Sanctuary effect record carries kind and DC");
ok(add.add_effect.duration.count===10&&add.add_effect.duration.unit==="liadan","Sanctuary lasts ten source turns");
ok(E.isSanctuaryAction({label:"Sanctuary (2nd)"}),"upcast-labelled Sanctuary is recognized");
ok(!E.isSanctuaryAction({label:"Shield of Faith"}),"other wards are not mistaken for Sanctuary");
ok(E.harmfulDirect({kind:"attack"})&&E.harmfulDirect({kind:"save"})&&E.harmfulDirect({kind:"buff"}),"direct harmful action kinds are gated");
ok(!E.harmfulDirect({kind:"heal"})&&!E.harmfulDirect({kind:"buffAlly"}),"heals and friendly buffs bypass the gate");
ok(!E.harmfulDirect({kind:"save",aoe:true}),"area effects bypass the direct-target ward gate");

let rows=[
 row(1,"initiative_set","dm",{order:["liadan","vesperian","goblin"]}),
 row(2,"ability_used","liadan",{ability:"Sanctuary",effects:[add]}),
 row(3,"turn_ended","liadan",{}),
 row(4,"turn_ended","vesperian",{}),
 row(5,"turn_ended","goblin",{})
];
let st=E.replay(rows),ward=E.find(st,"vesperian","sanctuary");
ok(!!ward,"effect is replayed from ordinary ability facts");
ok(E.forUnit(st,"vesperian").length===1,"effects index by target unit");
ok(ward.source==="liadan"&&ward.target==="vesperian","source and target survive replay");
ok(ward.expires.startCount===11,"ten-round expiry is anchored to the caster turn count");

const saveFail=E.wisdomSave(ward,1,8),savePass=E.wisdomSave(ward,3,10);
ok(!saveFail.saved&&saveFail.total===9,"failed Wisdom save is deterministic");
ok(savePass.saved&&savePass.total===13,"successful Wisdom save meets the DC");
ok(E.wisdomSave(ward,-20,20).saved,"natural 20 succeeds");
ok(!E.wisdomSave(ward,20,1).saved,"natural 1 fails");

const removal=E.removalForActor(st,"vesperian",{kind:"attack"});
ok(removal&&removal.remove_effect===ward.id,"warded creature attack yields a removal operation");
ok(!E.removalForActor(st,"vesperian",{kind:"heal"}),"healing does not break Sanctuary");
ok(!!E.removalForActor(st,"vesperian",{kind:"ability",dealsDamage:true}),"non-attack damage also breaks Sanctuary");
ok(removal.effect_label==="Sanctuary"&&removal.effect_kind==="sanctuary","removal facts preserve the effect identity for narration");
rows.push(row(6,"attack_resolved","vesperian",{effects:[removal]}));
st=E.replay(rows);
ok(!E.find(st,"vesperian","sanctuary"),"removal operation ends the ward on replay");

const add2=E.addSanctuary({source:"liadan",target:"liadan",dc:13,nonce:8});
let durationRows=[row(1,"initiative_set","dm",{order:["liadan","goblin"]}),row(2,"ability_used","liadan",{effects:[add2]})];
let seq=3;
for(let round=0;round<9;round++){
 durationRows.push(row(seq++,"turn_ended","liadan",{}));
 durationRows.push(row(seq++,"turn_ended","goblin",{}));
}
ok(!!E.find(E.replay(durationRows),"liadan","sanctuary"),"ward remains through nine complete rounds");
durationRows.push(row(seq++,"turn_ended","liadan",{}));
durationRows.push(row(seq++,"turn_ended","goblin",{}));
ok(!E.find(E.replay(durationRows),"liadan","sanctuary"),"ward expires at the caster's eleventh turn start");

const branchAdd=E.addSanctuary({source:"a",target:"b",dc:12,nonce:9});
const branch=[row(1,"initiative_set","dm",{order:["a","b"]}),row(2,"ability_used","a",{effects:[branchAdd]}),row(3,"ability_used","b",{effects:[E.remove(branchAdd.add_effect.id,"attack","b")]}),row(4,"restore","dm",{to_seq:2})];
ok(!!E.find(E.replay(branch),"b","sanctuary"),"restore rebuilds the effect branch at the requested sequence");

const shared=E.effectiveRows(branch);
ok(shared.some(r=>r.seq===2)&&!shared.some(r=>r.seq===3),"effectiveRows removes abandoned post-restore facts");
const summary=E.eventSummary(row(10,"ability_used","goblin",{context:{kind:"sanctuary-save",target:"vesperian",roll:8,mod:1,total:9,dc:13,saved:false}}));
ok(summary.kind==="sanctuary-save"&&!summary.saved,"structured Sanctuary save context is recognized");
const addSummary=E.eventSummary(row(11,"ability_used","liadan",{effects:[add]}));
ok(Array.isArray(addSummary)&&addSummary[0].kind==="effect-add","effect additions can be narrated from facts");
const correctedAdd=E.addSanctuary({source:"liadan",target:"caim",dc:14,nonce:12});
const corrected=E.replay([row(1,"initiative_set","dm",{order:["liadan","caim"]}),row(2,"ability_used","liadan",{effects:[]}),row(3,"override","dm",{corrects_seq:2,correction:{effects:[correctedAdd]}})]);
ok(!!E.find(corrected,"caim","sanctuary"),"overrides correct effect payloads during replay");
const reordered=E.replay([row(1,"initiative_set","dm",{order:["liadan","caim"]}),row(2,"ability_used","liadan",{effects:[add2]}),row(3,"initiative_set","dm",{order:["caim","liadan"],resume_at:"liadan"})]);
ok(reordered.active==="liadan"&&reordered.starts.liadan===1,"reinforcement reorders resume without inventing a new turn start");
const droppedActive=E.replay([row(1,"initiative_set","dm",{order:["a","b"]}),row(2,"initiative_set","dm",{order:["b","c"]})]);
ok(droppedActive.active==="b","initiative replacement falls back when the former active unit leaves the order");
const remSummary=E.eventSummary(row(20,"ability_used","vesperian",{effects:[removal]}));
ok(remSummary[0].label==="Sanctuary"&&remSummary[0].effectKind==="sanctuary","effect-removal summary keeps its label and kind");
console.log("\n"+pass+" Forge effect checks green");
