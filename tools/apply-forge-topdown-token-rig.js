#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const repo=path.resolve(process.argv[2]||process.cwd());
const bundleRoot=path.resolve(__dirname,"..");
const plan=new Map();
function fail(m){console.error("\nABORT:",m);process.exit(1);}
function read(rel){const p=path.join(repo,rel);if(!fs.existsSync(p))fail("missing repository file: "+rel);return fs.readFileSync(p,"utf8");}
function once(t,n,r,l){const i=t.indexOf(n);if(i<0)fail(l+": anchor not found (use the camera-patched live file)");if(t.indexOf(n,i+n.length)>=0)fail(l+": anchor appears more than once");return t.slice(0,i)+r+t.slice(i+n.length);}
function schedule(rel,c){plan.set(rel,c);}
function scheduleNew(rel){const src=path.join(bundleRoot,rel);if(!fs.existsSync(src))fail("bundle is incomplete: "+rel);const c=fs.readFileSync(src,"utf8"),dst=path.join(repo,rel);if(fs.existsSync(dst)&&fs.readFileSync(dst,"utf8")!==c)fail(rel+" already exists with different content; reconcile manually");schedule(rel,c);}
let topo=read("forge/index.html");
if(topo.includes("forge-unit-art.js?v=ua1"))fail("top-down token rig is already present");
if(!topo.includes("CAM_VIEW_3D='3d'")||!topo.includes('id="cameraViewToggle"'))fail("production 3D/top-down camera is not present; apply the July 13b camera bundle first");

/* Module include. */
topo=once(topo,
  '<script src="forge-generator-foundation.js?v=g2f2"></script>',
  '<script src="forge-generator-foundation.js?v=g2f2"></script>\n<script src="forge-unit-art.js?v=ua1"></script>',
  "unit-art include");

/* Camera-panel art controls. */
topo=once(topo,
  '    <div class="fname" id="camStatus">3D · free camera · Shift/middle-drag pans</div>',
  '    <div class="fname" id="camStatus">3D · free camera · Shift/middle-drag pans</div>\n'
  +'    <div class="improw" style="margin:7px 0 4px">\n'
  +'      <button class="filebtn" id="tokenArtEdit" title="Customize the selected or active combatant on this device">Token art…</button>\n'
  +'      <button class="filebtn" id="tokenArtAuto" title="Clear only this combatant override; its creature or character default remains">Use default</button>\n'
  +'    </div>\n'
  +'    <div class="fname" id="tokenArtStatus">Top-down uses portrait and bestiary tokens; every combatant can be overridden.</div>',
  "token-art controls");

