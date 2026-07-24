#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const AD=require(path.join(root,"forge-action-damage.js"));
const FR=require(path.join(root,"forge-feed-render.js"));
const DE=require(path.join(root,"forge-damage-evidence.js"));
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function eq(a,b,l){ok(JSON.stringify(a)===JSON.stringify(b),l+" ("+JSON.stringify(a)+")");}

/* Grounded fixture: the current Vesperian record has DEX +4, PB +2,
   fightingStyle Dueling, a legacy bb_vesperian action with hitMod +6, and a
   live derived Booming Blade tile whose source is the bound longsword. */
const ves={
  abilities:{dex:{mod:4},str:{mod:-1}},proficiencyBonus:2,
  classFeatures:{fightingStyle:"Dueling"},
  features:[{name:"Dueling",desc:"+2 damage when wielding a melee weapon in one hand and no other weapons."}]
};
const bb={id:"bb_vesperian",_derivedId:"cant-boomingblade",label:"Booming Blade · Longsword",hit:6,dmg:"1d8+4",dmgStack:[{dice:"1d8",bonus:4,type:"Slashing (booming)"}],_src:{id:"cant-boomingblade",type:"attack",ability:"dex",proficient:true,atkBonus:0,dmgAbility:true,dmgBonus:0,dmgDice:"1d8",dmgType:"Slashing (booming)"}};
const legacyBb={id:"bb_vesperian",label:"Booming Blade",hit:6,dmg:"1d8+4",dmgStack:[{dice:"1d8",bonus:4,type:"Slashing (booming)"}],_src:{id:"bb_vesperian",type:"attack-cantrip",hitMod:6,dmgMod:0,dmgDice:"1d8",dmgType:"Slashing (booming)"}};
const ls={id:"ls_1h",_derivedId:"wpn-longsword",label:"Longsword",hit:6,dmg:"1d8+4",dmgStack:[{dice:"1d8",bonus:4,type:"Slashing"}],_src:{id:"wpn-longsword",ability:"dex",proficient:true,atkBonus:0,dmgAbility:true,dmgBonus:0,dmgDice:"1d8",dmgType:"Slashing"}};
const two={id:"ls_2h",_derivedId:"wpn-longsword-2h",label:"Longsword (Two-Handed)",hit:6,dmg:"1d10+4",dmgStack:[{dice:"1d10",bonus:4,type:"Slashing"}],_src:{id:"wpn-longsword-2h",ability:"dex",proficient:true,atkBonus:0,dmgAbility:true,dmgBonus:0,dmgDice:"1d10",dmgType:"Slashing"}};
const kit={actions:[bb,legacyBb,ls,two],tabs:{attacks:[bb,legacyBb,ls,two]}};AD.repairKit(kit,ves);
eq(bb.dmgStack[0].bonus,6,"live Booming Blade receives DEX + Dueling");
eq(legacyBb.dmgStack[0].bonus,6,"legacy-id Booming Blade recovers DEX from hitMod and receives Dueling");
eq(ls.dmgStack[0].bonus,6,"one-handed longsword receives DEX + Dueling");
eq(two.dmgStack[0].bonus,4,"two-handed mode does not receive Dueling");
eq(bb.dmg,"1d8+6","display expression is repaired with the real modifier");
AD.repairKit(kit,ves);eq(bb.dmgStack[0].bonus,6,"Dueling repair is idempotent");eq(legacyBb.dmgStack[0].bonus,6,"legacy-id repair is idempotent");

/* Grounded Cosmere fixture: CHA +3, PB +2, Agonizing Blast, legacy EB
   hitMod +5/dmgMod 0. The final action must become 1d10+3. */
const cos={abilities:{cha:{mod:3}},proficiencyBonus:2,features:[{name:"Eldritch Invocation: Agonizing Blast",desc:"Add CHA modifier (+3) to Eldritch Blast damage."}]};
const eb={id:"eldritch_blast",label:"Eldritch Blast",hit:5,dmg:"1d10",dmgStack:[{dice:"1d10",bonus:0,type:"Force"}],_src:{id:"eldritch_blast",type:"attack-cantrip",hitMod:5,dmgMod:0,dmgDice:"1d10",dmgType:"Force"}};
AD.repairAction(eb,cos);eq(eb.dmgStack[0].bonus,3,"Agonizing Blast adds Cosmere's CHA +3");eq(eb.dmg,"1d10+3","Eldritch Blast expression includes Agonizing Blast");AD.repairAction(eb,cos);eq(eb.dmgStack[0].bonus,3,"Agonizing Blast repair is idempotent");

