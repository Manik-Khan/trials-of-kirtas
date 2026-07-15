#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8");
const patch=require(path.join(root,"patch-phase2b1-field-round.js"));
let pass=0;function ok(v,l){if(!v)throw new Error("FAIL: "+l);console.log("ok",++pass,"-",l);}function has(t,n,l){ok(t.includes(n),l);}

has(html,'id="psPreview">Inspect map','authoring preview is reachable before local combat');
has(html,'id="psReturn"','authoring preview has a return door to party selection');
has(html,'window.__forgeVerticalScale.setAuthoring','preview exposes the otherwise-covered vertical inspection control');
has(html,'if(window.__forgeSession) applyLogEconomy(); // echoed log already owns this spend','session move echo does not subtract movement twice');
has(html,'drawHi(); renderHud(); // beginTurn painted the full budget','refresh repaints the reconciled movement budget');
ok(!html.includes("Entering the fight\\u2026"),'claim success no longer auto-enters after the first character');
has(html,'Choose another character or press Enter the fight.','claim screen remains open for multiple characters');
has(html,'function coverContestAvailable()','cover-contest visibility is geometry-aware');
ok(html.includes('coverContestAvailable:coverContestAvailable()')||html.includes('coverContestAvailable:contestAvailable'),'Forge bar receives the cover gate');
has(html,'CONTEST_COVER&&Number.isFinite(ro.cover)&&ro.cover>0','stale/no-cover contest toggles cannot pause a clear shot');
has(html,'function rollActionDamage(a,crit,extras)','attack resolution emits component damage evidence');
has(html,'dmgParts:damage?damage.parts:null','shared attack facts carry damage components');
has(html,'dmgParts:damage.parts','local attack facts carry damage components');
ok(/\.\.\/weapon-actions\.js\?v=fg(?:3|2e1|2f)/.test(html),'weapon-action import is cache-busted');
has(html,'forge-kit-derive.js?v=b3','kit derivation cache stamp bumped');
has(html,'forge-feed-render.js?v=b3','feed renderer cache stamp bumped');
has(html,'forge-table-correctness.js?v=fg2','table-correctness cache stamp bumped');
ok(html.indexOf('var DISCOVERY_RENDER={') < html.indexOf('resize(); rebuild();'),'discovery renderer still initializes before the first terrain build');
ok(html.indexOf('var SESSION_ID') < html.indexOf('resize(); rebuild();'),'session id still initializes before the first terrain build');

const wf=`function hasFeature(structural, frag) { return (structural.features || []).some(function (f) { return String((f && f.name) || f || '').toLowerCase().indexOf(frag) !== -1; }); } function weaponProfList(structural) { return []; } function x(){ var dmgB=0; function deck(id, lbl, dice) { var a={}; a.dmgBonus = dmgB; return a; } var a2h=deck('wpn-' + key + '-2h', label + ' (Two-Handed)', w.dmg2); } var atkB = (+item.atkBonus) || 0, dmgB = (+item.dmgBonus) || 0; var act={};`;
const wp=patch.patchWeaponActions(wf);
has(wp,"function duelingBonus(structural",'patcher derives Dueling from the character fighting style');
has(wp,"a.dmgBonus = dmgB + duelingBonus",'one-handed weapon actions receive Dueling');
has(wp,"w.dmg2, true",'versatile two-handed mode is excluded from Dueling');
has(wp,"dmgB += duelingBonus(structural, w, false)",'weapon cantrips inherit one-handed Dueling');

const kf=`function _dedupeKey(label) { return String(label || "").toLowerCase().replace(/\\u2019/g, "'").replace(/\\s+/g, " ").trim(); } function d(){ w._folded = w._folded || []; w._folded.push(t._src || t); }`;
const kp=patch.patchKitDerive(kf);
has(kp,'return "booming blade"','derived Booming Blade and legacy label share one dedupe key');
has(kp,'w._derivedId=w.id','derived math preserves the saved legacy default-slot id');

const tf=`return {heal:p.heal,dmg:p.dmg,narration:null};return {dmg:p.dmg,adv:true};var show=!!(state&&state.pending&&state.pending.kind==="attack"&&!state.suppressEnemyHud);`;
const tp=patch.patchTableCorrectness(tf);
has(tp,'dmgParts:p.dmgParts||null','table facts preserve damage components');
has(tp,'state.coverContestAvailable','headless Forge-bar button obeys the geometry cover gate');
const fp=patch.patchFeedRender('.ffr-dmg-detail { display:none; margin:2px }');
has(fp,'.ffr-dmg-detail { display:block;','damage arithmetic is visible without a hidden tap target');

// Parse all executable inline scripts. Strip ESM imports for vm.Script syntax validation.
const scripts=[...html.matchAll(/<script(?:\s+type="([^"]+)")?[^>]*>([\s\S]*?)<\/script>/g)]
  .filter(m=>!m[0].includes('type="importmap"')&&m[2].trim());
ok(scripts.length===3,'production HTML still has three executable inline scripts');
scripts.forEach((m,i)=>{let code=m[2];if(m[1]==='module')code=code.replace(/^import .*;$/mg,'');new vm.Script(code,{filename:'inline-'+i+'.js'});});
ok(true,'all executable inline scripts parse');

console.log("\n"+pass+" Phase 2b.1 field-round checks green");
