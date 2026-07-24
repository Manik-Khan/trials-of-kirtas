#!/usr/bin/env node
"use strict";
const G=require("../tactics-geometry.js");
let pass=0;
function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
function map(cols=9,rows=5){const m=G.makeMap(cols,rows);m.occ=new Array(cols*rows).fill(0);m.coverShape=new Array(cols*rows).fill(null);return m;}
function shot(m,a={c:1,r:2},b={c:7,r:2}){return G.losVerdict(m,a,b);}
function put(m,c,r,h,shape){m.occ[r*m.cols+c]=h;m.coverShape[r*m.cols+c]=shape||{kind:"full",source:"wall"};}

ok(G.BODY_SAMPLES===12,"cover samples four corners across three body bands");
let m=map();ok(shot(m).cover==="none","open ground has no cover");
m=map();put(m,6,2,2.5);let v=shot(m);ok(v.cover==="none"&&v.graded===4,"shin-high lip blocks lower band without granting half cover");
m=map();put(m,6,2,3);v=shot(m);ok(v.cover==="half"&&v.graded===6,"waist-height obstruction grants half cover");
m=map();put(m,6,2,4.5);v=shot(m);ok(v.cover==="half"&&v.graded===8,"high barricade remains half until three quarters of body is hidden");
m=map();put(m,6,2,4.9);v=shot(m);ok(v.cover==="three-quarters"||v.cover==="total","near-full body obstruction is heavy cover");
m=map();put(m,6,2,5);ok(shot(m).cover==="total","five-foot solid beside equal-height target gives total cover");

m=map();put(m,6,2,5,{kind:"circle",radius:.18,source:"tree"});v=shot(m);ok(v.cover==="none","narrow trunk no longer fills the entire five-foot cell");
m=map();put(m,6,2,15,{kind:"circle",radius:.40,source:"pillar"});v=shot(m);ok(v.cover!=="none","a visually aligned full-height pillar grants cover");
m=map();put(m,6,2,4.5,{kind:"circle",radius:.40,source:"boulder"});v=shot(m);ok(v.cover!=="total","boulder footprint does not become a full-cell wall");

m=map();m.creatures=[{id:"screen",c:6,r:2,heightFt:5,radius:.35,alive:true}];v=shot(m);ok(v.cover==="half"&&v.culprits.creature,"intervening Medium creature can provide half cover");
v=G.losVerdict(m,{c:1,r:2},{c:7,r:2},{ignoreCreatures:true});ok(v.cover==="none","discovery can ignore transient creature cover");

// Ledge firing: immediately adjacent target-facing low parapet can be leaned over.
m=map(8,3);m.h[1*8+1]=20;m.h[1*8+2]=15;m.wall[1*8+2]=true;m.occ[1*8+2]=7;m.coverShape[1*8+2]={kind:"full",source:"wall"};m.h[1*8+5]=0;
v=G.losVerdict(m,{c:1,r:1},{c:5,r:1});ok(v.canTarget&&v.eye&&v.eye.stepOut,"legal parapet lean survives body-cover calibration");
// Steep close downward line still hits the terrain berm beneath the ignored cap.
m=map(6,3);m.h[1*6+1]=20;m.h[1*6+2]=15;m.wall[1*6+2]=true;m.occ[1*6+2]=7;m.coverShape[1*6+2]={kind:"full",source:"wall"};
v=G.losVerdict(m,{c:1,r:1},{c:3,r:1});ok(!v.canTarget,"steep close shot still hits the parapet terrain berm");

m=map();put(m,6,2,3);const audit=G.coverAudit(m,[{a:{c:1,r:2},b:{c:7,r:2}},{a:{c:1,r:1},b:{c:7,r:1}}]);
ok(audit.total===2&&audit.counts.half===1&&audit.counts.none===1,"cover audit summarizes sampled verdicts");
ok(audit.culprits.wall>0,"cover audit reports culprit categories");
console.log("\n"+pass+" cover-calibration checks green");
