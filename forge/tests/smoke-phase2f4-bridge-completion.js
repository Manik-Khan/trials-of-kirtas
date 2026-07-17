#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const TG=require(path.join(root,"tactics-geometry.js"));
const BA=require(path.join(root,"forge-bridge-authority.js"));
const FR=require(path.join(root,"forge-replay.js"));
let pass=0,fail=0;function ok(name,v){v?pass++:fail++;console.log((v?"✓ ":"✗ ")+name);}function eq(name,a,b){ok(name,JSON.stringify(a)===JSON.stringify(b));}
function loadEngine(){
  const FD={THEME_KEYS:["grass"],generateDungeon(){throw new Error("not used")}};
  const MB={CELL:{VOID:0,FLOOR:1,WALL:2,POOL:3},validate(){return{ok:true}},dungeonToMap(){throw new Error("not used")}};
  const context={self:{ForgeDungeon:FD,MapBridge:MB,ForgeGeneratorFoundation:GF},console,Set,Map,Math,JSON,Array,Float32Array,Uint8Array,Number,Object,String,Infinity};
  vm.runInNewContext(fs.readFileSync(path.join(root,"forge-engine.js"),"utf8"),context,{filename:"forge-engine.js"});
  return {E:context.self.ForgeEngine,MB};
}
const {E,MB}=loadEngine();
const RealEngine=require(path.join(root,"forge-engine.js"));
const cols=9,rows=5,n=cols*rows,idx=(c,r)=>r*cols+c;
const map={cols,rows,h:new Array(n).fill(10),wall:new Array(n).fill(false),occ:new Array(n).fill(0),coverShape:new Array(n).fill(null),connectors:[],ledges:[],spawns:[],props:[],meta:{vertical:{version:1}}};
const grid=new Array(n).fill(MB.CELL.FLOOR);
[[3,2],[4,2],[5,2]].forEach(([c,r])=>{grid[idx(c,r)]=MB.CELL.POOL;map.wall[idx(c,r)]=true;map.h[idx(c,r)]=0;});
const dungeon={W:cols,H:rows,grid};
const vertical=E._internals.verticalRecords(map,12345,dungeon);map.connectors=vertical.connectors;map.ledges=vertical.ledges;
const bridge=map.connectors.find(c=>c.kind==="bridge");
ok("generator emits a structural bridge",!!bridge);
ok("generator version advances to stable bridge identity",GF.GENERATOR_VERSION==="2.0.0-bridges.2");
ok("generated bridge ID is path-derived",bridge.id===BA.stableId(bridge));
ok("engine and bridge authority agree on path signature",E._internals.bridgePathSignature(bridge.path)===BA.pathSignature(bridge));
ok("stable identity is independent of list position",E._internals.bridgeStableId(bridge.path)===bridge.id);
const snap=GF.snapshotMap(map),fp=GF.fingerprintSnapshot(snap),restored=GF.restoreMap(snap,fp),restoredBridge=restored.connectors.find(c=>c.kind==="bridge");
ok("snapshot preserves the stable bridge ID",restoredBridge.id===bridge.id);
ok("snapshot preserves exact path identity",BA.pathSignature(restoredBridge)===BA.pathSignature(bridge));
ok("snapshot fingerprint remains stable after bridge restore",GF.fingerprintSnapshot(GF.snapshotMap(restored))===fp);

const p=bridge.path,token={speed:30};
ok("open bridge allows every authored segment",p.slice(1).every((q,i)=>TG.stepAllowed(map,token,p[i].c,p[i].r,q.c,q.r)));
bridge.state="closed";
ok("closed bridge blocks entry to the interior span",!TG.stepAllowed(map,token,p[0].c,p[0].r,p[1].c,p[1].r));
ok("closed bridge leaves the land bridgehead usable",TG.stepAllowed(map,token,p[0].c-1,p[0].r,p[0].c,p[0].r));
bridge.state="broken";
ok("broken bridge blocks the interior span",!TG.stepAllowed(map,token,p[0].c,p[0].r,p[1].c,p[1].r));
ok("broken bridge leaves the far land bridgehead usable",TG.stepAllowed(map,token,p[p.length-1].c+1,p[p.length-1].r,p[p.length-1].c,p[p.length-1].r));
bridge.state="open";

