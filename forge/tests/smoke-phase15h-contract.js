#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const geo=fs.readFileSync(path.join(root,"tactics-geometry.js"),"utf8");
const disc=fs.readFileSync(path.join(root,"forge-discovery.js"),"utf8");
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function has(t,n,l){ok(t.includes(n),l);}
has(geo,"var BODY_LEVELS = [0.75, 2.75, 4.75]","geometry uses lower, torso, and head bands");
has(geo,"else if(graded<6)","less than half-body target cover grades as none");
has(geo,"else if(graded<9)","six to eight samples grade as half cover");
has(geo,"coverShapeAt","geometry supports sub-cell cover footprints");
has(geo,"creatureBlocker","intervening creatures participate in attack cover");
has(geo,"targetFacingCornerEyes","attacker can use legal target-facing firing corners");
has(geo,"coverAudit","staff cover-density instrumentation is headless");
has(html,"const PROP_COVER_SHAPE","production map assigns prop footprints");
has(html,"m.coverShape=new Array(n).fill(null)","combat map carries footprint descriptors");
has(html,"syncGeometryCreatures(m)","combat map carries live creature silhouettes");
has(html,"function registerDiscoveryInstanced","terrain visibility is per instance");
ok(html.indexOf("var DISCOVERY_RENDER={") < html.indexOf("resize(); rebuild();"),"discovery render registry exists before initial terrain build");
ok(html.indexOf('var SESSION_ID = new URLSearchParams(location.search).get("session");') < html.indexOf("resize(); rebuild();"),"session identity exists before initial rebuild");
ok(!html.includes("const SESSION_ID = qs.get('session');"),"session identity has no late lexical TDZ declaration");
has(html,"function buildFogVeil","unexplored masking is one continuous veil");
has(html,"depthTest:true,depthWrite:false","veil cannot z-fight with terrain tops");
has(html,"veil.position.y=-BASE+.02","unexplored mask sits at terrain ground level instead of forming an overhead slab");
has(html,"tagDiscoveryObject","props, decals, and lights obey discovery state");
has(html,"q.mode==='visible-only'?detailed:st!==0","props, decals, and lights require current visibility while terrain memory may remain");
has(html,"id=\"sceneCoverAudit\"","staff can run cover calibration from Forge menu");
has(html,"window.addForgeRow(html,{channel:'system'})","cover audit reports to System feed");
ok(!html.includes("obj.scale.set(1.025,height,1.025)"),"overlapping fog volumes are absent");
has(disc,"geometry.losVerdict(map,origin,target,{ignoreCreatures:true})","terrain discovery ignores transient creature screens");
ok(disc.includes('var VERSION="1.2.0"'),"discovery renderer contract version is bumped");
/* Phase 2 must not regress the h.1 boot fix while changing session load. */
has(html,"let SESSION_MAP_AUTHORITY=null","saved sessions have an explicit exact-map authority");
has(html,"fieldFromSessionSnapshot(row.map)","session boot has a snapshot-first read path");
has(html,"renderField:renderFieldSnapshot(F)","new sessions retain faithful render metadata");
has(html,"var saved=gf.restoreMap(SESSION_MAP_AUTHORITY)","combat geometry consumes the saved map rather than regenerated art state");
console.log("\n"+pass+" Phase 1.5h + snapshot-authority contract checks green");