/* Resolver + Three.js unit-rig layer. Inserted after initialTokenTex and before placement. */
const rig=`/* ── Phase 1.5c: dual standee / top-down token unit rig ──────────────
   One combat unit, two view-only representations. The sprite remains the 3D
   standee; topToken is a flat map-space disc. Fog/selection/death gate the
   rig once through syncUnitVisual(), so Phase 1.5 fog does not fork by view. */
const TOP_TOKEN_Y=0.105, TOP_TOKEN_R=0.49;
const _topDiscGeo=new THREE.CircleGeometry(TOP_TOKEN_R,48);
const _topRingGeo=new THREE.RingGeometry(TOP_TOKEN_R+0.025,TOP_TOKEN_R+0.105,48);
function topInitialTexture(u){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  const col=u.side==='pc'?'#9e7b31':'#8b3f35';
  g.fillStyle='#181713';g.fillRect(0,0,256,256);
  g.beginPath();g.arc(128,128,119,0,Math.PI*2);g.fillStyle='#e8ddc4';g.fill();
  g.beginPath();g.arc(128,128,104,0,Math.PI*2);g.fillStyle=u.side==='pc'?'#29353a':'#3a2422';g.fill();
  g.strokeStyle=col;g.lineWidth=13;g.beginPath();g.arc(128,128,111,0,Math.PI*2);g.stroke();
  const ua=window.ForgeUnitArt,letters=ua?ua.initials(u.name||u.key||u.unit):'?';
  g.fillStyle='#f4e8ca';g.textAlign='center';g.textBaseline='middle';
  g.font='bold '+(letters.length>1?82:112)+'px Georgia';g.fillText(letters,128,137);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;return t;
}
function tokenArtStorage(){try{return window.localStorage;}catch(_e){return null;}}
function unitArtResolution(u){
  const ua=window.ForgeUnitArt;
  return ua?ua.resolve(u,{storage:tokenArtStorage(),portraits:PORTRAITS}):{url:null,source:'initials',fallback:true};
}
function cropTokenTexture(t){
  const im=t.image||{},w=Number(im.width)||1,h=Number(im.height)||1,asp=w/h;
  t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.colorSpace=THREE.SRGBColorSpace;
  t.repeat.set(1,1);t.offset.set(0,0);
  if(asp>1){t.repeat.x=1/asp;t.offset.x=(1-t.repeat.x)/2;}
  else if(asp<1){t.repeat.y=asp;t.offset.y=(1-t.repeat.y)/2;}
  t.needsUpdate=true;return t;
}
function disposeTopToken(u){
  if(u.topToken){tokenGroup.remove(u.topToken);if(u.topToken.material){if(u.topToken.material.map)u.topToken.material.map.dispose();u.topToken.material.dispose();}u.topToken=null;}
  if(u.topRing){tokenGroup.remove(u.topRing);if(u.topRing.material)u.topRing.material.dispose();u.topRing=null;}
}
function makeTopToken(u){
  disposeTopToken(u);
  const X=wxc(u.c),Z=wzc(u.r),Y=tierY(u.c,u.r),fallback=topInitialTexture(u);
  const mat=new THREE.MeshBasicMaterial({map:fallback,transparent:false,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const disc=new THREE.Mesh(_topDiscGeo,mat);disc.rotation.x=-Math.PI/2;disc.position.set(X,Y+TOP_TOKEN_Y,Z);disc.renderOrder=9;
  disc.userData.unit=u;u.topToken=disc;tokenGroup.add(disc);
  const ringMat=new THREE.MeshBasicMaterial({color:u.side==='pc'?GLOW_SEL:GLOW_TGT,transparent:true,opacity:.82,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});
  const ring=new THREE.Mesh(_topRingGeo,ringMat);ring.rotation.x=-Math.PI/2;ring.position.set(X,Y+TOP_TOKEN_Y+.008,Z);ring.renderOrder=10;
  ring.userData.unit=u;u.topRing=ring;tokenGroup.add(ring);
  const resolved=unitArtResolution(u);u._tokenArtResolved=resolved;
  if(resolved.url){
    new THREE.TextureLoader().load(resolved.url,function(tex){
      if(u.topToken!==disc){tex.dispose();return;}
      cropTokenTexture(tex);const old=disc.material.map;disc.material.map=tex;disc.material.needsUpdate=true;if(old)old.dispose();
    },undefined,function(){
      if(u.topToken===disc){u._tokenArtResolved={url:null,source:'initials-fallback',fallback:true};disc.material.map=fallback;disc.material.needsUpdate=true;}
    });
  }
  syncUnitVisual(u);
}
function unitRigVisible(u){
  if(!u)return false;
  if(u.side==='foe'&&typeof foeVisible==='function'&&!foeVisible(u))return false;
  return true;
}
function unitMatchesKey(u,key){return !!u&&!!key&&(u.key===key||u.unit===key||u.id===key);}
function syncUnitVisual(u){
  if(!u)return;const top=typeof cam!=='undefined'&&cam.view===CAM_VIEW_TOP,allowed=unitRigVisible(u);
  if(u.sprite)u.sprite.visible=allowed&&!top;
  if(u.shadow)u.shadow.visible=allowed&&!top&&u.alive!==false;
  if(u._glow)u._glow.visible=allowed&&!top;
  if(u.topToken){
    if(u.sprite)u.topToken.position.set(u.sprite.position.x,u.sprite.position.y+TOP_TOKEN_Y,u.sprite.position.z);
    u.topToken.visible=allowed&&top;u.topToken.material.opacity=u.alive===false?.48:1;u.topToken.material.transparent=u.alive===false;
  }
  if(u.topRing){
    if(u.topToken)u.topRing.position.set(u.topToken.position.x,u.topToken.position.y+.008,u.topToken.position.z);
    const selected=typeof CB!=='undefined'&&CB&&unitMatchesKey(u,CB.selKey);
    const targeted=typeof CB!=='undefined'&&CB&&unitMatchesKey(u,CB.tgtKey);
    const acting=typeof active==='function'&&typeof CB!=='undefined'&&CB&&CB.active&&active()===u;
    u.topRing.material.color.set(targeted?GLOW_TGT:(u.side==='pc'?GLOW_SEL:GLOW_TGT));
    u.topRing.material.opacity=targeted?1:(selected||acting?.96:.58);
    const s=targeted?1.13:(selected||acting?1.07:1);u.topRing.scale.setScalar(s);
    u.topRing.visible=allowed&&top;
  }
}
function syncAllUnitVisuals(){if(typeof CB!=='undefined'&&CB&&CB.units)CB.units.forEach(syncUnitVisual);}
function pickTopToken(anyState){
  if(typeof cam==='undefined'||cam.view!==CAM_VIEW_TOP||typeof CB==='undefined'||!CB||!CB.units)return null;
  const meshes=CB.units.filter(function(u){return (anyState||u.alive)&&u.topToken&&u.topToken.visible&&unitRigVisible(u);}).map(function(u){return u.topToken;});
  const hit=meshes.length?ray.intersectObjects(meshes,false)[0]:null;
  return hit&&hit.object&&hit.object.userData?hit.object.userData.unit||null:null;
}
function tokenArtUnit(){
  if(typeof CB==='undefined'||!CB||!CB.units||!CB.units.length)return null;
  return CB.units.find(function(u){return unitMatchesKey(u,CB.selKey);})||
    CB.units.find(function(u){return unitMatchesKey(u,CB.tgtKey);})||
    (typeof active==='function'?active():null)||CB.units[0];
}
function rebuildTopTokenScope(u,scope){
  if(!u||typeof CB==='undefined'||!CB||!CB.units)return;
  const ua=window.ForgeUnitArt,key=ua&&ua.overrideKey(u,scope);
  CB.units.forEach(function(other){if((scope==='unit'&&other===u)||(scope==='kind'&&ua&&ua.overrideKey(other,'kind')===key))makeTopToken(other);});
  syncAllUnitVisuals();
}
function tokenArtNarrate(msg){
  const el=document.getElementById('tokenArtStatus');if(el)el.textContent=msg;
  if(typeof clog==='function')clog('<i>'+escapeHtml(msg)+'</i>');
}
function tokenFileDataUrl(file){
  return new Promise(function(resolve,reject){
    if(!file||!/^image\//i.test(file.type||'')){reject(new Error('Choose an image file.'));return;}
    const reader=new FileReader();
    reader.onerror=function(){reject(new Error('The image file could not be read.'));};
    reader.onload=function(){
      const img=new Image();
      img.onerror=function(){reject(new Error('The selected file is not a readable image.'));};
      img.onload=function(){
        const size=384,c=document.createElement('canvas'),g=c.getContext('2d');c.width=c.height=size;
        const side=Math.min(img.naturalWidth||img.width,img.naturalHeight||img.height);
        const sx=((img.naturalWidth||img.width)-side)/2,sy=((img.naturalHeight||img.height)-side)/2;
        g.drawImage(img,sx,sy,side,side,0,0,size,size);
        try{resolve(c.toDataURL('image/webp',.88));}catch(_e){resolve(c.toDataURL('image/png'));}
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function ensureTokenArtDialog(){
  let host=document.getElementById('forgeTokenArtDialog');if(host)return host;
  const css=document.createElement('style');css.textContent='#forgeTokenArtDialog{position:fixed;inset:0;z-index:10050;background:rgba(6,8,7,.72);display:none;align-items:center;justify-content:center}#forgeTokenArtDialog.open{display:flex}.fta-card{width:min(480px,calc(100vw - 28px));background:#1b211d;border:1px solid rgba(221,190,116,.42);box-shadow:0 24px 80px #000;padding:18px;border-radius:12px;color:#eee6d3}.fta-card h3{margin:0 0 5px;font:22px Georgia,serif}.fta-card p{margin:0 0 13px;color:#aaa08c;font-size:12px;line-height:1.5}.fta-card label{display:block;color:#c6b994;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin:9px 0 5px}.fta-card input,.fta-card select{width:100%;box-sizing:border-box;background:#101411;color:#eee6d3;border:1px solid #5f594a;border-radius:6px;padding:9px}.fta-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}.fta-actions button{background:#2b312c;color:#eee6d3;border:1px solid #625b49;border-radius:7px;padding:8px 11px;cursor:pointer}.fta-actions .primary{background:#6b5628;border-color:#d5ae50}';document.head.appendChild(css);
  host=document.createElement('div');host.id='forgeTokenArtDialog';host.innerHTML='<div class="fta-card" role="dialog" aria-modal="true"><h3 id="ftaName">Token art</h3><p>Use an image URL or choose a local image. This device remembers the choice. “Creature / character” applies to every matching combatant; “this combatant” can still override it.</p><label>Scope</label><select id="ftaScope"><option value="unit">This combatant only</option><option value="kind">Creature / character default</option></select><label>Image URL</label><input id="ftaUrl" type="url" placeholder="https://…/token.webp"><label>Or choose an image</label><input id="ftaFile" type="file" accept="image/*"><div class="fta-actions"><button id="ftaClear">Clear this scope</button><button id="ftaClose">Cancel</button><button id="ftaApply" class="primary">Apply art</button></div></div>';
  document.body.appendChild(host);host.addEventListener('click',function(e){if(e.target===host)host.classList.remove('open');});
  host.querySelector('#ftaClose').onclick=function(){host.classList.remove('open');};
  host.querySelector('#ftaApply').onclick=async function(){
    const u=tokenArtUnit(),ua=window.ForgeUnitArt,scope=host.querySelector('#ftaScope').value,file=host.querySelector('#ftaFile').files[0];
    if(!u||!ua)return;try{const url=file?await tokenFileDataUrl(file):host.querySelector('#ftaUrl').value.trim();ua.setOverride(u,scope,url,tokenArtStorage());rebuildTopTokenScope(u,scope);host.classList.remove('open');tokenArtNarrate((scope==='kind'?'Default':'Custom')+' token art set for '+u.name+'.');}catch(e){tokenArtNarrate(e.message||String(e));}
  };
  host.querySelector('#ftaClear').onclick=function(){
    const u=tokenArtUnit(),ua=window.ForgeUnitArt,scope=host.querySelector('#ftaScope').value;if(!u||!ua)return;
    ua.clearOverride(u,scope,tokenArtStorage());rebuildTopTokenScope(u,scope);host.classList.remove('open');tokenArtNarrate(u.name+' returned to automatic art for that scope.');
  };
  return host;
}
function openTokenArtEditor(){
  const u=tokenArtUnit(),ua=window.ForgeUnitArt;if(!u){tokenArtNarrate('Start combat or select a combatant before editing token art.');return;}
  if(!ua){tokenArtNarrate('Token-art module did not load.');return;}
  const host=ensureTokenArtDialog(),current=ua.getOverride(u,tokenArtStorage());
  host.querySelector('#ftaName').textContent='Token art · '+u.name;host.querySelector('#ftaScope').value=current&&current.scope||'unit';host.querySelector('#ftaUrl').value=current&&current.url||'';host.querySelector('#ftaFile').value='';host.classList.add('open');host.querySelector('#ftaUrl').focus();
}
function resetTokenArtForSelection(){
  const u=tokenArtUnit(),ua=window.ForgeUnitArt;if(!u||!ua){tokenArtNarrate('No combatant is available.');return;}
  ua.clearOverride(u,'unit',tokenArtStorage());makeTopToken(u);tokenArtNarrate(u.name+' now uses its creature / character default or automatic art.');
}
function wireTokenArtControls(){
  const edit=document.getElementById('tokenArtEdit'),auto=document.getElementById('tokenArtAuto');
  if(edit)edit.addEventListener('click',openTokenArtEditor);if(auto)auto.addEventListener('click',resetTokenArtForSelection);
}
wireTokenArtControls();
window.__forgeTokenArt={open:openTokenArtEditor,reset:resetTokenArtForSelection,rebuild:makeTopToken,sync:syncAllUnitVisuals,resolve:unitArtResolution};
`;
topo=once(topo,'function walkableCells(){',rig+'\nfunction walkableCells(){','unit-rig implementation');

