#!/usr/bin/env node
"use strict";
const F=require("../forge-combat-rules.js");
let pass=0;
function ok(v,m){if(!v)throw new Error("FAIL: "+m);console.log("ok",++pass,"-",m);}
function throws(fn,re,m){let e;try{fn();}catch(x){e=x;}ok(e&&re.test(e.message),m);}

ok(F.VERSION==="1.3.0","combat-rules version is pinned");
ok(F.FLANKING_MODES.join(",")==="advantage,plus2,plus5,off","all shared flanking modes are stable");
ok(F.assertFlankingMode()==="advantage","advantage is the compatibility/default flanking rule");
throws(()=>F.assertFlankingMode("double-dice"),/unknown flanking mode/,"unknown flanking rules fail loudly");

let r=F.reduceRollSources(["flank","flank","help"],[]);
ok(r.advantage&&!r.disadvantage&&!r.normal,"one or many advantage sources produce one advantage roll");
ok(r.advantageSources.join(",")==="flank,help","duplicate advantage sources do not stack");
r=F.reduceRollSources([], ["prone","prone"]);
ok(r.disadvantage&&r.disadvantageSources.length===1,"duplicate disadvantage sources do not stack");
r=F.reduceRollSources(["flank","help"],["prone"]);
ok(r.normal&&r.cancelled&&!r.advantage&&!r.disadvantage,"any advantage plus any disadvantage cancels to normal");
r=F.reduceRollSources([],[]);
ok(r.normal&&!r.cancelled,"no source produces a normal roll without a cancellation label");

const A={id:"a",side:"pc",c:0,r:1,alive:true};
const T={id:"t",side:"foe",c:1,r:1,alive:true};
const P={id:"p",side:"pc",c:2,r:1,alive:true};
const canReach=()=>true;
ok(F.isFlanked(A,T,[A,T,P],null,canReach),"opposite threatening ally establishes the existing table flank");
const C={id:"c",side:"pc",c:1,r:0,alive:true};
ok(F.isFlanked(C,T,[A,T,P,C],null,canReach),"a third melee attacker benefits when allies already flank the target");
ok(!F.isFlanked(A,T,[A,T,{...P,c:2,r:2}],null,canReach),"adjacent but non-opposite ally does not flank");
ok(!F.isFlanked(A,T,[A,T,{...P,alive:false}],null,canReach),"downed ally cannot provide a flank");
ok(!F.isFlanked(A,T,[A,T,{...P,conditions:["incapacitated"]}],null,canReach),"incapacitated ally cannot provide a flank");
ok(!F.isFlanked({...A,c:4},T,[A,T,P],null,canReach),"attacker must itself threaten the target");
ok(!F.isFlanked(A,T,[A,T,P],null,()=>false),"vertical/melee reach gate remains authoritative");
ok(F.flankingContribution("advantage",true).advantageSources[0]==="flanking","default flank contributes an advantage source");
ok(F.flankingContribution("plus2",true).attackBonus===2,"plus2 variant is numerical, not advantage");
ok(F.flankingContribution("plus5",true).attackBonus===5,"plus5 variant is numerical, not advantage");
ok(F.flankingContribution("off",true).attackBonus===0,"off mode contributes nothing");

const actionSpell={label:"Bless",spell:true,level:1},bonusSpell={label:"Sanctuary",spell:true,level:1,bonus:true},actionCantrip={label:"Sacred Flame",spell:true,level:0};
ok(F.spellCastShape(bonusSpell).slot==="bonus"&&F.spellCastShape(bonusSpell).level===1,"spell facts preserve casting-time economy and level");
ok(!F.canCastSpell({spellCasts:[F.spellCastShape(actionSpell)]},bonusSpell).ok,"an action spell blocks a later bonus-action spell that turn");
ok(F.canCastSpell({spellCasts:[F.spellCastShape(bonusSpell)]},actionCantrip).ok,"a bonus-action spell permits an action cantrip");
ok(!F.canCastSpell({spellCasts:[F.spellCastShape(bonusSpell)]},actionSpell).ok,"a bonus-action spell blocks a later leveled action spell");
ok(F.canCastSpell({spellCasts:[F.spellCastShape(actionSpell)]},{label:"Guiding Bolt",spell:true,level:1}).ok,"two action spells remain legal when another feature supplies the action");

