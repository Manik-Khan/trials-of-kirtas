#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const engineSource=fs.readFileSync(path.join(root,"forge-engine.js"),"utf8");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function throws(fn,part,l){let e=null;try{fn();}catch(x){e=x;}ok(e&&String(e.message||e).includes(part),l);}

const sourceMap={cols:2,rows:2,h:new Float32Array([0,5,10,15]),wall:[false,false,true,false],occ:[0,4.5,7,Infinity],
  coverShape:[null,{kind:"circle",radius:.2,source:"tree"},{kind:"full",source:"wall"},null],
  spawns:[{x:0,y:0,side:"pc"},{c:1,r:1,side:"foe"}],props:[{kind:"tree",x:1,y:0,scale:1}],
  meta:{name:"Snapshot test",renderField:{version:1,type:[1,1,4,1],foot:[1,1,1,1],baseOcc:[0,0,7,0]},mapSnapshot:{must:"strip"}}};
const snap=GF.snapshotMap(sourceMap);
ok(snap.h instanceof Array&&snap.h[2]===10,"typed map arrays snapshot to plain JSON arrays");
ok(snap.occ[3]==="Infinity","opaque Infinity occlusion is encoded without JSON data loss");
ok(snap.coverShape[1].source==="tree"&&snap.coverShape[2].source==="wall","rules-relevant sub-cell cover survives the snapshot");
ok(!Object.prototype.hasOwnProperty.call(snap.meta,"mapSnapshot"),"recursive mapSnapshot metadata is stripped");
ok(snap.spawns[0].c===0&&snap.spawns[0].r===0,"legacy x/y spawns normalize to c/r");
const fp=GF.fingerprintSnapshot(snap),restored=GF.restoreMap(snap,fp);
ok(restored.occ[3]===Infinity&&GF.fingerprintSnapshot(GF.snapshotMap(restored))===fp,"restore verifies and reproduces the canonical snapshot");
restored.h[0]=999;restored.coverShape[1].radius=.49;
const restoredAgain=GF.restoreMap(snap,fp);
ok(restoredAgain.h[0]===0&&restoredAgain.coverShape[1].radius===.2,"each restore is mutation-isolated");
throws(()=>GF.restoreMap(snap,"deadbeef"),"fingerprint mismatch","fingerprint mismatch stops loudly");
throws(()=>GF.snapshotMap({cols:2,rows:2,h:[0],wall:[0,0,0,0]}),"h cell array length","malformed cell lengths are refused");
throws(()=>GF.snapshotMap({cols:2.5,rows:2,h:[],wall:[]}),"positive integer","fractional dimensions are refused");
throws(()=>GF.snapshotMap({...sourceMap,spawns:[{c:9,r:9}]}),"outside","out-of-bounds spawns are refused");
let legacyCalls=0;
throws(()=>GF.resolveEncounter({mapSnapshot:null,seed:7},()=>{legacyCalls++;return sourceMap;}),"missing or malformed","present-but-invalid snapshot never falls back");
ok(legacyCalls===0,"invalid snapshot does not call the legacy generator");
const legacy=GF.resolveEncounter({seed:7,theme:"grass",sliders:{party:1}},p=>{legacyCalls++;return {p};});
ok(legacy.source==="legacy-recipe"&&legacy.map.p.themeKey==="grass"&&legacy.map.p.party===1,"missing snapshot uses the legacy recipe exactly once");

/* Exercise the uploaded engine in a VM with tiny deterministic dependencies. */
let dungeonCalls=0;
const FD={THEME_KEYS:["grass"],generateDungeon(opts){dungeonCalls++;return {valid:true,seed:opts.seed,name:"Stub",W:3,H:1,maxDepth:1,
  grid:[1,1,1],roomId:[0,-1,1],rooms:[{id:0,type:"entrance",cx:0,cy:0,depth:0},{id:1,type:"boss",cx:2,cy:0,depth:1}],
  spawns:[{x:2,y:0,roomId:1,tier:0}],boss:1,props:[]};}};
const MB={CELL:{FLOOR:1,POOL:2,WALL:3,VOID:0},dungeonToMap(){return {cols:3,rows:1,h:[0,0,0],wall:[false,false,false],occ:[0,0,0],props:[],spawns:[],meta:{}};},
  validate(map){const n=map.cols*map.rows;return {ok:!!map&&map.h.length===n&&map.wall.length===n&&map.occ.length===n};}};
const sandbox={module:{exports:{}},exports:{},require(id){if(id==="./forge-dungeon.js")return FD;if(id==="./map-bridge.js")return MB;if(id==="./forge-generator-foundation.js")return GF;throw new Error(id);},
  console,Math,Set,Float32Array,Number,Object,Array,Error};
vm.runInNewContext(engineSource,sandbox,{filename:"forge-engine.js"});
const Engine=sandbox.module.exports;
const env=GF.encounterEnvelope(sourceMap,{seed:11,theme:"grass",sliders:{party:1,foes:1}},null);
const before=dungeonCalls,loaded=Engine.loadEncounter(env);
ok(dungeonCalls===before&&loaded.coverShape[1].source==="tree","engine loads a saved snapshot without regenerating the dungeon");
loaded.occ[1]=999;ok(Engine.loadEncounter(env).occ[1]===4.5,"engine returns an isolated runtime map on each load");
const legacyMap=Engine.loadEncounter({seed:11,theme:"grass",sliders:{party:1,foes:1,retries:1,heightMode:"flat"}});
ok(dungeonCalls===before+1&&legacyMap.meta.source==="forge-engine","engine regenerates only a genuinely legacy recipe");
throws(()=>Engine.loadEncounter({...env,mapFingerprint:"00000000"}),"fingerprint mismatch","engine propagates snapshot corruption instead of falling back");

ok(html.includes("let SESSION_MAP_AUTHORITY=null"),"production renderer holds an explicit saved-map authority");
ok(html.includes("fieldFromSessionSnapshot(row.map)"),"session boot selects the snapshot read path");
ok(html.includes("Object.prototype.hasOwnProperty.call(row.map,'mapSnapshot')"),"snapshot presence, not truthiness, chooses authority");
ok(html.includes("renderField:renderFieldSnapshot(F)"),"new sessions retain the render-only data needed for faithful repainting");
ok(html.includes("var saved=gf.restoreMap(SESSION_MAP_AUTHORITY)"),"combat geometry clones the authoritative snapshot instead of rebuilding it from art data");
ok(html.includes("forge-generator-foundation.js?v=g2s1")&&html.includes("forge-engine.js?v=fe4"),"changed runtime modules are cache-busted");
console.log("\n"+pass+" snapshot-authority checks green");
