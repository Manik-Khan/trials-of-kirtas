#!/usr/bin/env node
"use strict";
/* Phase 1.5h authoritative line-of-sight + cover known-answer battery.
   Supersedes the old eight-ray head/feet grading expectations. */
const G=require("../tactics-geometry.js");
let pass=0;
function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
function eq(a,b,label){ok(a===b,label+" (got "+String(a)+", expected "+String(b)+")");}
function map(cols=10,rows=7){const m=G.makeMap(cols,rows);m.occ=new Array(cols*rows).fill(0);m.coverShape=new Array(cols*rows).fill(null);return m;}
function at(m,c,r){return r*m.cols+c;}
function put(m,c,r,h,shape,terrain){const i=at(m,c,r);if(terrain!=null)m.h[i]=terrain;m.occ[i]=h;if(shape)m.coverShape[i]=shape;}
function wall(m,c,r,h,terrain=0){const i=at(m,c,r);m.h[i]=terrain;m.wall[i]=true;m.occ[i]=h;m.coverShape[i]={kind:"full",source:"wall"};}
function shot(m,a={c:1,r:3},b={c:8,r:3},opts){return G.losVerdict(m,a,b,opts);}

/* Core contract and open-space behavior. */
eq(G.BODY_SAMPLES,12,"four horizontal samples across three body bands");
eq(shot(map()).cover,"none","open shot has no cover");
ok(shot(map()).canTarget,"open target can be targeted");
let m=map();m.h[at(m,5,3)]=-10;eq(shot(m).cover,"none","a pit never blocks a level shot");
m=G.makeMap(10,7);m.wall[at(m,5,3)]=true;eq(shot(m).cover,"total","legacy wall without occ remains opaque");

/* Body-percentage calibration. */
m=map();put(m,7,3,2.5,{kind:"full",source:"lip"});let v=shot(m);eq(v.cover,"none","shin-high full-cell lip does not reach half-body threshold");eq(v.graded,4,"shin-high lip blocks only the lower body band");
m=map();put(m,7,3,3,{kind:"full",source:"wall"});v=shot(m);eq(v.cover,"half","waist-high wall grants half cover");eq(v.graded,6,"waist-high wall blocks six target-side samples");
m=map();put(m,7,3,4.5,{kind:"full",source:"wall"});v=shot(m);eq(v.cover,"half","high barricade remains half below nine samples");eq(v.graded,8,"high barricade blocks eight body samples");
m=map();put(m,7,3,4.76,{kind:"box",halfX:.4,halfY:.48,source:"barricade"});v=shot(m);eq(v.cover,"three-quarters","obstruction hiding roughly three quarters of the sampled body grants three-quarters cover");
m=map();put(m,7,3,5,{kind:"full",source:"wall"});eq(shot(m).cover,"total","full-height solid beside target grants total cover");

/* Target-side attribution. */
m=map();put(m,2,3,3,{kind:"full",source:"terrace"});v=shot(m);eq(v.cover,"none","attacker-side obstruction is a vantage problem, not target AC");
m=map();put(m,5,3,3,{kind:"full",source:"midfield"});v=shot(m);eq(v.cover,"none","midfield low lip remains below half-body threshold");eq(v.graded,4,"midfield tie still attributes blocked samples to defender");
m=map();put(m,2,3,3,{kind:"full",source:"attacker-clutter"});put(m,7,3,3,{kind:"full",source:"target-wall"});v=shot(m);eq(v.cover,"half","attacker clutter cannot shadow real target-side cover");ok(v.culprits["target-wall"]||v.culprits.wall,"culprit data retains target-side obstruction source");

/* Sub-cell prop footprints. */
m=map();put(m,7,3,5,{kind:"circle",radius:.15,source:"tree"});eq(shot(m).cover,"none","narrow trunk does not fill a five-foot square");
m=map();put(m,7,3,5,{kind:"circle",radius:.34,source:"tree"});v=shot(m);ok(v.cover==="none"||v.cover==="half","medium trunk cannot become total cover by cell occupancy alone");
m=map();put(m,7,3,4.5,{kind:"circle",radius:.40,source:"boulder"});v=shot(m);ok(v.cover!=="total","large rounded boulder remains sub-cell cover");
m=map();put(m,7,3,5,{kind:"box",halfX:.46,halfY:.12,source:"column"});v=shot(m);ok(v.cover!=="total","narrow rectangular column is footprint-aware");
m=map();put(m,7,3,5,{kind:"circle",radius:.22,cx:.15,cy:.5,source:"offset-tree"});eq(shot(m).cover,"none","offset footprint is sampled at its actual in-cell position");

