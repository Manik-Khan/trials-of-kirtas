#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const engineSource=fs.readFileSync(path.join(root,"forge-engine.js"),"utf8");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const spec=fs.readFileSync(path.join(root,"FORGE_STAGE_OWNERSHIP_1.md"),"utf8");
let pass=0;
function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function throws(fn,part,l){let e=null;try{fn();}catch(x){e=x;}ok(e&&String(e.message||e).includes(part),l);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

ok(GF.GENERATOR_VERSION==="2.0.0-stages.1","generator version marks true stage ownership");
ok(GF.PARAMETER_VERSION===2&&GF.SUPPORTED_PARAMETER_VERSIONS.join(",")==="1,2","parameter v2 is canonical while v1 remains readable");
ok(GF.GENERATOR_PROFILES.STAGED==="stage-owned-legacy"&&GF.GENERATOR_PROFILES.LEGACY==="legacy-dungeon","generator profiles distinguish staged and monolithic recipes");
ok(GF.stageAttemptSeed(44,"layout",0)!==GF.stageAttemptSeed(44,"layout",1),"stage retries advance only their named stream");
ok(GF.stageAttemptSeed(44,"layout",0)!==GF.stageAttemptSeed(44,"foes",0),"attempt seeds are namespaced by stage");
throws(()=>GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:3}),"unsupported parameter record version","unknown future parameter versions still stop loudly");

const fresh=GF.parameterRecord({seed:10,theme:"grass",archetype:"canyon",sliders:{roomCount:8,party:2,foes:3}});
ok(fresh.version===2&&fresh.generatorProfile==="stage-owned-legacy","new authoring inputs opt into the staged profile");
const v1=GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:1,seed:10,theme:"grass",archetype:"canyon",stageSeeds:GF.stageSeeds(10),stages:fresh.stages,rules:fresh.rules,runtime:fresh.runtime});
ok(v1.version===2&&v1.generatorProfile==="legacy-dungeon","version-1 recipes migrate canonically but preserve monolithic regeneration");
const v1Explicit=GF.parameterRecord({schema:GF.PARAMETER_SCHEMA,version:1,generatorProfile:"stage-owned-legacy",seed:10,stages:fresh.stages});
ok(v1Explicit.generatorProfile==="stage-owned-legacy","an explicit profile is never overwritten during migration");
ok(GF.recipeParams({parameters:fresh}).generatorProfile==="stage-owned-legacy","recipe projection carries the generator profile into the engine");

const TYPE={ENTRANCE:"entrance",COMBAT:"combat",ELITE:"elite",TREASURE:"treasure",SHRINE:"shrine",BOSS:"boss"};
const CELL={VOID:0,FLOOR:1,WALL:2,POOL:3};
let calls=[];
function makeDungeon(opts){
  const W=12,H=8,N=8,rooms=[];
  const coords=[[1,1],[3,1],[5,1],[8,1],[3,4],[1,6],[6,4],[9,6]];
  for(let i=0;i<N;i++)rooms.push({id:i,cx:coords[i][0]+((opts.seed>>>0)%5===i%5?0.25:0),cy:coords[i][1],w:i===3?7:5,h:i===3?7:5,shape:i%2?"ellipse":"rect",degree:0,type:"combat",depth:0,difficulty:0});
  const pairs=[[0,1],[1,2],[2,3],[1,4],[4,5],[2,6],[6,7],[4,6]];
  const edges=pairs.map((e,i)=>({a:e[0],b:e[1],isLoop:i===7,isCritical:false}));
  edges.forEach(e=>{rooms[e.a].degree++;rooms[e.b].degree++;});
  const grid=new Uint8Array(W*H).fill(CELL.FLOOR),roomId=new Int16Array(W*H).fill(-1);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)roomId[y*W+x]=Math.min(7,Math.floor(x/1.5));
  const props=[];for(let i=0;i<36;i++)props.push({kind:i%7===0?"pillar":(i%5===0?"moss":"rock"),x:i%W,y:(i*3)%H,rot:i/10,scale:0.8+(i%4)*0.1,roomId:i%N});
  const torches=[];for(let i=0;i<12;i++)torches.push({x:(i*2)%W,y:(i*5)%H,roomId:i%N});
  return {valid:true,params:{themeKey:opts.themeKey},seed:opts.seed,name:"Stub "+opts.seed,W,H,grid,roomId,corridor:new Uint8Array(W*H),doorway:new Uint8Array(W*H),rooms,edges,
    entrance:0,boss:3,maxDepth:4,props,torches,spawns:[],stats:{critLen:0}};
}
const FD={THEME_KEYS:["grass","temple"],THEMES:{grass:{},temple:{}},TYPE,CELL,generateDungeon(opts){calls.push({...opts});return makeDungeon(opts);}};
const MB={CELL,dungeonToMap(d){const n=d.W*d.H;return {cols:d.W,rows:d.H,h:new Float32Array(n),wall:new Array(n).fill(false),occ:new Float32Array(n),coverShape:new Array(n).fill(null),props:(d.props||[]).map(p=>({...p})),spawns:[],meta:{}};},
  validate(m){return {ok:!!m&&m.cols>0&&m.rows>0&&m.h.length===m.cols*m.rows&&m.wall.length===m.cols*m.rows};}};
