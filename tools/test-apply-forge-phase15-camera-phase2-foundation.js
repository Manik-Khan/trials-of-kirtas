#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process");
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-camera-fixture-'));fs.mkdirSync(path.join(root,'forge/tests'),{recursive:true});
const topo=`<script src="map-bridge.js?v=fb1"></script>
<script src="forge-engine.js?v=fb1"></script>
   URL switches make browser A/B checks possible without another deploy:
     ?storybook=0  restores the v1 cylinder + gradient backdrop
     ?parallax=0   keeps sky + horizon, hides far/mid/near cards
     ?landmarks=0  hides the optional hero landmark card               */
const STORYBOOK_PARAMS=new URLSearchParams(location.search);
const STORYBOOK_ON=STORYBOOK_PARAMS.get('storybook')!=='0';
const PARALLAX_ON=STORYBOOK_PARAMS.get('parallax')!=='0';
const LANDMARKS_ON=STORYBOOK_PARAMS.get('landmarks')!=='0';
    <div class="eyebrow" style="margin-bottom:6px">CAMERA (local)</div>
    <div class="slider-wrap">
      <label>Height exaggeration <span class="val" id="heightVal">115%</span></label>
const camera=new THREE.PerspectiveCamera(38,1,0.1,900);
const cam={theta:Math.PI*0.22, phi:Math.PI*0.30, r:80, tgt:new THREE.Vector3(0,4,0)};
function placeCam(){const sp=Math.sin(cam.phi),cp=Math.cos(cam.phi);
  camera.position.set(cam.tgt.x+cam.r*sp*Math.sin(cam.theta),cam.tgt.y+cam.r*cp,cam.tgt.z+cam.r*sp*Math.cos(cam.theta));
  camera.lookAt(cam.tgt); updateStorybookBackdrop();}
function updateStorybookBackdrop(){
  storyLayers.forEach(s=>{
    const o=s.userData.story, dist=o.distance;
  });
}
  return {W,H,height,type,foot,props,occ,name:D.name};
function forgeParams(){
  return { seed: parseInt(document.getElementById('seed').value)||7,
           theme: BIOME,
           sliders: { roomCount:+document.getElementById('rooms').value,
                      loopChance:(+document.getElementById('loops').value)/100,
                      decorDensity:(+document.getElementById('decor').value)/100,
                      verticality:5,
                      foes:+document.getElementById('foes').value } };
}
window.__forgeParams = forgeParams;
map: __forgeParams(), roster: buildRoster()
let drag=false,lx=0,ly=0,moved=0;
renderer.domElement.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;moved=0;});
addEventListener('pointerup',e=>{ drag=false;
  if(selectedSprite && moved<6){                       // a click (not an orbit-drag) → place
    const rect=renderer.domElement.getBoundingClientRect();
    ndc.x=((e.clientX-rect.left)/rect.width)*2-1; ndc.y=-((e.clientY-rect.top)/rect.height)*2+1;
    ray.setFromCamera(ndc,camera);
    const hits=ray.intersectObjects(world.children,true);
    if(hits.length) placeAt(hits[0].point);
  }});
addEventListener('pointermove',e=>{if(!drag)return; moved+=Math.abs(e.movementX||0)+Math.abs(e.movementY||0);
  cam.theta-=(e.clientX-lx)*0.006;cam.phi-=(e.clientY-ly)*0.005;
  cam.phi=Math.max(0.1,Math.min(1.4,cam.phi));lx=e.clientX;ly=e.clientY;placeCam();});
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();
  cam.r=Math.max(14,Math.min(200,cam.r+e.deltaY*0.05));placeCam();},{passive:false});

function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();placeCam();}
addEventListener('resize',resize);
function frameField(){cam.tgt.set(0,STEP*2.2,0);cam.r=Math.max(F.W,F.H)*1.15;placeCam();}
function focusUnit(u){
  if(!u) return;
  var to={x:wxc(u.c), y:tierY(u.c,u.r)+0.6, z:wzc(u.r)};
  var from={x:cam.tgt.x, y:cam.tgt.y, z:cam.tgt.z};
  tween(420,function(e){ var k=e*e*(3-2*e);   // smoothstep — arrive, don't slam
    cam.tgt.set(from.x+(to.x-from.x)*k, from.y+(to.y-from.y)*k, from.z+(to.z-from.z)*k); placeCam(); })
    .then(function(){ ringPulse(u.c,u.r); if(u.sprite) showNameplate(u); });
}
function setTgt(key){ CB.tgtKey = (CB.tgtKey===key? null : key); renderHud&&renderHud(); }
if(tu && tu.alive && !(myTurn && CB.pending)){ setSel(tu.key); inspectUnit(tu); return; }
function beginTurn(u){
  if(!u) return;
  CB.st={ moveLeft:Math.floor(u.speed/5), usedAction:false, usedBonus:false, attacked:false };
  CB.pending=null; CONTEST_COVER=false;
  CB.seen=TG.movementReach(CB.map,u,occupied(u),CB.st.moveLeft);
  snapshot("Turn: "+u.name, true); CB.turnStartPtr=CB.hptr;
  drawHi(); drawSight(); renderHud();
}
    trackBadges();
  }
  if(shakeAmt>0.0005)`;
const engine=`function generate(params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var seed = 7;
}`;
fs.writeFileSync(path.join(root,'forge/index.html'),topo);fs.writeFileSync(path.join(root,'forge/forge-engine.js'),engine);
const bundle=path.resolve(__dirname,'..');
for(const rel of ['forge/forge-generator-foundation.js','forge/tests/smoke-generator-foundation.js','forge/tests/smoke-camera-contract.js','forge/camera-discovery-mock.html','forge/PHASE2_GENERATOR_FOUNDATION.md']){const d=path.join(root,rel);fs.mkdirSync(path.dirname(d),{recursive:true});if(fs.existsSync(path.join(bundle,rel)))fs.copyFileSync(path.join(bundle,rel),d);}
cp.execFileSync(process.execPath,[path.join(__dirname,'apply-forge-phase15-camera-phase2-foundation.js'),root],{stdio:'inherit'});
cp.execFileSync(process.execPath,[path.join(root,'forge/tests/smoke-camera-contract.js'),path.join(root,'forge/index.html')],{stdio:'inherit'});
const s=fs.readFileSync(path.join(root,'forge/index.html'),'utf8');
if(!s.includes("get('parallax')==='1'"))throw Error('art flag not patched');
if(!s.includes('forge-generator-foundation.js?v=g2f2'))throw Error('cache stamp not patched');
console.log('\nfixture patch checks green');fs.rmSync(root,{recursive:true,force:true});
