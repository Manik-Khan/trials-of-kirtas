#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),D=require("../forge-death-saves.js"),FR=require("../forge-replay.js"),FB=require("../forge-board.js");
let pass=0;function ok(v,label){if(!v)throw new Error("FAIL: "+label);console.log("ok",++pass,"-",label);}
ok(D.VERSION==="1.0.0","authority version is pinned");
ok(D.resolve({},9).failures===1,"a roll below 10 fails");
ok(D.resolve({},10).successes===1,"a roll of 10 succeeds");
ok(D.resolve({failures:1},1).dead,"natural 1 adds two failures and can kill");
let ds=D.resolve({successes:2},14);ok(ds.stable&&ds.successes===3,"three successes stabilize");
ds=D.resolve({successes:2,failures:2},20);ok(ds.reviveHp===1&&!ds.stable&&!ds.dead,"natural 20 restores 1 HP and clears saves");
const roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:10},{unit:"gob",side:"foe",pos:{c:2,r:1},hp:7}];
const row=(seq,unit,kind,payload)=>({seq,unit,kind,payload:payload||{}});
let st=FR.replayLog(roster,[row(1,"__session","session_started"),row(2,"__session","initiative_set",{order:["caim","gob"]}),row(3,"gob","attack_resolved",{target:"caim",hit:true,dmg:10}),row(4,"caim","ability_used",{ability:"Death Saving Throw",targets:["caim"],slot:"free",context:{kind:"death-save",roll:8,successes:0,failures:1,stable:false,dead:false}})]);
ok(st.units.caim.downed&&st.units.caim.deathSaves.failures===1,"death-save facts replay onto a downed PC");
st=FR.replayLog(roster,[row(1,"__session","session_started"),row(2,"__session","initiative_set",{order:["caim","gob"]}),row(3,"gob","attack_resolved",{target:"caim",hit:true,dmg:10}),row(4,"caim","ability_used",{ability:"Death Saving Throw",targets:["caim"],slot:"free",effects:[{unit:"caim",heal:1}],context:{kind:"death-save",roll:20,successes:0,failures:0,stable:false,dead:false}})]);
ok(!st.units.caim.downed&&st.units.caim.hp===1,"natural-20 heal revives deterministically on replay");
st.units.caim.hp=0;st.units.caim.downed=true;st.units.caim.deathSaves={successes:3,failures:0,stable:true,dead:false};
ok(FB.settledPcSkip(st)==="caim","stable PC initiative seats are skippable");
st.units.caim.deathSaves={successes:1,failures:1,stable:false,dead:false};
ok(FB.settledPcSkip(st)===null,"an unresolved downed PC keeps the seat to roll");
st=FR.replayLog([{unit:"liadan",side:"pc",pos:{c:1,r:1},hp:31,resources:{slot1:0,bardicInspiration:0}}],[row(1,"__session","session_started"),row(2,"__session","edit",{changes:[{unit:"liadan",resources:{slot1:4,bardicInspiration:2}}]})]);
ok(st.units.liadan.resources.slot1===4&&st.units.liadan.resources.bardicInspiration===2,"GOD MODE resource edits replay authoritatively");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8"),hud=fs.readFileSync(path.join(__dirname,"..","forge-hud.js"),"utf8");
ok(html.includes('forge-death-saves.js?v=fds1')&&html.includes('function rollDeathSave()'),"the production Forge loads and wires death saves");
ok(hud.includes('id="fgDeathSave"')&&hud.includes('Unconscious · death saving throw'),"the real HUD replaces downed actions with the death-save control");
ok(html.includes('function godRestoreResources()')&&html.includes('data-restore'),"GOD MODE exposes tracked resource restoration");
ok(html.includes('discoveryCreatureDisclosure(u.c,u.r,discoveryPartySources())'),"Player View disclosure considers every conscious party sightline");
ok(html.includes('effectKind:"hex-transfer"')&&html.includes('effectKind==="hexblade-curse"'),"Hex transfer and Hexblade's Curse reach the production action path");
console.log("\n"+pass+" death-save checks green");
