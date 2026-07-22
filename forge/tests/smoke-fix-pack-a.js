#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const Damage=require("../forge-action-damage.js");
const DamageEvidence=require("../forge-damage-evidence.js");
const Rules=require("../forge-combat-rules.js");
const Table=require("../forge-table-correctness.js");

let pass=0,fail=0;
function ok(name,condition){condition?pass++:fail++;console.log((condition?"✓ ":"✗ ")+name);}
function extract(name){
  const start=html.indexOf("function "+name+"(");if(start<0)throw new Error("missing production function "+name);
  const brace=html.indexOf("{",start);let depth=0,quote=null,escape=false;
  for(let i=brace;i<html.length;i++){
    const c=html[i];if(quote){if(escape)escape=false;else if(c==="\\")escape=true;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==="{")depth++;else if(c==="}"&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error("unterminated production function "+name);
}

(async function(){
  const oaPlan=new Function(extract("reactionSpendPlan")+";return reactionSpendPlan;")()({},"opportunityAttack");
  ok("opportunity attacks require no phantom kit resource",oaPlan&&Object.keys(oaPlan.spend).length===0);

  const merge=new Function("window",extract("normalizeResourceRecord")+"\n"+extract("mergeResourceDefaults")+";return mergeResourceDefaults;")({ForgeReplay:{normalizeResources:r=>Object.assign({},r||{})}});
  const enriched=merge({slot1:0,slot2:1},{slot1:4,slot2:2,bardicInspiration:2});
  ok("legacy rosters gain a missing Bardic Inspiration pool",enriched.bardicInspiration===2);
  ok("explicitly spent resource values remain authoritative",enriched.slot1===0&&enriched.slot2===1);

  const vicious=Damage.rollAction({dmg:"1d4",dmgType:"Psychic"},false,[],()=>0);
  const tollShape=Rules.tollDamage({dmg:"1d8"},{hp:4,hpMax:7});
  const toll=Damage.rollAction({dmg:tollShape.dmg,dmgType:"Necrotic"},false,[],()=>0);
  ok("Vicious Mockery produces structured dice evidence",vicious.total===1&&vicious.parts.length===1&&vicious.formula.includes("1d4"));
  ok("wounded Toll the Dead produces structured d12 evidence",tollShape.dmg==="1d12"&&toll.total===1&&toll.formula.includes("1d12"));
  const fact=Table.factFromEvent({kind:"ability_used",unit:"liadan",payload:{ability:"Vicious Mockery",dmg:vicious.total,dmgParts:vicious.parts,dmgFormula:vicious.formula,effects:[{unit:"goblin",dmg:vicious.total}],context:{kind:"save",target:"goblin",ability:"wis",d20:4,bonus:1,total:5,dc:12,saved:false}}});
  ok("save event translation retains the real damage record",fact.dmgParts===vicious.parts&&fact.dmgFormula===vicious.formula);
  ok("retained save evidence never reports a missing dice record",!DamageEvidence.text(fact.dmgParts,fact.dmg).includes("dice record missing"));

  let resolved=0,logs=[];
  const foe={unit:"goblin",name:"Goblin",side:"foe"},mover={unit:"caim",name:"Caim",side:"pc"};
  const auto=new Function("window","FOE_AUTOMATION","unitByKey","clearPromptUI","escapeHtml","clog","resolveOpportunityAttackPrompt","renderHud","AUTOMATIC_FOE_PROMPTS","NESTED_OA_OUTER","__answeringPromptSeq",extract("routeAutomaticFoePrompt")+";return routeAutomaticFoePrompt;")(
    {__forgeSession:{me:{overseer:true}}},true,k=>k==="goblin"?foe:mover,()=>{},String,s=>logs.push(s),()=>{resolved++;return Promise.resolve({ok:true});},()=>{}, {},{},null);
  const prompt={seq:42,to:"goblin",react:"opportunityAttack",context:{mover:"caim",target:"caim"}};
  ok("automatic foe OA is claimed by the overseer route",auto(prompt)===true);
  ok("duplicate prompt signals cannot roll the OA twice",auto(prompt)===true&&resolved===1);
  const playerRoute=new Function("window","FOE_AUTOMATION","unitByKey","clearPromptUI","escapeHtml","clog","resolveOpportunityAttackPrompt","renderHud","AUTOMATIC_FOE_PROMPTS","NESTED_OA_OUTER","__answeringPromptSeq",extract("routeAutomaticFoePrompt")+";return routeAutomaticFoePrompt;")(
    {__forgeSession:{me:{overseer:false}}},true,k=>k==="goblin"?foe:mover,()=>{},String,()=>{},()=>Promise.resolve(),()=>{}, {},{},null);
  ok("a player device cannot choose an enemy's automatic reaction",playerRoute(prompt)===false);

  const hud=fs.readFileSync(path.join(root,"forge-hud.js"),"utf8");
  ok("game feed has a persistent collapse control",hud.includes('id="fgFeedCollapse"')&&hud.includes("tok-forge-feed-collapsed-v1")&&hud.includes("fg-collapsed"));

  await Promise.resolve();
  console.log("\n"+pass+" passed, "+fail+" failed");process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
