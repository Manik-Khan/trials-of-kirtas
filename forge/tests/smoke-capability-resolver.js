#!/usr/bin/env node
"use strict";
const R=require("../forge-capability-resolver.js");
let pass=0,fail=0;
function ok(label,value){if(value){pass++;console.log("ok "+pass+" - "+label);}else{fail++;console.error("not ok - "+label);}}
function cap(tag){return {status:"executable",tags:[tag]};}

ok("resolver version is pinned",R.VERSION==="1.1.0");
let result=R.resolveDamage({capabilities:[cap("resistance:fire")]},{total:11,parts:[{type:"fire",total:5},{type:"fire",total:6}]});
ok("same-type parts are grouped before resistance rounding",result.total===5&&result.rawTotal===11&&result.evidence[0].rule==="resistance");
result=R.resolveDamage({capabilities:[cap("immunity:necrotic")]},{total:8,parts:[{type:"necrotic",total:8}]});
ok("typed immunity reduces that group to zero",result.total===0&&result.parts[0].defense==="immune");
result=R.resolveDamage({capabilities:[cap("resistance:fire"),cap("vulnerability:fire")]},{total:7,parts:[{type:"fire",total:7}]});
ok("resistance and vulnerability cancel",result.total===7&&result.evidence.length===0);
result=R.resolveDamage({capabilities:[]},{total:9,parts:[{type:"slashing",total:5},{type:"fire",total:4}]},{effects:[{kind:"raven-resistance"}]});
ok("Raven Queen effect resists every typed damage group",result.total===4&&result.evidence.length===2);
result=R.resolveDamage({capabilities:[cap("resistance:fire")]},{total:6,parts:[{type:"Rage",total:2},{type:"fire",total:4}]});
ok("custom untyped riders remain unchanged",result.total===4&&result.parts[0].total===2&&result.parts[1].total===2);
result=R.resolveDamage({capabilities:[]},{total:11,parts:[{type:"slashing",total:11}]},{effects:[{kind:"rage"}]});
ok("Rage halves physical weapon damage through the shared effect ledger",result.total===5&&result.evidence[0].rule==="resistance");

const map={cols:5,rows:5,wall:new Array(25).fill(false)};map.wall[2*5+3]=true;
const cells=R.teleportCells({map,from:{c:2,r:2},range:2,occupied:new Set(["1,1"]),visible:p=>p.c!==0});
ok("teleport excludes origin, walls, occupied cells, and unseen cells",!cells.some(p=>p.key==="2,2"||p.key==="3,2"||p.key==="1,1"||p.c===0));
ok("teleport includes a visible open destination in range",cells.some(p=>p.key==="4,4"));
ok("teleport effect is replay-ready",R.teleportEffect("cosmere",{c:4,r:4},"Starlight Step").teleport.to.c===4);

console.log("\n"+pass+" capability resolver checks green"+(fail?" · "+fail+" failed":""));
process.exitCode=fail?1:0;
