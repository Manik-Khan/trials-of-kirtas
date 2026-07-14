#!/usr/bin/env node
"use strict";
const D=require("../forge-discovery.js");
let pass=0;
function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
function map(cols=5,rows=5){return {cols,rows,h:new Array(cols*rows).fill(0),wall:new Array(cols*rows).fill(false),occ:new Array(cols*rows).fill(0)};}
const openGeo={
  range3d:(m,a,b)=>Math.hypot(Math.max(Math.abs(a.c-b.c),Math.abs(a.r-b.r))*5,0),
  losVerdict:()=>({canTarget:true,cover:"none",acBonus:0})
};
ok(D.VERSION==="1.1.0","module version is pinned");
ok(D.UNEXPLORED===0&&D.EXPLORED===1&&D.VISIBLE===2,"three discovery states are stable");
ok(D.dims({W:3,H:4}).cols===3&&D.dims({W:3,H:4}).rows===4,"legacy W/H map dimensions normalize");
ok(D.idx(map(),2,3)===17,"cell index is row-major");
ok(D.inBounds(map(),4,4)&&!D.inBounds(map(),5,4),"bounds helper rejects off-map cells");
ok(D.sightRadiusFt({visionFt:45})===45,"explicit vision feet win");
ok(D.sightRadiusFt({darkvision:"60 ft."})===60,"string darkvision is parsed");
ok(D.sightRadiusFt({statblock:{senses:{darkvision:"120 ft."}}})===120,"statblock darkvision is parsed");
ok(D.sightRadiusFt({},30)===30,"fallback sight radius is respected");
const shared={tag:"keep"};
const uniq=D.uniqueCells([{c:1,r:1,cost:2,meta:shared},{c:1,r:1,cost:9},{c:2,r:1,cost:3}]);
ok(uniq.length===2,"duplicate cells collapse");
ok(uniq[0].cost===2&&uniq[1].cost===3,"unique cells preserve caller metadata");
ok(uniq[0].meta===shared,"unique cells preserve opaque metadata references");
const vis=D.visibleFrom(map(),{c:2,r:2},openGeo,{radiusFt:5});
ok(vis.length===25,"visibility mask matches map size");
ok(vis[D.idx(map(),2,2)]===1,"origin cell is always visible");
ok(vis[D.idx(map(),3,2)]===1,"adjacent cell inside sight radius is visible");
ok(vis[D.idx(map(),4,2)]===0,"cell outside sight radius stays hidden");
let losCalls=0;
const blockGeo={range3d:openGeo.range3d,losVerdict:(m,a,b)=>{losCalls++;return {canTarget:!(b.c===4&&b.r===2)};}};
const blocked=D.visibleFrom(map(),{c:2,r:2},blockGeo,{radiusFt:15});
ok(blocked[D.idx(map(),4,2)]===0,"canonical LoS denial hides a candidate cell");
ok(losCalls>0,"visibility delegates to the supplied canonical LoS function");
const party=D.partyVisible(map(),[
  {unit:"a",side:"pc",alive:true,c:0,r:0,sightFt:5},
  {unit:"b",side:"pc",alive:true,c:4,r:4,sightFt:5},
  {unit:"dead",side:"pc",alive:false,c:2,r:2,sightFt:100},
  {unit:"foe",side:"foe",alive:true,c:2,r:2,sightFt:100}
],openGeo);
ok(party[D.idx(map(),0,0)]===1&&party[D.idx(map(),4,4)]===1,"living PC vision is unioned party-wide");
ok(party[D.idx(map(),2,2)]===0,"dead PCs and foes do not contribute party vision");
const prev=new Uint8Array([1,0,1,0]),now=new Uint8Array([0,1,0,0]);
const explored=D.mergeExplored(prev,now);
ok(Array.from(explored).join(",")==="1,1,1,0","explored memory accumulates visible cells");
const states=D.composeStates(explored,now);
ok(Array.from(states).join(",")==="1,2,1,0","visible-now overrides explored memory in three-state composition");
ok(D.cellState(states,{cols:2,rows:2},1,0)===D.VISIBLE,"cellState reads the composed mask");
ok(D.cellVisible(states,{cols:2,rows:2},1,0),"cellVisible recognizes visible-now only");
ok(!D.cellVisible(states,{cols:2,rows:2},0,0),"explored memory is not interactable visibility");
const roster=[
  {unit:"pc-a",kind:"pc",pos:{c:0,r:0}},
  {unit:"foe-a",kind:"foe",pos:{c:4,r:4}}
];
const events=[
  {kind:"move_declared",unit:"pc-a",payload:{path:[{c:1,r:0},{c:2,r:0}]}},
  {kind:"move_resolved",unit:"pc-a",payload:{final_cell:{c:2,r:0}}},
  {kind:"move_resolved",unit:"foe-a",payload:{path:[{c:3,r:4}],final_cell:{c:3,r:4}}},
  {kind:"edit",unit:"__session",payload:{changes:[{unit:"pc-a",pos:{c:2,r:1}},{add_unit:{unit:"pc-b",side:"pc",pos:{c:1,r:1},hp:5}}]}},
  {kind:"restore",unit:"__session",payload:{snapshot:{units:{"pc-a":{side:"pc",pos:{c:3,r:1}},"foe-a":{side:"foe",pos:{c:2,r:4}}}}}}
];
const hist=D.historySources(roster.concat([{unit:"monster-a",kind:"monster",pos:{c:4,r:0}}]),events.concat([{kind:"move_resolved",unit:"monster-a",payload:{final_cell:{c:3,r:0}}}]));
const hkeys=new Set(hist.map(x=>x.unit+"@"+x.c+","+x.r));
ok(hkeys.has("pc-a@0,0"),"history includes the roster start cell");
ok(hkeys.has("pc-a@1,0")&&hkeys.has("pc-a@2,0"),"history includes every declared movement step");
ok(hkeys.has("pc-a@2,1")&&hkeys.has("pc-a@3,1"),"history includes edits and restore positions");
ok(hkeys.has("pc-b@1,1"),"history includes a PC reinforcement spawn");
ok(!Array.from(hkeys).some(k=>k.startsWith("foe-a@")),"foe movement never contributes to party exploration");
ok(!Array.from(hkeys).some(k=>k.startsWith("monster-a@")),"monster-kind roster rows are normalized as foes, not PCs");
const c0=D.classifyReachResult({ok:true,cover:0,dis:false});
const c2=D.classifyReachResult({ok:true,cover:2,dis:true});
const c5=D.classifyReachResult({ok:true,coverName:"three-quarters"});
const cb=D.classifyReachResult({ok:false,why:"no line of sight"});
ok(c0.state==="clear"&&c0.cover===0,"clear direct shot classifies green");
ok(c2.state==="half"&&c2.cover===2&&c2.long,"half cover preserves long-range disadvantage");
ok(c5.state==="three-quarters"&&c5.cover===5,"three-quarters cover classifies orange");
ok(cb.state==="blocked"&&cb.reason==="no line of sight","failed direct shot classifies dark with a reason");
const origins=D.classifyOrigins([{c:0,r:0,cost:0},{c:1,r:0,cost:2},{c:2,r:0,cost:3}],o=>o.c===0?{ok:true,cover:0}:o.c===1?{ok:true,cover:5}:{ok:false,why:"out of range"});
ok(origins.cells[1].cost===2,"firing-origin movement cost survives classification");
ok(origins.summary.clear===1&&origins.summary["three-quarters"]===1&&origins.summary.blocked===1,"firing preview summary counts every class");
ok(D.stateColor("clear")===0x2da84f,"clear preview color is green");
ok(D.stateColor("half")===0xe0bf44,"half-cover preview color is yellow");
ok(D.stateColor("three-quarters")===0xd67a2f,"three-quarters preview color is orange");
ok(D.stateColor("blocked")===0x252a27,"blocked preview color is dark charcoal");
console.log("\n"+pass+" discovery checks green");
