#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const repo=path.resolve(process.argv[2]||process.cwd());
const parent=path.resolve(__dirname,"..");
const bundleRoot=fs.existsSync(path.join(parent,"forge/tactics-geometry.js"))?parent:path.join(parent,"out");
const candidates=["battle-tactics-geo-mock.html","forge/battle-tactics-geo-mock.html"];
const rel=process.argv[3]||candidates.find(p=>fs.existsSync(path.join(repo,p)));
function fail(msg){console.error("\nABORT:",msg);process.exit(1);}
if(!rel)fail("battle-tactics-geo-mock.html was not found at repository root or forge/");
const target=path.join(repo,rel),geometry=fs.readFileSync(path.join(bundleRoot,"forge/tactics-geometry.js"),"utf8").trim();
let html=fs.readFileSync(target,"utf8");
function bounds(text){
  const endMarker='})(typeof window !== "undefined" ? window : globalThis);';
  const found=[];let from=0;
  while(true){
    const name=text.indexOf("tactics-geometry.js",from);if(name<0)break;
    const iife=text.indexOf(";(function (global)",name);
    const end=iife<0?-1:text.indexOf(endMarker,iife);
    if(iife>=0&&end>=0&&end-name<30000){
      let start=text.lastIndexOf("/* ═",iife);
      if(start<0||start<name-3000)start=text.lastIndexOf("/*",name);
      if(start>=0)found.push({start,end:end+endMarker.length});
    }
    from=name+1;
  }
  const unique=[];found.forEach(q=>{if(!unique.some(x=>x.start===q.start&&x.end===q.end))unique.push(q);});
  if(unique.length!==1)fail("expected exactly one inlined tactics-geometry block, found "+unique.length+"; reconcile the live mock manually");
  return unique[0];
}
const q=bounds(html),current=html.slice(q.start,q.end).trim();
if(current===geometry){console.log(rel+" already contains the Phase 1.5h geometry; no change.");process.exit(0);}
html=html.slice(0,q.start)+geometry+html.slice(q.end);
fs.writeFileSync(target,html);
console.log("Patched",rel,"with canonical Phase 1.5h tactics geometry.");
