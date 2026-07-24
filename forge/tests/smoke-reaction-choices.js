#!/usr/bin/env node
"use strict";
const R=require("../forge-reaction-choices.js"),G=require("../tactics-geometry.js");
let pass=0,fail=0;function ok(value,label){if(value){pass++;console.log("ok",pass,"-",label);}else{fail++;console.log("not ok -",label);}}
const sword={label:"Longsword",kind:"attack",rng:1},boom={label:"Booming Blade · Longsword",kind:"attack",rng:1,spell:true,level:0},bolt={label:"Eldritch Blast",kind:"attack",rng:24,spell:true,level:0},smite={label:"Searing Smite",kind:"buff",spell:true,cost:{slot1:1}};
let choices=R.warCasterChoices({featureFlags:{warCaster:true},actions:[sword,boom,bolt,smite]},sword);
ok(choices.map(x=>x.label).join("|")==="Longsword|Booming Blade · Longsword|Eldritch Blast","War Caster offers the weapon and at-will attack cantrips");
choices=R.warCasterChoices({featureFlags:{},actions:[boom]},sword);
ok(choices.length===1&&choices[0].kind==="weapon","a unit without War Caster receives only its ordinary weapon");
ok(!R.isAtWillAttackCantrip(smite),"leveled or non-attack spells do not enter the first War Caster slice");
const map=G.makeMap(8,3),caster={c:1,r:1},target={c:3,r:1},occupied=new Set();
let path=R.repellingPath({map,geometry:G,caster,target,occupied,maxSquares:2});
ok(path.length===2&&path[1].c===5&&path[1].r===1,"Repelling Blast pushes directly away from the caster for 10 feet");
map.wall[1*8+5]=true;
path=R.repellingPath({map,geometry:G,caster,target,occupied,maxSquares:2});
ok(path.length===1&&path[0].c===4,"a wall shortens the optional push to the last legal cell");
map.wall[1*8+5]=false;occupied.add("4,1");
ok(R.repellingPath({map,geometry:G,caster,target,occupied,maxSquares:2}).length===0,"another creature blocks forced movement");
console.log("\n"+pass+" reaction-choice checks green"+(fail?" · "+fail+" failed":""));process.exitCode=fail?1:0;
