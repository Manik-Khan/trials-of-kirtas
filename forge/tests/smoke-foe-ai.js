#!/usr/bin/env node
"use strict";
const AI=require("../forge-foe-ai.js");
let pass=0;function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
const archer={unit:"archer",name:"Archer",c:0,r:0},caim={unit:"caim",name:"Caim",c:11,r:0,hp:24,hpMax:24,alive:true};
const sword={label:"Shortsword",kind:"attack",rng:1,hit:6,dmg:"1d6+4"},bow={label:"Longbow",kind:"attack",rng:30,long:120,hit:6,dmg:"1d8+4"};
ok(AI.VERSION==="1.0.0","planner version is pinned");
ok(AI.avgFormula("2d6+3")===10,"average damage reads dice and flat bonuses");
ok(AI.actionRangeFt(bow)===600,"long range is retained for planning");
const archerPlan=AI.planTurn({actions:[sword,bow],targets:[caim],origins:[{c:0,r:0,cost:0}],evaluate:(o,a)=>a===bow?{ok:true,distanceFt:55,cover:2,coverName:"half"}:{ok:false},distance:()=>55});
ok(archerPlan.kind==="attack"&&archerPlan.action===bow,"Archer chooses its legal longbow instead of advancing with the first melee entry");
ok(/Longbow/.test(archerPlan.why)&&/55 ft/.test(archerPlan.why),"automatic choice narrates weapon and range");
const meleePlan=AI.planTurn({actions:[sword],targets:[caim],origins:[{c:0,r:0,cost:0},{c:10,r:0,cost:10}],evaluate:(o)=>o.c===10?{ok:true,distanceFt:5,cover:0,coverName:"none"}:{ok:false},distance:(o)=>Math.abs(11-o.c)*5});
ok(meleePlan.kind==="move-attack"&&meleePlan.origin.c===10,"melee foe moves to an origin that permits its real attack");
ok(/legal attack/.test(meleePlan.why)&&!/legal shot/.test(meleePlan.why),"melee narration calls the choice an attack rather than a shot");
const clear=AI.planTurn({actions:[bow],targets:[caim],origins:[{c:0,r:0,cost:0},{c:1,r:0,cost:1}],evaluate:(o)=>o.c?{ok:true,distanceFt:50,cover:0,coverName:"none"}:{ok:true,distanceFt:55,cover:5,coverName:"three-quarters"},distance:()=>50});
ok(clear.origin.c===1,"planner may spend movement to improve a heavily covered shot");
const approach=AI.planTurn({actions:[sword],targets:[caim],origins:[{c:0,r:0,cost:0},{c:4,r:0,cost:4}],evaluate:()=>({ok:false}),distance:(o)=>Math.abs(11-o.c)*5});
ok(approach.kind==="move"&&approach.origin.c===4,"when no attack is possible the foe approaches as far as it legally can");
ok(AI.planTurn({actions:[],targets:[],origins:[]}).kind==="stand","empty turns degrade to an explicit stand decision");
console.log("\n"+pass+" foe-AI checks green");