/* Create the flat representation for every combat unit, including Ves' early-return branch. */
topo=once(topo,'  u._ves=null;','  u._ves=null;\n  makeTopToken(u);','top token construction');

/* View change and frame loop both resync the two representations. */
topo=once(topo,'  cam.view=view;\n  try{localStorage.setItem(\'tok-forge-camera-view\',view);}catch(_e){}',
  '  cam.view=view;\n  syncAllUnitVisuals();\n  try{localStorage.setItem(\'tok-forge-camera-view\',view);}catch(_e){}','view swap');
topo=once(topo,'  cameraFollowTick();   // Phase 1.5: track tweened movement without camera bob',
  '  cameraFollowTick();   // Phase 1.5: track tweened movement without camera bob\n  syncAllUnitVisuals();   // top token follows the same movement tween and fog gate','rig frame sync');

/* Selection/target glow now includes the top-down ring. */
topo=once(topo,'function syncAllGlow(){ if(typeof CB!=="undefined"&&CB.units) CB.units.forEach(syncGlow); }',
  'function syncAllGlow(){ if(typeof CB!=="undefined"&&CB.units) CB.units.forEach(syncGlow); syncAllUnitVisuals(); }','glow bridge');

/* Restaging and movement position all visual forms. */
topo=once(topo,
  'function positionToken(u){ var X=wxc(u.c),Z=wzc(u.r),Y=tierY(u.c,u.r); if(u.sprite)u.sprite.position.set(X,Y+0.02,Z); if(u.shadow)u.shadow.position.set(X,Y+0.05,Z); if(u._glow)u._glow.position.set(X,Y+0.02,Z); }',
  'function positionToken(u){ var X=wxc(u.c),Z=wzc(u.r),Y=tierY(u.c,u.r); if(u.sprite)u.sprite.position.set(X,Y+0.02,Z); if(u.shadow)u.shadow.position.set(X,Y+0.05,Z); if(u._glow)u._glow.position.set(X,Y+0.02,Z); if(u.topToken)u.topToken.position.set(X,Y+TOP_TOKEN_Y,Z); if(u.topRing)u.topRing.position.set(X,Y+TOP_TOKEN_Y+.008,Z); syncUnitVisual(u); }',
  'rig positioning');
