#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const root=path.resolve(__dirname,".."),html=fs.readFileSync(path.join(root,"index.html"),"utf8");
let pass=0,fail=0;function ok(label,value){if(value){pass++;console.log("ok "+pass+" - "+label);}else{fail++;console.error("not ok - "+label);}}
function source(name){const at=html.indexOf("function "+name+"(");if(at<0)throw new Error("missing "+name);let brace=html.indexOf("{",at),depth=0,quote=null,esc=false;for(let i=brace;i<html.length;i++){const c=html[i];if(quote){if(esc)esc=false;else if(c==="\\")esc=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==="{")depth++;if(c==="}"&&--depth===0)return html.slice(at,i+1);}throw new Error("unterminated "+name);}

const foeTurn=source("foeTurn"),boot=source("bootSession"),rage=source("useRage"),confirm=source("promptGodGeometryOverride"),preview=source("renderGodPreview");
ok("enemy rolls receive the live reach verdict, including long-range disadvantage",foeTurn.includes("advPreview(u,tgt,Object.assign({kind:\"attack\"},atk),strikeRo)"));
ok("enemy save spells enter the automatic turn runner",foeTurn.includes("atk.kind==='save'")&&html.includes("function foeSaveStrike"));
ok("canonical foe refresh happens before the replay roster is constructed",boot.indexOf("await hydrateRosterStatblocks")<boot.indexOf("var pipelineRoster")&&boot.indexOf("await loadLiveStats()")<boot.indexOf("var pipelineRoster"));
ok("Hexblade fallback and derived roster both carry an authoritative use",html.includes("res:{slot1:3,hexbladeCurse:1}")&&html.includes("cost:{hexbladeCurse:1}"));
ok("God Mode confirmation survives Player View for an overseer",!html.includes("body.forge-player-view #godMoveConfirm")&&preview.includes("sess.me.overseer"));
ok("a blocked shot offers an explicit no-cover DM override",confirm.includes("Allow it with no cover")&&html.includes("geometry_override:!!ro.geometryOverride"));
ok("Wild Surge rolls from subclass identity and attaches a named result",rage.includes("u.featureFlags&&u.featureFlags.wildSurge")&&rage.includes("wild_surge_result:result")&&html.includes("Wild Surge · d8 = "));

if(fail){console.error("\n"+fail+" field-regression checks failed");process.exit(1);}console.log("\n"+pass+" field-regression checks green");
