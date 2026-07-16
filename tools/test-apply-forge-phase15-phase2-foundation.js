#!/usr/bin/env node
"use strict";
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'forge-phase2-fixture-'));
fs.mkdirSync(path.join(root,'forge'),{recursive:true});
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
      overseer: uid, map: __forgeParams(), roster: buildRoster(), controllers: {}, status: 'staging'`;
const engine=`function generate(params) {
    var p = Object.assign({}, DEFAULTS, params || {});
    var seed = 7;
}`;
fs.writeFileSync(path.join(root,'forge/index.html'),topo);
fs.writeFileSync(path.join(root,'forge/forge-engine.js'),engine);
const patcher=path.join(__dirname,'apply-forge-phase15-phase2-foundation.js');
cp.execFileSync(process.execPath,[patcher,root],{stdio:'inherit'});
const out=fs.readFileSync(path.join(root,'forge/index.html'),'utf8');
const eng=fs.readFileSync(path.join(root,'forge/forge-engine.js'),'utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(out.includes("get('parallax')==='1'"),'parallax not inverted');
assert(out.includes('forge-generator-foundation.js?v=g2f1'),'module include missing');
assert(out.includes('generatorMeta:window.ForgeGeneratorFoundation?window.ForgeGeneratorFoundation.graphMetadata(D):null'),'guarded graph metadata missing');
assert(out.includes('spawns:(D.spawns||[]).map'),'generator spawn marks missing');
assert(out.includes("const live=(typeof CB!=='undefined'"),'live board spawn snapshot missing');
assert(out.includes('map: __forgeSessionMap()'),'snapshot save missing');
assert(eng.includes('forge-engine: unknown themeKey'),'engine guard missing');
assert(fs.existsSync(path.join(root,'forge/tests/smoke-generator-foundation.js')),'new smoke missing');
console.log('\nfixture patch checks green');
fs.rmSync(root,{recursive:true,force:true});