topo=once(topo,'CB.units.forEach(function(u){ if (u.sprite || u.shadow) positionToken(u); });',
  'CB.units.forEach(function(u){ if (u.sprite || u.shadow || u.topToken) positionToken(u); });','height restage');

/* Force-removal disposes both forms; ordinary death leaves a grey map token. */
topo=once(topo,
  '  if(u._glow){ tokenGroup.remove(u._glow); u._glow=null; }   // #1: glow never outlives its token',
  '  if(u._glow){ tokenGroup.remove(u._glow); u._glow=null; }   // #1: glow never outlives its token\n  if(!force&&u.topToken){u.alive=false;syncUnitVisual(u);}\n  if(force)disposeTopToken(u);',
  'rig removal');

/* Top-down discs participate in every existing picking door. The direct
   disc raycast avoids the old standee-column math becoming singular near
   vertical, while 3D keeps the field-tested WYSIWYG picker unchanged. */
topo=once(topo,
  '  var tu = pickUnit(healPending) || cellUnit;   // column first, then the cell — same order the hover tile predicts',
  '  var tu = pickTopToken(healPending) || pickUnit(healPending) || cellUnit;   // top disc in tactical view; field-tested column/cell picker in 3D',
  'top token combat picking');
topo=once(topo,
  'function spriteUnit(obj){ var f=null; CB.units.forEach(function(u){ if(u.alive&&(u.sprite===obj||u.shadow===obj)) f=u; }); return f; }',
  'function spriteUnit(obj){ var f=null; CB.units.forEach(function(u){ if(u.alive&&(u.sprite===obj||u.shadow===obj||u.topToken===obj||u.topRing===obj)) f=u; }); return f; }',
  'top token live matcher');