let seq=[5];const normal=AD.rollAction(bb,false,[],()=>seq.shift());eq(normal.total,11,"normal hit totals actual d8 roll plus six");eq(normal.parts[0].rolls,[5],"normal hit records the actual die");eq(normal.parts[0].bonus,6,"normal hit records +6 separately");eq(normal.parts[0].rolledDice,"1d8","normal formula records 1d8");
seq=[4,5];const crit=AD.rollAction(bb,true,[],()=>seq.shift());eq(crit.total,15,"critical hit doubles dice and adds +6 once");eq(crit.parts[0].rolls,[4,5],"critical hit records both d8 results");eq(crit.parts[0].rolledDice,"2d8","critical formula records doubled dice");
seq=[4];const blast=AD.rollAction(eb,false,[],()=>seq.shift());eq(blast.total,7,"Eldritch Blast rolls d10 +3");eq(blast.parts[0].rolls,[4],"Eldritch Blast records its actual d10");eq(blast.parts[0].bonus,3,"Eldritch Blast records Agonizing Blast separately");

const f={kind:"attack",actor:"vesperian",target:"foe",mode:"Booming Blade · Longsword",roll:20,hitBonus:6,hit:true,crit:true,dmg:crit.total,dmgParts:crit.parts,dmgFormula:crit.formula};
const out=FR.rollBody(f,{unitName:k=>k});
ok(out.includes("Crit dmg:"),"feed uses the site Battle HUD damage label");ok(out.includes("[4][5]"),"feed visibly shows each critical die");ok(out.includes("+6"),"feed visibly shows the correct +6 modifier");ok(out.includes("= <b>15</b>"),"feed visibly shows arithmetic total");ok(out.includes("2d8"),"feed visibly shows critical formula");ok(!out.includes("components ="),"technical component checksum is gone");ok(!out.includes('class="ffr-dmg-total">✶ 15 dmg'),"single-component damage no longer duplicates a scalar total header");ok(FR.assertNoAC(out),"feed still never exposes target AC");
const ebOut=FR.rollBody({kind:"attack",actor:"cosmere",target:"foe",mode:"Eldritch Blast",roll:14,hitBonus:5,hit:true,crit:false,dmg:blast.total,dmgParts:blast.parts,dmgFormula:blast.formula},{unitName:k=>k});ok(ebOut.includes("[4]")&&ebOut.includes("+3")&&ebOut.includes("= <b>7</b>"),"Cosmere feed visibly shows d10 +3 arithmetic");

const fact={kind:"attack",hit:true,dmg:11};DE.attachPayload(fact,{dmgParts:normal.parts,dmgFormula:normal.formula});eq(fact.dmgParts[0].rolls,[5],"protocol bridge preserves actual rolls");eq(fact.dmgParts[0].bonus,6,"protocol bridge preserves the modifier");ok(DE.arithmetic(fact.dmgParts[0])==="[5] +6 = 11 Slashing (booming)","compatibility evidence uses the same explicit math");

ok(html.includes('forge-action-damage.js?v=fad1'),"production loads canonical action-damage module");ok(html.includes('forge-feed-render.js?v=ffr6'),"production loads canonical feed renderer");ok(html.includes('forge-damage-evidence.js?v=fde3'),"production loads transport bridge v3");ok(html.includes('ForgeActionDamage.repairKit'),"production repairs the final combat kit, not an intermediate list");ok(html.includes('ForgeActionDamage.rollAction'),"production combat uses the canonical roller");ok(html.includes('rollActionDamage(atk,hs.crit,[])'),"local foe critical hits double their damage dice");ok(html.includes('rollActionDamage(atk,fhs.crit,[])'),"shared foe critical hits double their damage dice");
console.log("\n"+pass+" Phase 2f.2 damage-pipeline checks green");