/* Intervening creature cover. */
m=map();m.creatures=[{id:"screen",c:7,r:3,heightFt:5,radius:.35,alive:true}];v=shot(m);eq(v.cover,"half","intervening Medium creature can provide half cover");ok(!!v.culprits.creature,"creature appears in culprit audit");
m.creatures[0].alive=false;eq(shot(m).cover,"none","downed/dead creature does not provide creature cover");
m.creatures[0].alive=true;eq(shot(m,undefined,undefined,{ignoreCreatures:true}).cover,"none","discovery may ignore transient creature screens");
m=map();m.creatures=[{id:"attacker",c:1,r:3,heightFt:5,radius:.48,alive:true},{id:"target",c:8,r:3,heightFt:5,radius:.48,alive:true}];eq(shot(m).cover,"none","attacker and target own creature spaces are skipped");

/* Elevation and dead ground. */
m=map();put(m,6,3,5,{kind:"full",source:"wall"});m.h[at(m,1,3)]=10;v=shot(m);ok(v.cover==="none"||v.cover==="half","elevation reduces target-side cover rather than worsening it");
m=map();m.h[at(m,1,3)]=20;wall(m,2,3,7,15);m.h[at(m,8,3)]=0;v=shot(m);ok(v.canTarget,"standing at a low parapet can authorize a downward shot");ok(v.eye&&v.eye.stepOut,"parapet shot reports the legal step-out eye");
m=map();m.h[at(m,1,3)]=20;wall(m,2,3,7,15);m.h[at(m,3,3)]=0;v=G.losVerdict(m,{c:1,r:3},{c:3,r:3});ok(!v.canTarget,"steep downward line still hits terrain berm beneath parapet cap");
m=map();m.h[at(m,1,3)]=20;wall(m,2,3,12,15);m.h[at(m,8,3)]=0;v=shot(m);ok(!v.canTarget,"parapet at or above eye height blocks");
m=map();m.h[at(m,0,3)]=20;m.h[at(m,1,3)]=20;wall(m,2,3,7,15);m.h[at(m,8,3)]=0;v=G.losVerdict(m,{c:0,r:3},{c:8,r:3});ok(!v.canTarget,"one square back cannot use adjacent parapet lean");

/* Edge selection and corner legality. */
m=map();wall(m,2,3,5);v=shot(m,{c:1,r:3},{c:8,r:3});ok(!v.canTarget,"target-facing tall wall owns the ruling and blocks corner graze");
m=map();wall(m,1,2,5);v=shot(m,{c:1,r:3},{c:8,r:3});ok(v.canTarget,"side wall does not become an illegal target-facing parapet");
m=map();wall(m,2,2,5);v=G.losVerdict(m,{c:1,r:3},{c:8,r:0});ok(v.canTarget||v.firstBlocker,"diagonal cell is traced normally, never ignored as parapet");
const edges=G.targetFacingEdges({c:1,r:1},{c:5,r:5});eq(edges.length,2,"exact 45-degree shot considers both cardinal facing edges");

/* Ray/result metadata and audit. */
m=map();put(m,7,3,3,{kind:"full",source:"wall"});v=shot(m);ok(v.eye&&Number.isFinite(v.eye.x),"winning eye rides with verdict");eq(v.samples,12,"verdict reports body sample count");ok(v.firstBlocker&&v.firstBlocker.c===7,"verdict reports first blocker");
const ray=G.losRay(m,{c:1,r:3},{c:8,r:3},v.eye);ok(!ray.blocked,"center sight ray can remain clear while lower-body samples grant cover");
const audit=G.coverAudit(m,[{a:{c:1,r:3},b:{c:8,r:3}},{a:{c:1,r:2},b:{c:8,r:2}}]);eq(audit.total,2,"cover audit counts valid sampled pairs");eq(audit.counts.half,1,"cover audit records half-cover result");eq(audit.counts.none,1,"cover audit records clear result");ok(audit.percent.half===50&&audit.percent.none===50,"cover audit reports percentages");ok(audit.culprits.wall>0,"cover audit groups culprit types");

/* Distance and API compatibility. */
m=map();m.h[at(m,8,3)]=20;ok(Math.abs(G.range3d(m,{c:1,r:3},{c:8,r:3})-Math.hypot(35,20))<1e-9,"range3d remains Euclidean over Chebyshev horizontal distance");
ok(G.inRange(m,{c:1,r:3},{c:8,r:3},41),"inRange accepts sufficient 3D range");
ok(!G.inRange(m,{c:1,r:3},{c:8,r:3},40),"inRange rejects insufficient 3D range");

console.log("\n"+pass+" line-of-sight and cover checks green");
