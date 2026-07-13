#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"forge-token-rig-fixture-"));
fs.mkdirSync(path.join(root,"forge/tests"),{recursive:true});
const js=`
const CAM_VIEW_3D='3d',CAM_VIEW_TOP='top';
const cam={view:CAM_VIEW_3D};
const CB={units:[],selKey:null,tgtKey:null,active:false};
const GLOW_SEL=0xe8b53a,GLOW_TGT=0xc0402f;
const tokenGroup={children:[],add(){},remove(){}};
const ray={intersectObjects(){return[];}};
const THREE={};
const PORTRAITS={};
function active(){return null;}function foeVisible(){return true;}function wxc(x){return x;}function wzc(z){return z;}function tierY(){return 0;}function escapeHtml(s){return s;}function clog(){}
function walkableCells(){}
function makeToken(u){
  u._ves=null;
  u.sprite={};
}
function setCameraView(view){
  cam.view=view;
  try{localStorage.setItem('tok-forge-camera-view',view);}catch(_e){}
}
function cameraFollowTick(){}
function loop(){
  cameraFollowTick();   // Phase 1.5: track tweened movement without camera bob
}
function syncGlow(){}
function syncAllGlow(){ if(typeof CB!=="undefined"&&CB.units) CB.units.forEach(syncGlow); }
function positionToken(u){ var X=wxc(u.c),Z=wzc(u.r),Y=tierY(u.c,u.r); if(u.sprite)u.sprite.position.set(X,Y+0.02,Z); if(u.shadow)u.shadow.position.set(X,Y+0.05,Z); if(u._glow)u._glow.position.set(X,Y+0.02,Z); }
function restageForHeight(){
  if (typeof CB !== "undefined" && CB && CB.units)
    CB.units.forEach(function(u){ if (u.sprite || u.shadow) positionToken(u); });
}
function removeToken(u,force){
  if(u._glow){ tokenGroup.remove(u._glow); u._glow=null; }   // #1: glow never outlives its token
  if(u.sprite)tokenGroup.remove(u.sprite);
}
function buildUnit(kit,side,opts){
  var u={ id:opts.id,
    reacted: false, alive: opts.alive !== false };
  return u;
}
function unitFromRosterRow(row,stateUnit,pos,hp,hpMax,alive,badge){
  return buildUnit({},row.side,{
    c: pos.c, r: pos.r, hp: hp, hpMax: hpMax, alive: alive, badge: badge });
}
function combatClick(){
  var healPending=false,cellUnit=null;
  var tu = pickUnit(healPending) || cellUnit;   // column first, then the cell — same order the hover tile predicts
  return tu;
}
function spriteUnit(obj){ var f=null; CB.units.forEach(function(u){ if(u.alive&&(u.sprite===obj||u.shadow===obj)) f=u; }); return f; }
function spriteUnitAny(obj){ var f=null; CB.units.forEach(function(u){ if(u.sprite===obj||u.shadow===obj) f=u; }); return f; }
function pickUnit(anyState){
  CB.units.forEach(function(un){
    if(!un.sprite && !un.shadow) return;             // no visual on this device — not clickable
  });
  return null;
}
function tween(){}
function flashHit(t){ if(!t.sprite||!t.sprite.material) return;
  t.sprite.material.color.setHex(0xff6b57);
}
`;
const topo=`<!doctype html><html><head>
<script src="forge-generator-foundation.js?v=g2f2"></script>
</head><body>
<div id="cameraViewToggle"></div>
    <div class="fname" id="camStatus">3D · free camera · Shift/middle-drag pans</div>
<script>${js}</script></body></html>`;
const original=topo.replace(/\r\n/g,"\n");
fs.writeFileSync(path.join(root,"forge/topography-test-mock.html"),original);
const bundle=path.resolve(__dirname,"..");
cp.execFileSync(process.execPath,[path.join(__dirname,"apply-forge-topdown-token-rig.js"),root],{stdio:"inherit"});
const patched=fs.readFileSync(path.join(root,"forge/topography-test-mock.html"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,"token-rig-patch.json"),"utf8"));
function once(t,n,r,l){const i=t.indexOf(n);if(i<0)throw Error(l+": missing fixture anchor");if(t.indexOf(n,i+n.length)>=0)throw Error(l+": duplicate fixture anchor");return t.slice(0,i)+r+t.slice(i+n.length);}
let browserEquivalent=original;
for(const p of manifest.patches)browserEquivalent=once(browserEquivalent,p.needle,p.replacement,p.label);
if(browserEquivalent!==patched)throw new Error("browser manifest and Node patcher outputs differ");
cp.execFileSync(process.execPath,[path.join(root,"forge/tests/smoke-unit-art.js")],{stdio:"inherit"});
cp.execFileSync(process.execPath,[path.join(root,"forge/tests/smoke-token-rig-contract.js")],{stdio:"inherit"});
const blocks=[...patched.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(x=>x.trim());
for(let i=0;i<blocks.length;i++){
  const f=path.join(root,"inline-"+i+".js");fs.writeFileSync(f,blocks[i]);cp.execFileSync(process.execPath,["--check",f]);
}
console.log("\nfixture patch, browser parity, and inline syntax checks green");
fs.rmSync(root,{recursive:true,force:true});
