#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm"),os=require("os");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const TG=require(path.join(root,"tactics-geometry.js"));
const engineSource=fs.readFileSync(path.join(root,"forge-engine.js"),"utf8");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const verticalSpec=fs.readFileSync(path.join(root,"FORGE_VERTICAL_GEOMETRY_1.md"),"utf8");
const patcher=require(path.join(root,"patch-phase2e-geometry-sync.js"));
let pass=0;
function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}
function throws(fn,part,l){let e=null;try{fn();}catch(x){e=x;}ok(e&&String(e.message||e).includes(part),l);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}

ok(GF.GENERATOR_VERSION==="2.0.0-elevations.1","generator version marks bounded elevations and connectors");
ok(GF.PARAMETER_VERSION===2&&GF.SUPPORTED_PARAMETER_VERSIONS.join(",")==="1,2","connector slice does not invent an unnecessary parameter version");
ok(GF.CONNECTOR_KINDS.includes("stairs")&&GF.CONNECTOR_KINDS.includes("ramp"),"foundation recognizes first-class stairs and ramps");

const connector={id:"stair-a",kind:"stairs",from:{c:0,r:0,elevationFt:5},to:{c:1,r:0,elevationFt:15},path:[{c:0,r:0,elevationFt:5},{c:1,r:0,elevationFt:15}],widthFt:5,requires:{},state:"open"};
const ledge={id:"ledge-a",a:{c:0,r:0,elevationFt:5},b:{c:1,r:0,elevationFt:15},high:{c:1,r:0,elevationFt:15},low:{c:0,r:0,elevationFt:5},dropFt:10,connectorId:"stair-a",source:"height"};
const sourceMap={cols:2,rows:1,h:[5,15],wall:[false,false],occ:[0,0],coverShape:[null,null],connectors:[connector],ledges:[ledge],spawns:[{c:0,r:0,side:"pc"},{c:1,r:0,side:"foe"}],props:[],meta:{vertical:{version:1}}};
const snap=GF.snapshotMap(sourceMap),fp=GF.fingerprintSnapshot(snap),restored=GF.restoreMap(snap,fp);
ok(restored.connectors.length===1&&restored.ledges.length===1,"snapshots preserve connectors and ledges");
ok(restored.connectors[0].from.elevationFt===5&&restored.ledges[0].connectorId==="stair-a","snapshot records preserve endpoint elevations and ledge linkage");
restored.connectors[0].state="closed";ok(GF.restoreMap(snap,fp).connectors[0].state==="open","connector restores are mutation-isolated");
throws(()=>GF.snapshotMap({...sourceMap,connectors:[{...connector,kind:"teleporter"}]}),"unknown kind","unknown connector kinds stop loudly");
throws(()=>GF.snapshotMap({...sourceMap,ledges:[{...ledge,connectorId:"missing"}]}),"unknown connector","ledges cannot reference missing connectors");
throws(()=>GF.snapshotMap({...sourceMap,connectors:[{...connector,path:[connector.from]}]}),"at least two points","connector paths require a real traversal");

const token={c:0,r:0,speed:30};
const steep={cols:2,rows:1,h:[5,15],wall:[false,false],connectors:[]};
ok(!TG.stepAllowed(steep,token,0,0,1,0),"a 10-ft edge is not an ordinary step");
steep.connectors=[connector];
ok(TG.stepAllowed(steep,token,0,0,1,0),"an open stair authorizes the same 10-ft edge");
ok(TG.movementReach(steep,token,new Set(),1)["1,0"].d===1,"movement reach consumes first-class connector traversal");
steep.connectors[0].state="closed";ok(!TG.stepAllowed(steep,token,0,0,1,0),"a closed connector stops authorizing movement");
ok(TG.stepAllowed(steep,{...token,climb:true},0,0,1,0),"climb/fly capability still handles unconnected cliffs");