const effectLookup=(u,k)=>!!(u._effects||[]).includes(k);
r=F.attackRollSources({attacker:{...A,_effects:["prone"]},target:T,action:{kind:"attack",rng:1},distanceFt:5,effectLookup});
ok(r.disadvantage&&r.disadvantageSources.includes("attacker prone"),"a prone creature makes attacks with disadvantage");
r=F.attackRollSources({attacker:A,target:{...T,_effects:["prone"]},action:{kind:"attack",rng:1},distanceFt:5,effectLookup});
ok(r.advantage&&r.advantageSources.includes("target prone"),"attacks within five feet gain advantage against prone");
r=F.attackRollSources({attacker:A,target:{...T,_effects:["prone"]},action:{kind:"attack",rng:12},distanceFt:10,effectLookup});
ok(r.disadvantage&&r.disadvantageSources.includes("target prone beyond 5 ft"),"attacks beyond five feet have disadvantage against prone");
r=F.attackRollSources({attacker:A,target:{...T,_effects:["prone"]},action:{kind:"attack",rng:12},distanceFt:5,hostileAdjacent:true,effectLookup});
ok(r.normal&&r.cancelled,"point-blank ranged disadvantage and nearby-prone advantage cancel normally");
r=F.attackRollSources({attacker:A,target:T,action:{kind:"attack",rng:1},distanceFt:5,targetDodging:true});
ok(r.disadvantage&&r.disadvantageSources.includes("target dodging"),"Dodge contributes one disadvantage source against the protected target");
r=F.attackRollSources({attacker:A,target:T,action:{kind:"attack",rng:1},distanceFt:5,flanked:true,flankingMode:"plus2"});
ok(r.normal&&r.attackBonus===2&&!r.advantage,"flat flanking bonus never enters the advantage pool");
r=F.attackRollSources({attacker:A,target:T,action:{kind:"attack",rng:1},distanceFt:5,flanked:true,flankingMode:"advantage",disadvantageSources:["frightened"]});
ok(r.normal&&r.cancelled,"flanking advantage cancels an independent disadvantage source");

ok(F.validDamageExpression("1d4+3"),"ordinary damage expression is valid");
ok(F.validDamageExpression("2d8 + 1d6 - 2"),"multi-component damage expression is valid");
ok(!F.validDamageExpression(""),"blank damage expression is invalid");
ok(!F.validDamageExpression("undefined"),"garbage damage expression is invalid");
ok(F.requireDamage({label:"Dash",kind:"dash"}).ok,"non-damaging actions bypass damage validation");
ok(!F.requireDamage({label:"Broken Flurry",kind:"attack",dmg:null}).ok,"damaging actions fail closed instead of dealing zero");

ok(F.tollDamage({dmg:"1d8"},{hp:10,hpMax:10}).dmg==="1d8","Toll the Dead uses d8 against an unwounded target");
ok(F.tollDamage({dmg:"1d8"},{hp:9,hpMax:10}).dmg==="1d12","Toll the Dead uses d12 against a wounded target");
ok(F.tollDamage({dmg:"2d8"},{hp:1,hpMax:10}).dmg==="2d12","Toll wounded die respects cantrip scaling");