const midIndex=(p.length/2)|0,interior=p[midIndex],prev=p[midIndex-1],next=p[midIndex+1],dx=next.c-prev.c,dy=next.r-prev.r,side={c:interior.c+Math.round(dy),r:interior.r-Math.round(dx)};
const coverMap=JSON.parse(JSON.stringify(map));coverMap.connectors=map.connectors;
coverMap.wall[idx(side.c,side.r)]=false;coverMap.h[idx(side.c,side.r)]=interior.elevationFt;coverMap.occ[idx(side.c,side.r)]=0;
const railVerdict=TG.losVerdict(coverMap,side,{c:interior.c,r:interior.r});
ok("target-side bridge rail grants at least half cover",railVerdict.cover==="half"||railVerdict.cover==="three-quarters"||railVerdict.cover==="total");
ok("rail is named in cover evidence",(railVerdict.culprits["bridge-rail"]||0)>0);
const audit=BA.auditBridge(map,bridge,TG);
ok("bridge audit verifies open/closed/broken movement",audit.movement.open&&audit.movement.closed&&audit.movement.broken);
ok("bridge audit verifies both rail footprints and cover",audit.rails.active&&audit.rails.cover&&audit.rails.probes.length>=2);
ok("bridge audit passes the complete structural contract",audit.ok);

ok("bridge interior occupancy blocks state deletion",BA.occupiesInterior(bridge,[{c:interior.c,r:interior.r}]));
ok("a creature at the land bridgehead does not block closing",!BA.occupiesInterior(bridge,[{c:p[0].c,r:p[0].r}]));
const baselines=BA.captureBaselines([bridge],{}),sig=BA.pathSignature(bridge);
let runtime=JSON.parse(JSON.stringify(bridge));
BA.applyStates([runtime],{[bridge.id]:"closed"},baselines,{[bridge.id]:sig});
ok("matching replay proof applies the live state",runtime.state==="closed");
BA.applyStates([runtime],{},baselines,{});
ok("rewind without an override restores snapshot baseline",runtime.state==="open");
BA.applyStates([runtime],{[bridge.id]:"broken"},baselines,{[bridge.id]:sig+"-wrong"});
ok("mismatched path proof refuses a stale bridge edit",runtime.state==="open");

const roster=[];const events=[{seq:1,kind:"edit",unit:"dm",payload:{changes:[{connector_state:{id:bridge.id,state:"closed",path_signature:sig}}]}}];
const replay=FR.replayLog(roster,events);
ok("replay stores connector state",replay.connectorStates[bridge.id]==="closed");
ok("replay stores the bridge path proof",replay.connectorStateProofs[bridge.id]===sig);
const restoredState=FR.initialState([]);FR.applyEvent(restoredState,{seq:1,kind:"restore",unit:"dm",payload:{snapshot:FR.snapshot(replay)}} ,{});
ok("restore preserves connector path proofs",restoredState.connectorStateProofs[bridge.id]===sig);

const realParams=GF.normalizeParams({
  seed:1,theme:"swamp",archetype:"legacy-dungeon",
  sliders:{roomCount:8,loopChance:.2,decorDensity:.7,heightMode:"tiered",verticality:5,party:4,foes:5}
});
const realDetail=RealEngine.generateDetailed(realParams);
const realBridges=(realDetail.map.connectors||[]).filter(c=>c&&c.kind==="bridge");
ok("real staged generation emits a structural bridge",realBridges.length>0);

const searchInput=GF.normalizeParams({
  seed:7,theme:"grass",archetype:"legacy-dungeon",
  sliders:{roomCount:8,loopChance:.2,decorDensity:.7,heightMode:"tiered",verticality:5,party:4,foes:5}
});
const hasFinder=typeof RealEngine.findBridgeRecipe==="function";
ok("bridge finder is exported",hasFinder);
const found=hasFinder?RealEngine.findBridgeRecipe(searchInput,{maxSeeds:48}):null;
ok("bridge finder returns a real generated recipe",!!found&&(found.detail.map.connectors||[]).some(c=>c.kind==="bridge"));
ok("bridge finder returns a recipe that passes the live audit",!!found&&BA.auditMap(found.detail.map,TG).ok);
ok("bridge finder does not mutate its input",searchInput.seed===7&&searchInput.theme==="grass");

const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
ok("production loads bridge authority with fresh cache stamp",html.includes('forge-bridge-authority.js?v=fba1'));
ok("staff panel exposes bridge audit and inspect controls",html.includes('id="bridgeAuditBtn"')&&html.includes('bridgeInspectBtn'));
ok("live bridge edit carries path identity proof",html.includes('path_signature:proof'));
ok("replay application resets absent overrides to baselines",html.includes('B.applyStates(F&&F.connectors||[],states,base,proofs)'));
ok("occupied check uses only the interior span",html.includes('B.occupiesInterior(conn,units)'));
ok("selected bridge receives endpoint/path markers",html.includes('BRIDGE_INSPECT_ID')&&html.includes('SphereGeometry'));
const canon=fs.readFileSync(path.join(root,"tactics-geometry.js"),"utf8").trim(),start=html.indexOf('/* ════════════════════════════════════════════════════════════════════'),end=html.indexOf('</script>\n<style>',start);
ok("canonical geometry remains inlined exactly",start>=0&&end>start&&html.slice(start,end).trim()===canon);

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