const CELL={VOID:0,FLOOR:1,WALL:2,POOL:3};
const TYPE={ENTRANCE:"entrance",COMBAT:"combat",ELITE:"elite",TREASURE:"treasure",SHRINE:"shrine",BOSS:"boss"};
let calls=[];
function makeDungeon(opts){
  const W=40,H=30,N=8,rooms=[];
  for(let i=0;i<N;i++)rooms.push({id:i,cx:2+i*5,cy:15,w:5,h:5,shape:"rect",degree:0,type:"combat",depth:0,difficulty:0});
  const edges=[];for(let i=0;i<N-1;i++)edges.push({a:i,b:i+1,isLoop:false,isCritical:false});edges.push({a:1,b:5,isLoop:true,isCritical:false});
  edges.forEach(e=>{rooms[e.a].degree++;rooms[e.b].degree++;});
  const grid=new Uint8Array(W*H).fill(CELL.FLOOR),roomId=new Int16Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)roomId[y*W+x]=Math.min(N-1,Math.floor(x/(W/N)));
  return {valid:true,params:{themeKey:opts.themeKey},seed:opts.seed,name:"Vertical Stub",W,H,grid,roomId,corridor:new Uint8Array(W*H),doorway:new Uint8Array(W*H),rooms,edges,props:[],torches:[],spawns:[],stats:{}};
}
const FD={THEME_KEYS:["grass"],THEMES:{grass:{}},TYPE,CELL,generateDungeon(opts){calls.push({...opts});return makeDungeon(opts);}};
const MB={CELL,dungeonToMap(d,opts){const n=d.W*d.H;return {cols:d.W,rows:d.H,h:new Float32Array(n),wall:new Array(n).fill(false),occ:new Float32Array(n),coverShape:new Array(n).fill(null),props:[],spawns:[],meta:{poolBlocks:!!opts.poolBlocks}};},validate(m){return {ok:!!m&&m.h.length===m.cols*m.rows&&m.wall.length===m.cols*m.rows};}};
const sandbox={module:{exports:{}},exports:{},require(id){if(id==="./forge-dungeon.js")return FD;if(id==="./map-bridge.js")return MB;if(id==="./forge-generator-foundation.js")return GF;throw new Error(id);},console,Math,Set,Float32Array,Int32Array,Uint8Array,Number,Object,Array,Error,JSON};
vm.runInNewContext(engineSource,sandbox,{filename:"forge-engine.js"});
const Engine=sandbox.module.exports;
function build(heightSeed){return Engine.generateDetailed(GF.parameterRecord({seed:7,theme:"grass",stageSeeds:{layout:11,height:heightSeed,semantics:33,decor:44,foes:55},sliders:{roomCount:8,party:2,foes:3,retries:3}}));}
const built=build(5),map=built.map;
ok(Math.min(...map.h)>=5&&Math.max(...map.h)<=15,"generated land is bounded to truthful 5–15 ft elevations");
ok(map.h.every(v=>v%5===0),"generated floor elevations remain D&D-readable 5-ft tiers");
ok(map.connectors.length>=2&&map.connectors.some(c=>c.kind==="stairs")&&map.connectors.some(c=>c.kind==="ramp"),"height stage emits both stairs and ramps as first-class records");
ok(map.ledges.length>0&&map.ledges.every(l=>l.dropFt===10),"steep 10-ft boundaries are explicit ledges");
ok(map.meta.vertical&&map.meta.vertical.maxElevationFt===15,"map metadata narrates the vertical contract");
ok(Engine._internals.validateVerticalRecords(map),"engine validates connector endpoints, rises, ledges, and bounded heights");
ok(Engine._internals.wallSupportHeight({cols:3,rows:1,wall:[false,true,false]},[5,0,15],1)===15,"wall cells inherit the highest adjacent supporting floor instead of sinking to world zero");
const reach=Engine._internals.bfsReach(map,map.spawns.find(s=>s.side==="pc"));
ok(map.spawns.every(s=>reach.has(s.c+","+s.r)),"ordinary-creature connectivity uses generated connectors");
let worst=0;for(let r=0;r<map.rows;r++)for(let c=0;c<map.cols;c++){const i=r*map.cols+c;if(map.wall[i])continue;for(const [dx,dy] of [[1,0],[0,1]]){const nc=c+dx,nr=r+dy;if(nc>=map.cols||nr>=map.rows)continue;const j=nr*map.cols+nc;if(!map.wall[j])worst=Math.max(worst,Math.abs(map.h[i]-map.h[j]));}}
ok(worst<=10,"no adjacent walk surfaces exceed one connector's 10-ft maximum rise");
const builtOther=build(6);
ok(builtOther.stageFingerprints.layout===built.stageFingerprints.layout&&builtOther.stageFingerprints.semantics===built.stageFingerprints.semantics&&builtOther.stageFingerprints.decor===built.stageFingerprints.decor&&builtOther.stageFingerprints.foes===built.stageFingerprints.foes,"height seed changes vertical records without perturbing other stages");
ok(builtOther.stageFingerprints.height!==built.stageFingerprints.height,"height fingerprint includes elevations, connectors, and ledges");
ok(calls.every(c=>c.decorDensity===1),"layout still produces a dense candidate pool before later stages");

