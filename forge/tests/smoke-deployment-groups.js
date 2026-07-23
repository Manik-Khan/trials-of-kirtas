#!/usr/bin/env node
"use strict";
const path=require("path"),root=path.resolve(__dirname,"..");
const GF=require(path.join(root,"forge-generator-foundation.js"));
const Engine=require(path.join(root,"forge-engine.js"));
const Deploy=require(path.join(root,"forge-deployment.js"));
let pass=0;
function ok(name,value){if(!value)throw new Error("FAIL: "+name);pass++;console.log("ok",pass,"-",name);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function temple(seed){return Engine.generateDetailed(GF.normalizeParams({seed:seed,theme:"temple",archetype:"temple-terraces",sliders:{roomCount:8,decorDensity:.7,party:4,foes:5}})).map;}
function blocked(map){return Deploy.deploymentBlocked(map);}
function anchor(map,regionId,taken){
  const region=map.meta.intent.regions.find(r=>r.id===regionId),ban=blocked(map),used=taken||{};
  return region.cells.find(p=>!map.wall[p.r*map.cols+p.c]&&!ban[Deploy.pointKey(p)]&&!used[Deploy.pointKey(p)]);
}
function group(id,label,role,units,at,seed,manual){return{id,label,role,controllerPolicy:role==="party"?"unit-owners":"overseer",unitIds:units,anchor:at,formationSeed:seed,manualPositions:manual||{}};}

ok("deployment module is dual-exported",Deploy.VERSION===3&&typeof Deploy.planGroup==="function"&&globalThis.ForgeDeployment===Deploy);
ok("deployment roles map onto existing combat sides",Deploy.roleSide("party")==="pc"&&Deploy.roleSide("ally")==="pc"&&Deploy.roleSide("enemy")==="foe");
const map=temple(5),partyAnchor=anchor(map,"approach"),allyAnchor=anchor(map,"upper-court"),enemyAnchor=anchor(map,"lower-court");
const party=group("party-main","Main Party","party",["caim","cosmere","liadan","vesperian"],partyAnchor,21);
const ally=group("ally-wardens","Sanctuary Wardens","ally",["avel","guard"],allyAnchor,8,{avel:allyAnchor});
const enemy=group("enemy-raiders","North Gate Raiders","enemy",["g1","g2","g3","g4"],enemyAnchor,13);
const moved=Deploy.assignUnit([party,enemy],"caim","enemy-raiders");
ok("one assignment moves a combatant between groups without duplication",moved[0].unitIds.indexOf("caim")<0&&moved[1].unitIds.filter(u=>u==="caim").length===1);
const unassigned=Deploy.assignUnit(moved,"caim","");
ok("unassigning removes the combatant from every group",unassigned.every(g=>g.unitIds.indexOf("caim")<0));
const removedGroup=Deploy.removeGroup([party,enemy],"enemy-raiders");
ok("removing a group leaves its combatants safely unassigned",removedGroup.length===1&&removedGroup[0].id==="party-main"&&!removedGroup.some(g=>g.unitIds.indexOf("g1")>=0));
const a=Deploy.planDraft(map,[party,ally,enemy]),replay=Deploy.planDraft(map,[party,ally,enemy]);
ok("multiple Party Ally and Enemy groups resolve together",a.ok&&a.plans.length===3&&Object.keys(a.positions).length===10);
ok("identical flags and formation seeds repeat exactly",same(a,replay));
ok("every group stays inside its flag's authored region",a.plans.every(p=>Object.values(p.positions).every(at=>Deploy.regionForPoint(map,at).id===p.regionId)));
ok("connector paths landings props and walls are excluded",a.plans.every(p=>Object.values(p.positions).every(at=>!blocked(map)[Deploy.pointKey(at)]&&!map.wall[at.r*map.cols+at.c])));
ok("manual positions override generated formation",same(a.positions.avel,allyAnchor));
const reseeded=Deploy.planDraft(map,[party,ally,Object.assign({},enemy,{formationSeed:14})]);
ok("reseed changes only that group's local arrangement",same(a.plans[0].positions,reseeded.plans[0].positions)&&same(a.plans[1].positions,reseeded.plans[1].positions)&&!same(a.plans[2].positions,reseeded.plans[2].positions));
const noFlag=Deploy.planGroup(map,Object.assign({},enemy,{anchor:null}));
ok("a missing flag narrates and never invents a region",!noFlag.ok&&noFlag.regionId===null&&noFlag.errors.some(e=>e.includes("needs a deployment flag")));
const openMap={cols:5,rows:4,h:new Array(20).fill(0),wall:new Array(20).fill(false),props:[],connectors:[],meta:{}};
openMap.wall[2]=true;openMap.wall[7]=true;openMap.wall[12]=true;openMap.wall[17]=true;
const openGroup=group("road","Road Patrol","enemy",["r1","r2","r3"],{c:0,r:1},9);
const openPlan=Deploy.planGroup(openMap,openGroup);
ok("a regionless map uses the flag's connected walkable ground",openPlan.ok&&openPlan.regionId==="map"&&openPlan.placedCount===3&&Object.values(openPlan.positions).every(at=>at.c<2));
const openReplay=Deploy.planGroup(openMap,openGroup);
ok("regionless flag formations remain deterministic",same(openPlan.positions,openReplay.positions));
const isolatedFlag=Deploy.planGroup(openMap,Object.assign({},openGroup,{anchor:{c:2,r:1}}));
ok("a regionless flag still rejects blocked ground",!isolatedFlag.ok&&isolatedFlag.errors.some(e=>e.includes("not on connected walkable ground")));
const stair=map.connectors[0].path[0],stairFlag=Deploy.planGroup(map,Object.assign({},enemy,{anchor:stair}));
ok("a flag cannot occupy a required connector landing",!stairFlag.ok&&stairFlag.errors.some(e=>e.includes("connector, landing")));
const duplicate=Deploy.planDraft(map,[party,group("second","Second Party","party",["caim"],partyAnchor,3)]);
ok("a combatant cannot belong to two active groups",!duplicate.ok&&duplicate.errors.some(e=>e.includes("belongs to both")));
const tiny={cols:2,rows:2,h:[0,0,0,0],wall:[false,false,false,false],props:[],connectors:[],meta:{intent:{regions:[{id:"tiny",cells:[{c:0,r:0},{c:1,r:0}]}]}}};
const tooMany=Deploy.planGroup(tiny,group("crowd","Crowded Group","enemy",["a","b","c"],{c:0,r:0},1));
ok("insufficient capacity never stacks or drops silently",!tooMany.ok&&tooMany.placedCount<tooMany.requestedCount&&tooMany.errors.some(e=>e.includes("fits"))&&new Set(Object.values(tooMany.positions).map(Deploy.pointKey)).size===tooMany.placedCount);
const record=Deploy.deploymentRecord([party,ally,enemy],a),roundTrip=JSON.parse(JSON.stringify(record));
ok("exact groups flags pins and positions survive serialization",record.resolved&&same(record,roundTrip)&&same(record.positions,a.positions));
const roster=Deploy.applyToRoster([{unit:"caim",kind:"pc"},{unit:"avel",kind:"foe"},{unit:"g1",kind:"foe"}],roundTrip);
ok("serialized deployment restores exact roster positions roles and controller policy",same(roster.map(r=>r.pos),[record.positions.caim,record.positions.avel,record.positions.g1])&&roster.map(r=>r.side).join(",")==="pc,pc,foe"&&roster[1].controllerPolicy==="overseer");
const changedMap=JSON.parse(JSON.stringify(map));changedMap.wall[partyAnchor.r*changedMap.cols+partyAnchor.c]=true;
const invalidated=Deploy.planGroup(changedMap,party);
ok("structural invalidation leaves the authored flag unresolved without moving it",!invalidated.ok&&same(invalidated.group.anchor,partyAnchor)&&invalidated.errors.some(e=>e.includes("flag is illegal")));
ok("all three Temple variants accept deterministic deployment",[5,1,2].every(seed=>{const m=temple(seed);return Deploy.planGroup(m,group("probe","Probe","party",["a","b"],anchor(m,"approach"),seed)).ok;}));
console.log("\n"+pass+" deployment-group checks green");
