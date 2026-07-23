#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),FK=require("../forge-kit-derive.js");
let pass=0,fail=0;const ok=(name,cond)=>{cond?pass++:fail++;console.log((cond?"✓ ":"✗ ")+name);};
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const redirect=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");

ok("canonical /forge surface is index.html",html.includes("<title>The Forge — Trials of Kirtas</title>")&&html.includes('id="forgeProductMode"'));
ok("legacy mock route redirects while preserving query and hash",redirect.includes("new URL('./',location.href)")&&redirect.includes("target.search=location.search")&&redirect.includes("target.hash=location.hash"));
ok("Workshop and Table product modes are explicit",html.includes("mode.textContent=SESSION_ID?'Table':'Workshop'")&&html.includes("forge-table-mode"));
ok("active and planned tabs replace disabled prototype controls",html.includes('id="forgeActiveTab"')&&html.includes('id="forgePlannedTab"')&&html.includes('id="forgePlannedPanel"'));
ok("planned roadmap is represented as cards",html.includes("Image-to-Dungeon Import")&&html.includes("Terrain Annotation")&&html.includes("Advanced Visual Profiles"));
ok("bridge controls remain active",html.includes('id="verticalGeometryPanel"')&&html.includes('id="findBridgeSeed"'));
ok("prototype residue is hidden rather than greyed out",html.includes(".prototypeResidue{display:none!important}")&&html.includes('id="heightScaleWrap"')&&html.includes('id="propSel"'));

ok("initiative editor owns the viewport above the HUD",html.includes("body.forge-initiative-open #combatHud{z-index:180}")&&html.includes("#cbInitLobby{z-index:190"));
ok("initiative card scrolls without falling behind the HUD",html.includes("max-height:calc(100dvh - 28px)")&&html.includes("#cbInitLobbyList{overflow:auto"));
ok("initiative uses one compact manual-total entry",html.includes("Roll digitally or enter a final total")&&html.includes("Final initiative total")&&!html.includes("Use d20"));
ok("initiative evidence uses high-contrast presentation",html.includes(".cbInitEvidence{grid-column:1/-1;font:600 12px")&&html.includes("color:#3f3428"));
ok("new derivation cache stamp is present",html.includes("forge-kit-derive.js?v=b12"));

const stale={level:4,proficiencyBonus:2,abilities:{dex:{score:12,mod:1}},features:[{name:"Jack of All Trades"}]};
const joat=FK.initiativeProfileFor(stale,[],{init:1});
ok("Jack of All Trades repairs a stale sheet total",joat.modifier===2&&joat.staticSources.some(s=>s.key==="jack-of-all-trades"&&s.value===1));
ok("recognized initiative features repair stale totals without a false warning",joat.warnings.length===0&&!joat.staticSources.some(s=>s.key==="sheet-remainder"));

ok("foes use direct wall-aware party sight instead of the cleaned terrain mask",html.includes("function discoveryCreatureDisclosure(c,r,sources)")&&html.includes("discoveryCreatureDisclosure(u.c,u.r,discoveryPartySources())"));
ok("distant and reciprocal-sight foes remain visible but soften",html.includes("CREATURE_CLEAR_FT=100")&&html.includes("CREATURE_SOFT_MAX_FT=240")&&html.includes("function foeDisclosure(u)"));
ok("weapon range remains separate from visual recognition",html.includes("weapon range still decides")&&html.includes("a creature\n   does not vanish merely because it is 65 feet away"));

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