const inline=patcher.inlineGeometry(html).source,canonical=fs.readFileSync(path.join(root,"tactics-geometry.js"),"utf8").replace(/\r\n/g,"\n").replace(/\s+$/,"\n");
ok(inline===canonical,"production inline geometry is byte-identical to canonical connector-aware geometry");
ok(html.includes("renderVerticalConnectors()")&&html.includes("renderRampConnector")&&html.includes("renderStairConnector"),"renderer builds truthful stair and ramp meshes from connector records");
ok(html.includes('id="sceneVerticalOverlay"')&&html.includes("drawVerticalOverlay"),"staff can inspect connector and ledge edges");
ok(html.includes("connectors:(stageMap.connectors||[])")&&html.includes("m.connectors=(F.connectors||[])"),"preview, session snapshot, and combat map carry connector authority end to end");
ok(!html.includes("height[i]<=0 && type[i]!==T_ROCK) type[i]=T_WATER"),"floor elevation no longer silently rewrites terrain into water");
ok(html.includes("forge-generator-foundation.js?v=g2e1")&&html.includes("forge-engine.js?v=fe5"),"Phase 2e runtime modules are cache-busted");
const firstRebuild=html.indexOf("resize(); rebuild();");
ok(html.indexOf("var DISCOVERY_RENDER={")<firstRebuild&&html.indexOf("var SESSION_ID=new URLSearchParams")<firstRebuild,"both known startup-order guards remain ahead of initial rebuild");

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"forge-phase2e-")),forgeDir=path.join(tmp,"forge");fs.mkdirSync(forgeDir);
const oldGeo=fs.readFileSync(path.join(root,"tests","fixtures","tactics-geometry-phase15h.js"),"utf8");
const topOld=html.replace(inline.trimEnd(),oldGeo.trimEnd());
fs.writeFileSync(path.join(forgeDir,"tactics-geometry.js"),canonical);
fs.writeFileSync(path.join(forgeDir,"topography-test-mock.html"),topOld);
fs.writeFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"<script>"+oldGeo+"</script>");
const patched=patcher.patchFiles({forgeDir});
ok(patched.changed.length===2,"guarded patcher updates both known old inline copies");
ok(patcher.inlineGeometry(fs.readFileSync(path.join(forgeDir,"topography-test-mock.html"),"utf8")).source===canonical,"patcher synchronizes production geometry exactly");
ok(patcher.inlineGeometry(fs.readFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"utf8")).source===canonical,"patcher synchronizes reference battle geometry exactly");
fs.writeFileSync(path.join(forgeDir,"battle-tactics-geo-mock.html"),"<script>"+oldGeo.replace("var STEP_FT   = 5","var STEP_FT   = 6")+"</script>");
throws(()=>patcher.patchFiles({forgeDir}),"unknown geometry copy","patcher aborts rather than overwrite an unknown reference copy");

ok(verticalSpec.includes("5-ft movement grid")&&verticalSpec.includes("10-ft"),"vertical contract freezes the gameplay grid and connector rise bound");
ok(verticalSpec.includes("stairs")&&verticalSpec.includes("ramps")&&verticalSpec.includes("ledges"),"vertical contract names all Phase 2e structures");
console.log("\n"+pass+" Phase 2e elevation/connector checks green");