const sandbox={module:{exports:{}},exports:{},require(id){if(id==="./forge-dungeon.js")return FD;if(id==="./map-bridge.js")return MB;if(id==="./forge-generator-foundation.js")return GF;throw new Error(id);},
  console,Math,Set,Float32Array,Int32Array,Uint8Array,Number,Object,Array,Error,JSON};
vm.runInNewContext(engineSource,sandbox,{filename:"forge-engine.js"});
const Engine=sandbox.module.exports;
function make(overrides){
  const base={seed:777,theme:"grass",archetype:"legacy-dungeon",stageSeeds:{layout:101,height:202,semantics:303,decor:404,foes:505},sliders:{roomCount:8,loopChance:.25,decorDensity:.55,heightMode:"tiered",verticality:5,party:2,foes:3,retries:4}};
  base.stageSeeds=Object.assign(base.stageSeeds,overrides||{});
  return Engine.generateDetailed(GF.parameterRecord(base));
}
const a=make();
ok(a.parameters.generatorProfile==="stage-owned-legacy","engine uses staged profile for new records");
ok(a.map.meta.stageOwnership&&a.map.meta.stageOwnership.version===1,"map metadata exposes the stage-ownership ledger");
ok(same(a.map.meta.stageOwnership.fingerprints,a.stageFingerprints),"returned diagnostics and saved metadata share one fingerprint record");
ok(Object.keys(a.stageFingerprints).sort().join(",")==="decor,foes,height,layout,semantics","all five stages publish independent fingerprints");
ok(a.map.spawns.filter(s=>s.side==="pc").length===2&&a.map.spawns.filter(s=>s.side==="foe").length===3,"foes stage owns requested party and foe placement counts");
const canyon=Engine.generateDetailed(GF.parameterRecord({seed:777,theme:"grass",archetype:"canyon",stageSeeds:{layout:101,height:202,semantics:303,decor:404,foes:505},sliders:{roomCount:8,loopChance:.25,decorDensity:.55,heightMode:"tiered",verticality:5,party:2,foes:3,retries:4}}));
ok(canyon.parameters.archetype==="canyon"&&same(canyon.stageFingerprints,a.stageFingerprints),"record-only archetypes preserve intent without secretly changing the legacy layout grammar");

