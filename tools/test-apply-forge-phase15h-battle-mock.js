#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),cp=require("child_process");
const here=path.resolve(__dirname),bundle=path.resolve(here,".."),tmp=fs.mkdtempSync(path.join(os.tmpdir(),"forge15h-sync-"));
const geo=fs.readFileSync(path.join(bundle,"forge/tactics-geometry.js"),"utf8").trim();
const old=geo.replace("var BODY_LEVELS = [0.75, 2.75, 4.75];","var BODY_LEVELS = [0.5, 5]; /* old fixture */");
if(old===geo)throw Error("fixture mutation anchor not found");
const fixture='<!doctype html><script>/* reference wrapper */\n'+old+'\n</script><p>untouched</p>';
fs.writeFileSync(path.join(tmp,"battle-tactics-geo-mock.html"),fixture);
cp.execFileSync(process.execPath,[path.join(here,"apply-forge-phase15h-battle-mock.js"),tmp],{stdio:"inherit"});
const out=fs.readFileSync(path.join(tmp,"battle-tactics-geo-mock.html"),"utf8");
function ok(v,m){if(!v)throw Error(m);}
ok(out.includes(geo),"canonical replacement missing");ok(out.includes("<p>untouched</p>"),"content outside geometry changed");ok(!out.includes("old fixture"),"old geometry survived");
console.log("battle mock geometry sync fixture green");fs.rmSync(tmp,{recursive:true,force:true});