const unarmed={id:"unarmed",label:"Unarmed Strike",kind:"attack",rng:1,hit:4,dmg:"1d4+3",dmgStack:[{dice:"1d4",bonus:3}],critDice:"2d4"};
const flurry={id:"flurry",label:"Flurry of Blows",kind:"attack",dmg:null,hit:null};
const step={id:"step",label:"Step of the Wind",kind:"attack",hit:0,dmg:"0"};
const patient={id:"patient",label:"Patient Defense",kind:"attack",hit:0,dmg:"0"};
const heal={id:"heal",label:"Hand of Healing",kind:"spell",dmg:"1d4+3"};
const harm={id:"harm",label:"Hand of Harm",kind:"attack",hit:null,dmg:null};
const kit={key:"caim",actions:[unarmed,flurry,step,patient,heal,harm],tabs:{attacks:[unarmed],bonus:[flurry,step,patient],actions:[heal,harm]}};
F.auditKit(kit,{key:"caim",structural:{classLabel:"Monk"}});
ok(flurry.kind==="attack"&&flurry.hit===4&&flurry.dmg==="1d4+3","Flurry composes Caim's canonical Unarmed Strike math");
ok(flurry.strikes===2&&flurry.bonus&&flurry.slot==="bonus","Flurry creates two bonus-action strikes");
ok(flurry.needsAttack&&flurry.cost.ki===1,"Flurry requires Attack and spends one canonical Ki");
ok(step.kind==="monk-step"&&step.bonus&&step.cost.ki===1,"Step of the Wind is a Ki bonus action, never an attack");
ok(step.choices.join(",")==="dash,disengage"&&!('dmg' in step)&&!('hit' in step),"Step exposes Dash/Disengage and carries no fake attack math");
ok(patient.kind==="monk-dodge"&&patient.bonus&&patient.cost.ki===1,"Patient Defense is a Ki bonus-action Dodge");
ok(heal.kind==="heal"&&heal.dmg==="1d4+3"&&heal.cost.ki===1,"Hand of Healing retains sheet math and canonical Ki cost");
ok(harm.kind==="monk-rider"&&harm.greyed&&harm.cost.ki===1,"Hand of Harm is explicitly held as a post-hit rider, never a malformed direct attack");
const martial=kit.actions.find(a=>a.label==="Martial Arts");
ok(martial&&martial.hit===4&&martial.dmg==="1d4+3"&&martial.strikes===1,"Martial Arts is composed from the same canonical Unarmed Strike");
ok(martial.bonus&&martial.needsAttack,"Martial Arts enforces its bonus-action and Attack prerequisite");
const minimal={key:"caim"};F.auditKit(minimal,{key:"caim",structural:{classLabel:"Monk"}});
ok(Array.isArray(minimal.actions)&&Array.isArray(minimal.tabs.bonus),"Monk audit degrades safely on a sparse kit");

ok(F.proneStandCostSquares(40)===4,"standing from Prone costs half Caim's 40-foot speed");
ok(F.proneStandCostSquares(30)===3,"standing rounds to half speed in grid squares");
ok(F.crawlCostSquares(3)===6,"crawling doubles movement cost");
ok(F.categoryForHtml("Occluder at 3,4; 8 corners blocked")==="system","geometry diagnostics route to System");
ok(F.categoryForHtml("Longsword — HIT · 8 damage")==="table","combat outcomes stay in Table");
const op=F.addCondition({source:"__overseer",target:"caim",nonce:7});
ok(op.add_effect.kind==="prone"&&op.add_effect.condition,"Prone is represented as a replayable condition effect");

// Replay movement wrapper: path is two cells (10 ft), but prone move costs 20 ft.
const root={ForgeReplay:{
  applyEvent(state,row){return JSON.parse(JSON.stringify(state));},
  replayLog(){return {economy:{unit:"caim",movedFt:10},initiative:["caim"],active:"caim"};},
  activeUnit(){return "caim";}
}};
ok(F.installReplayMovementCosts(root),"movement-cost wrapper installs once");
let st=root.ForgeReplay.applyEvent({economy:{unit:"caim",movedFt:10}},{kind:"move_resolved",unit:"caim",payload:{path:[{},{}],move_cost_ft:20}});
ok(st.economy.movedFt===20,"incremental replay accounts for prone crawl cost");
st=root.ForgeReplay.replayLog({},[{seq:1,kind:"move_resolved",unit:"caim",payload:{path:[{},{}],move_cost_ft:20}}]);
ok(st.economy.movedFt===20,"cold replay accounts for prone crawl cost");
ok(!F.installReplayMovementCosts(root),"movement-cost wrapper is idempotent");
console.log("\n",pass,"combat-rule checks green");