function findDifferent(stage,start){
  for(let s=start;s<start+200;s++){const b=make({[stage]:s});if(b.stageFingerprints[stage]!==a.stageFingerprints[stage])return b;}
  throw new Error("no differing "+stage+" seed found");
}
const heightB=findDifferent("height",800);
ok(heightB.stageFingerprints.layout===a.stageFingerprints.layout&&heightB.stageFingerprints.semantics===a.stageFingerprints.semantics&&heightB.stageFingerprints.decor===a.stageFingerprints.decor&&heightB.stageFingerprints.foes===a.stageFingerprints.foes,"height seed changes height without rewriting other stage fingerprints");
const decorB=findDifferent("decor",1000);
ok(decorB.stageFingerprints.layout===a.stageFingerprints.layout&&decorB.stageFingerprints.height===a.stageFingerprints.height&&decorB.stageFingerprints.semantics===a.stageFingerprints.semantics&&decorB.stageFingerprints.foes===a.stageFingerprints.foes,"decor seed changes decor without rewriting layout, height, semantics, or foes");
const foesB=findDifferent("foes",1200);
ok(foesB.stageFingerprints.layout===a.stageFingerprints.layout&&foesB.stageFingerprints.height===a.stageFingerprints.height&&foesB.stageFingerprints.semantics===a.stageFingerprints.semantics&&foesB.stageFingerprints.decor===a.stageFingerprints.decor,"foes seed changes only spawn placement");
const semanticsB=findDifferent("semantics",1400);
ok(semanticsB.stageFingerprints.layout===a.stageFingerprints.layout&&semanticsB.stageFingerprints.height===a.stageFingerprints.height&&semanticsB.stageFingerprints.foes===a.stageFingerprints.foes,"semantics seed cannot rewrite layout, heights, or spawn placement");
const layoutB=findDifferent("layout",1600);
ok(layoutB.stageFingerprints.layout!==a.stageFingerprints.layout,"layout seed owns the generated topology");

ok(calls.every(c=>c.decorDensity===1),"layout produces a dense candidate pool before decor owns selection");
ok(calls[0].seed===GF.stageAttemptSeed(101,"layout",0),"forge-dungeon receives the layout attempt seed rather than the root seed");
const replay=make();
ok(same(replay.stageFingerprints,a.stageFingerprints)&&same(replay.map.spawns,a.map.spawns),"identical records replay every stage exactly");

const oldRecord={schema:GF.PARAMETER_SCHEMA,version:1,seed:99,theme:"grass",archetype:"legacy-dungeon",stageSeeds:GF.stageSeeds(99),stages:fresh.stages,rules:fresh.rules,runtime:{retries:2}};
const oldBuilt=Engine.generateDetailed(oldRecord);
ok(oldBuilt.parameters.generatorProfile==="legacy-dungeon"&&!oldBuilt.map.meta.stageOwnership,"version-1 snapshot-less recipes retain the old monolithic generator");

ok(spec.includes("layout → height → semantics → decor → foes"),"stage contract freezes pipeline order");
ok(engineSource.indexOf("var heights = heightField")<engineSource.indexOf("applySemantics(d, seeds.semantics, facts)"),"engine executes height before semantic labeling as the contract specifies");
ok(spec.includes("Version-1 parameter records")&&spec.includes("legacy-dungeon"),"stage contract records legacy-recipe compatibility");
ok(spec.includes("Changing `height` cannot change layout, semantics, decor, or foes"),"stage contract states cross-stage isolation explicitly");
ok(html.includes("ForgeEngine.generateDetailed")&&html.includes("const decorSeed=record.stageSeeds"),"production preview consumes the canonical staged pipeline and decor stream");
ok(html.includes("F=buildTiersField(fp.seed, fp)"),"authoring rebuild passes the complete parameter record instead of flattening away stage seeds");
ok(html.includes("stageOwnership:F.stageOwnership||null"),"session snapshots retain the stage-ownership diagnostic ledger");
ok(html.includes("forge-generator-foundation.js?v=g2s1")&&html.includes("forge-engine.js?v=fe4"),"stage-owned runtimes are cache-busted");
const firstRebuild=html.indexOf("resize(); rebuild();");
ok(html.indexOf("var DISCOVERY_RENDER={")<firstRebuild&&html.indexOf("var SESSION_ID=new URLSearchParams")<firstRebuild,"both known startup-order guards remain ahead of the initial rebuild");

const scripts=[...html.matchAll(/<script(?:\s+type="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)].filter(m=>!m[0].includes('type="importmap"')&&m[2].trim());
ok(scripts.length===3,"production HTML still has three executable inline scripts");
scripts.forEach((m,i)=>{let code=m[2];if(m[1]==='module')code=code.replace(/^import .*;$/mg,'');new vm.Script(code,{filename:'inline-'+i+'.js'});});
ok(true,"all executable inline scripts parse after stage-pipeline integration");
console.log("\n"+pass+" Phase 2d stage-ownership checks green");