topo=once(topo,
  'function spriteUnitAny(obj){ var f=null; CB.units.forEach(function(u){ if(u.sprite===obj||u.shadow===obj) f=u; }); return f; }',
  'function spriteUnitAny(obj){ var f=null; CB.units.forEach(function(u){ if(u.sprite===obj||u.shadow===obj||u.topToken===obj||u.topRing===obj) f=u; }); return f; }',
  'top token any-state matcher');
topo=once(topo,
  '    if(!un.sprite && !un.shadow) return;             // no visual on this device — not clickable',
  '    if(!un.sprite && !un.shadow && !un.topToken) return; // no visual on this device — not clickable',
  'top token picker visibility');

/* A hit flashes whichever representation is currently visible; the existing
   sprite shake automatically carries the top token because frame sync follows
   the shared position. */
topo=once(topo,
  '  t.sprite.material.color.setHex(0xff6b57);',
  '  t.sprite.material.color.setHex(0xff6b57);\n  if(t.topToken&&t.topToken.material){t.topToken.material.color.setHex(0xff6b57);setTimeout(function(){if(t.topToken&&t.topToken.material)t.topToken.material.color.setHex(0xffffff);},230);}',
  'top token hit flash');

/* Carry authoritative/shared art metadata when it already exists. */
topo=once(topo,
  '    reacted: false, alive: opts.alive !== false };',
  '    reacted: false, alive: opts.alive !== false, tokenArt: opts.tokenArt || null };',
  'unit art field');
