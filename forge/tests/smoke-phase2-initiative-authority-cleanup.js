#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const FK=require("../forge-kit-derive.js"),FI=require("../forge-initiative.js");
let pass=0,fail=0;const ok=(name,cond)=>{cond?pass++:fail++;console.log((cond?"✓ ":"✗ ")+name);};
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const liadan=JSON.parse(fs.readFileSync(path.join(root,"..","data","characters","liadan.json"),"utf8"));liadan.key="liadan";
const kit=FK.derive(liadan,{});

ok("Liadan canonical initiative is +2",kit.init===2&&kit.initiativeProfile.modifier===2);
ok("Liadan initiative is DEX +1 plus Jack of All Trades +1",kit.initiativeProfile.staticSources.some(s=>s.key==="dexterity"&&s.value===1)&&kit.initiativeProfile.staticSources.some(s=>s.key==="jack-of-all-trades"&&s.value===1));
ok("Liadan initiative profile has no invented remainder",!kit.initiativeProfile.staticSources.some(s=>s.key==="sheet-remainder"));
ok("Liadan initiative profile has no false sheet warning",(kit.initiativeProfile.warnings||[]).length===0);

const staleUnit={unit:"liadan",name:"Líadan",initMod:1,initiativeProfile:kit.initiativeProfile};
const profile=FI.profile(staleUnit,{});
ok("component profile outranks stale live initMod",profile.staticTotal===2);
ok("stale live initMod cannot manufacture a negative bonus",!profile.staticSources.some(s=>s.key==="sheet-remainder"&&s.value<0));
const evidence=FI.resolve(profile,{rng:()=>12});
ok("initiative roll uses the canonical +2",evidence.total===14&&evidence.d20===12&&evidence.staticTotal===2);
ok("component text stays clean",FI.componentText(evidence)==="d20 12 · DEX +1 · Jack of All Trades +1 · = 14");

ok("fallback combat kit uses Liadan +2",html.includes('liadan:{ name:"Líadan", hp:31, ac:12, speed:30, init:2'));
ok("party staging card uses Liadan +2",html.includes('name:"Líadan Luchóg",    cls:"Bard 3 / Cleric 1",     epi:"Entertainer",         hp:24, max:31, ac:12,   init:2'));
ok("initiative scripts carry fresh cache stamps",html.includes('forge-initiative.js?v=fi2')&&html.includes('forge-kit-derive.js?v=b9'));
ok("modal previews evidence before the network echo",html.includes('var __initPreview = {}')&&html.includes('__initPreview[unitKey]=evidence'));
ok("initiative math is rendered in the bright modal",html.includes('evidence=__initPreview[k]||(st.initiativeEvidence&&st.initiativeEvidence[k])')&&html.includes('.cbInitEvidence>span:first-child{font-weight:700'));
ok("local duplicate initiative narration is gone",!html.includes("clog('<i>Initiative — "));

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
