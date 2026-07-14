#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const OLD_SHA="c2483167043f1d3ddb13b3e21689357b0c28e0cc66706501187e218a90055b90";
const START="/* ════════════════════════════════════════════════════════════════════\n   tactics-geometry.js";
const END='})(typeof window !== "undefined" ? window : globalThis);';
function sha(s){return crypto.createHash("sha256").update(s).digest("hex");}
function normalized(s){return String(s).replace(/\r\n/g,"\n").replace(/\s+$/,"")+"\n";}
function inlineGeometry(html){
  const a=html.indexOf(START);if(a<0)throw new Error("missing inlined tactics-geometry start marker");
  const z=html.indexOf(END,a);if(z<0)throw new Error("missing inlined tactics-geometry end marker");
  return {start:a,end:z+END.length,source:normalized(html.slice(a,z+END.length))};
}
function patchFiles(opts={}){
  const forgeDir=opts.forgeDir||__dirname;
  const canonical=opts.canonical||path.join(forgeDir,"tactics-geometry.js");
  const topography=opts.topography||path.join(forgeDir,"topography-test-mock.html");
  let battle=opts.battle;
  if(!battle){
    const candidates=[path.join(forgeDir,"battle-tactics-geo-mock.html"),path.join(forgeDir,"..","battle-tactics-geo-mock.html")];
    battle=candidates.find(fs.existsSync);
  }
  if(!battle)throw new Error("battle-tactics-geo-mock.html was not found beside forge/ or at repository root");
  const newGeo=normalized(fs.readFileSync(canonical,"utf8")),newSha=sha(newGeo);
  if(newSha===OLD_SHA)throw new Error("canonical tactics-geometry.js is still the pre-Phase-2e source");
  const targets=[topography,battle].map(file=>({file,text:fs.readFileSync(file,"utf8")}));
  const plans=[];
  for(const t of targets){
    const found=inlineGeometry(t.text),h=sha(found.source);
    if(h===newSha){plans.push({...t,found,write:false});continue;}
    if(h!==OLD_SHA)throw new Error(path.relative(process.cwd(),t.file)+" has an unknown geometry copy (sha256 "+h+"); no files written");
    plans.push({...t,found,write:true});
  }
  for(const p of plans)if(p.write){
    const out=p.text.slice(0,p.found.start)+newGeo.trimEnd()+p.text.slice(p.found.end);
    fs.writeFileSync(p.file,out);
  }
  return {canonical,battle,topography,newSha,changed:plans.filter(p=>p.write).map(p=>p.file)};
}
if(require.main===module){
  try{const r=patchFiles();console.log("Phase 2e geometry synchronized:");console.log("  sha256",r.newSha);console.log(r.changed.length?r.changed.map(f=>"  updated "+f).join("\n"):"  all copies already current");}
  catch(e){console.error("Phase 2e geometry sync aborted:",e.message);process.exit(1);}
}
module.exports={patchFiles,inlineGeometry,sha,OLD_SHA};
