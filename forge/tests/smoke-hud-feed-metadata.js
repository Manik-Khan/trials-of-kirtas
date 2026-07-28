#!/usr/bin/env node
"use strict";
const fs=require("fs"),vm=require("vm"),path=require("path");
let pass=0;
function ok(value,label){if(!value)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}

const body={innerHTML:""};
const document={
  getElementById(id){return id==="fgFeedBody"?body:null;},
  addEventListener(){},
  createElement(){return {style:{},appendChild(){},addEventListener(){}};},
  head:{appendChild(){}},
  body:{appendChild(){}}
};
const window={document};
const ctx={window,document,console,CustomEvent:function(){},setTimeout,clearTimeout};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,"..","forge-hud.js"),"utf8"),ctx);

ok(typeof window.addForgeRow==="function","real HUD feed writer loads");
window.addForgeRow("<i>Hidden tactic</i>",{channel:"system",visibility:"staff"});
ok(body.innerHTML.includes('data-feed-channel="system"'),"system channel is stored in the feed model");
ok(body.innerHTML.includes('data-feed-visibility="staff"'),"staff visibility is stored in the feed model");
window.addForgeRow("<b>Public attack</b>",{channel:"table"});
ok((body.innerHTML.match(/data-feed-visibility="staff"/g)||[]).length===1,
  "a later repaint preserves the older staff-only marker");
ok(body.innerHTML.indexOf("Public attack")<body.innerHTML.indexOf("Hidden tactic"),
  "newest feed row remains first");

console.log("\n"+pass+" HUD feed-metadata checks green");
