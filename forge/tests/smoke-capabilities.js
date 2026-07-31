#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const Cap=require("../forge-capabilities.js");
const Kit=require("../forge-kit-derive.js");
const root=path.resolve(__dirname,"..","..");
let pass=0,fail=0;
function ok(label,value){if(value){pass++;console.log("ok "+pass+" - "+label);}else{fail++;console.error("not ok - "+label);}}
function liveCharacter(key){
  const row=JSON.parse(fs.readFileSync(path.join(root,"data","characters",key+".json"),"utf8"));
  return {key,name:row.structural.name||key,structural:row.structural,vitals:row.combat||{},inventory:row.inventory||[]};
}
function find(kit,label){return (kit.capabilities||[]).find(c=>c.label===label)||null;}
function match(kit,re){return (kit.capabilities||[]).find(c=>re.test(c.label))||null;}

(async function(){
  const Weapons=await import(path.join(root,"weapon-actions.js"));
  function derive(key){
    const c=liveCharacter(key);
    return Kit.derive(c,{assembledActions:Weapons.assembleActions(c.inventory,c.structural)});
  }
  const party={caim:derive("caim"),cosmere:derive("cosmere"),liadan:derive("liadan"),vesperian:derive("vesperian")};

  ok("shared capability schema is versioned",Cap.VERSION==="1.3.0"&&Cap.SCHEMA==="forge-capability/v1");
  Object.keys(party).forEach(key=>{
    const kit=party[key],audit=kit.capabilityAudit||{},ids=(kit.capabilities||[]).map(c=>c.id);
    ok(key+" derives a non-empty shared capability ledger",kit.capabilitySchema===Cap.SCHEMA&&ids.length>0);
    ok(key+" capability ids are unique",new Set(ids).size===ids.length);
    ok(key+" accounts for every authored source",Array.isArray(audit.unaccountedSources)&&audit.unaccountedSources.length===0&&audit.sourceCount>0);
    ok(key+" emits only valid contract records",Array.isArray(audit.invalidCapabilities)&&audit.invalidCapabilities.length===0&&(kit.capabilities||[]).every(c=>Cap.validate(c).ok));
  });

  const caim=party.caim,cosmere=party.cosmere,liadan=party.liadan,vesperian=party.vesperian;
  ok("Caim folds Ki feature and Ki Points pool into one executable field-gated resource",
    (caim.capabilities||[]).filter(c=>/^ki(?: points)?$/i.test(c.label)).length===1&&
    match(caim,/^ki points?$/i).status==="executable"&&match(caim,/^ki points?$/i).verification==="field");
  ok("Caim keeps Hand of Harm visible but non-executable",find(caim,"Hand of Harm").status==="held");
  ok("Caim projects Deflect Missiles as a missing reaction",find(caim,"Deflect Missiles").status==="missing"&&find(caim,"Deflect Missiles").group==="reactions");
  ok("Caim projects executable fire resistance while Darkvision remains missing",
    find(caim,"Hellish Resistance").status==="executable"&&find(caim,"Hellish Resistance").tags.includes("resistance:fire")&&find(caim,"Darkvision").status==="missing");

  ok("Cosmere projects Repelling Blast as executable but awaiting field proof",
    match(cosmere,/repelling blast/i).status==="executable"&&match(cosmere,/repelling blast/i).verification==="field");
  ok("Cosmere projects Starlight Step as an executable teleport",find(cosmere,"Starlight Step").status==="executable"&&find(cosmere,"Starlight Step").kind==="teleport"&&cosmere.res.starlightStep===2);
  ok("Cosmere keeps Absorb Elements held instead of pretending it resolves",find(cosmere,"Absorb Elements").status==="held");

  ok("Líadan projects Silvery Barbs as executable but awaiting field proof",
    find(liadan,"Silvery Barbs").status==="executable"&&find(liadan,"Silvery Barbs").verification==="field");
  ok("Líadan projects Feather Fall and Creation riders as missing",
    find(liadan,"Feather Fall").status==="missing"&&find(liadan,"Magical Inspiration").status==="missing"&&find(liadan,"Mote of Potential").status==="missing");
  ok("Líadan holds Aid and Spare the Dying behind truthful reasons",
    find(liadan,"Aid").status==="held"&&find(liadan,"Spare the Dying").status==="held");

  ok("Vesperian projects Blessing of the Raven Queen as an executable teleport-defense capability",
    find(vesperian,"Blessing of the Raven Queen").status==="executable"&&find(vesperian,"Blessing of the Raven Queen").kind==="teleport-defense"&&vesperian.res.blessingRavenQueen===1);
  ok("Vesperian derives executable Necrotic Resistance from the authored Shadar-kai race",
    find(vesperian,"Necrotic Resistance").status==="executable"&&find(vesperian,"Necrotic Resistance").tags.includes("resistance:necrotic"));
  ok("Vesperian projects Weapon Bond as missing equipment behavior",find(vesperian,"Weapon Bond").status==="missing");

  const barbarian=Kit.derive({
    key:"barbarian-capability",name:"Barbarian",
    structural:{name:"Barbarian",classLabel:"Barbarian 1",level:1,proficiencyBonus:2,
      abilities:{str:{score:16,mod:3},dex:{score:14,mod:2},con:{score:16,mod:3},int:{score:8,mod:-1},wis:{score:10,mod:0},cha:{score:8,mod:-1}},
      combat:{hp:15,hpMax:15,ac:15,speed:30,initiative:2},features:[{name:"Rage",source:"class:Barbarian"}]},
    vitals:{hp:15},inventory:[]
  },{assembledActions:[{id:"axe",label:"Handaxe",kind:"attack",tab:"attacks",hit:5,dmg:"1d6+3"}]});
  ok("Rage is executable only when the compiled action and feature converge",
    find(barbarian,"Rage").status==="executable"&&/physical resistance/.test(find(barbarian,"Rage").effects));

  Object.keys(party).forEach(key=>{
    ok(key+" never offers non-executable capabilities to enemy AI",
      party[key].capabilities.filter(c=>c.status!=="executable").every(c=>c.consumers.indexOf("enemy-ai")<0));
  });

  const html=fs.readFileSync(path.join(root,"forge","index.html"),"utf8");
  ok("production loads the capability contract before fresh kit derivation",
    html.indexOf("forge-capabilities.js?v=fc4")<html.indexOf("forge-capability-resolver.js?v=fcrs2")&&html.indexOf("forge-capability-resolver.js?v=fcrs2")<html.indexOf("forge-kit-derive.js?v=b19"));
  ok("combat units retain the normalized ledger and audit",
    html.includes("capabilities: JSON.parse(JSON.stringify((kit && kit.capabilities) || []))")&&
    html.includes("capabilityAudit: JSON.parse(JSON.stringify((kit && kit.capabilityAudit) || {}))"));

  console.log("\n"+pass+" capability checks green"+(fail?" · "+fail+" failed":""));
  process.exitCode=fail?1:0;
})().catch(err=>{console.error(err);process.exit(1);});