topo=once(topo,
  '    c: pos.c, r: pos.r, hp: hp, hpMax: hpMax, alive: alive, badge: badge });',
  '    c: pos.c, r: pos.r, hp: hp, hpMax: hpMax, alive: alive, badge: badge,\n    tokenArt: (stateUnit&&stateUnit.tokenArt)||row.tokenArt||row.token_url||null });',
  'roster art bridge');

/* Post-patch contract. */
const must=['forge-unit-art.js?v=ua1','function makeTopToken(u)','function syncUnitVisual(u)','id="tokenArtEdit"','syncAllUnitVisuals();   // top token follows','tokenArt: opts.tokenArt || null','pickTopToken(healPending) || pickUnit','u.topToken===obj||u.topRing===obj'];
for(const marker of must)if(!topo.includes(marker))fail('post-patch verification missing: '+marker);
schedule('forge/index.html',topo);
scheduleNew('forge/forge-unit-art.js');scheduleNew('forge/TOPDOWN_TOKEN_RIG.md');scheduleNew('forge/tests/smoke-unit-art.js');scheduleNew('forge/tests/smoke-token-rig-contract.js');
const temps=[];try{for(const [rel,c] of plan){const abs=path.join(repo,rel);fs.mkdirSync(path.dirname(abs),{recursive:true});const tmp=abs+'.forge-tmp-'+process.pid;fs.writeFileSync(tmp,c,'utf8');temps.push([tmp,abs]);}for(const [tmp,abs] of temps)fs.renameSync(tmp,abs);}catch(e){for(const [tmp] of temps)try{fs.unlinkSync(tmp)}catch(_){}fail(e.message||String(e));}
console.log('Applied Battle Forge top-down token rig:');for(const rel of plan.keys())console.log('  '+rel);console.log('\nNo commit or push was performed.');
