#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"..","topography-test-mock.html"),"utf8");
const rules=fs.readFileSync(path.join(__dirname,"..","forge-combat-rules.js"),"utf8");
const table=fs.readFileSync(path.join(__dirname,"..","forge-table-correctness.js"),"utf8");
let pass=0;function has(src,x,m){if(!src.includes(x))throw Error("FAIL: "+m);console.log("ok",++pass,"-",m);}function lacks(src,x,m){if(src.includes(x))throw Error("FAIL: "+m);console.log("ok",++pass,"-",m);}

has(html,'forge-combat-rules.js?v=fcr3','production surface loads the Phase 1.5g combat-rules seam');
has(html,'forge-table-correctness.js?v=fg5','feed/channel seam is cache-stamped');
has(table,'["table","system","all"]','feed exposes Table, System, and All filters');
has(table,'data-feed-channel','feed rows retain their category');
has(table,'.fg-frow:not([data-feed-channel])','rows that predate decorator installation are retroactively classified');
has(table,'markNewestFeedRow(ch);ensureFeedTabs()','explicit feed-channel options stamp the new row before older rows are inferred');
has(table,'categoryForHtml','automatic feed routing delegates to combat rules');
has(table,'fg-feed-tabs','feed tabs have a dedicated presentation layer');
has(table,'ensureFlowButtons','confirm, undo, and Stand controls share one HUD seam');
has(html,'ForgeTableCorrectness.pushDiagnostic','geometry notices route to the System feed');
has(html,'if(feed!==false&&window.addForgeRow)','combat narration can opt out of duplicate rich rows');

has(rules,'function reduceRollSources','advantage and disadvantage reduce through one source-aware function');
has(rules,'cancelled:adv.length>0&&dis.length>0','any advantage and disadvantage cancel to normal');
has(rules,'function incapacitated','threat eligibility recognizes incapacitating conditions');
has(rules,'"unconscious","paralyzed","stunned","petrified"','downed/incapacitated flank exclusions are explicit');
has(rules,'function isFlanked','flanking is headless and testable');
has(rules,'a.c+b.c===2*target.c','opposite-square geometry is retained at target level');
has(rules,'FLANKING_MODES','shared flanking variants are versioned data');
has(html,'var FLANK_RULE="advantage"','advantage is on by default at this table');
has(html,'envelope.rules={flanking:','new session envelopes persist the shared flanking rule');
has(html,'sceneFlankingRule','Forge menu owns the shared flanking selector');
has(html,'rule:{name:"flanking",value:next}','flanking changes publish as shared edit facts');
has(html,'if(r.kind==="edit")applyRuleRows()','shared flanking changes repaint on every device');
lacks(html,'var FLANKING =','obsolete boolean flanking state is gone');
lacks(html,'FLANKING=!FLANKING','obsolete local-only flanking toggle is gone');
has(html,'flankBonus:av.attackBonus||0','flat +2/+5 flanking is carried as attack math');
has(html,'hitBonus:hitMod','resolved PC attacks repeat the adjusted attack modifier');
has(html,'function netFoeAttack(u,atk,t,hs,adv,dis,hitMod,advReason,flankBonus)','foes use the same source-aware flanking result');

has(rules,'if(hasCondition(attacker,"prone"','Prone gives its attacker disadvantage');
has(rules,'distanceFt<=5','attacks within five feet gain advantage against Prone');
has(rules,'target prone beyond 5 ft','farther attacks gain disadvantage against Prone');
has(html,'id="sceneProneToggle"','staff can apply or clear Prone from the Forge menu');
has(html,'ForgeCombatRules.addCondition','staff Prone edits use a replayable condition effect');
has(html,'effectFor(u,"prone")?Math.floor(CB.st.moveLeft/2)','Prone halves reachable path distance by doubling crawl cost');
has(html,'cost=steps*(effectFor(u,"prone")?2:1)','local crawling spends double movement');
has(html,'move_cost_ft:moveCostFt','shared movement publishes its actual crawl cost');
has(rules,'installReplayMovementCosts','replay economy honors nonstandard movement costs');
has(html,'function standFromProne','Stand is an explicit movement operation');
has(html,'proneStandCostSquares(u.speed)','standing spends half the creature speed');
has(html,'forge:standProne','the BG3 HUD can invoke Stand');
has(html,'aria-label="Prone"','initiative exposes visible Prone state');

has(rules,'function auditKit','class actions are audited through a pure composition layer');
has(table,'ForgeCombatRules.auditKit','every derived or starter kit passes through the class audit');
has(rules,'copyAttackShape(flurry,unarmed,2)','Flurry composes two canonical Unarmed Strikes');
has(rules,'step.kind="monk-step"','Step of the Wind is no longer projected as an attack');
has(rules,'step.choices=["dash","disengage"]','Step of the Wind offers both legal movement choices');
has(rules,'patient.kind="monk-dodge"','Patient Defense projects to Dodge');
has(rules,'harm.kind="monk-rider"','Hand of Harm is held as an explicit post-hit rider rather than a fake attack');
has(html,'function useMonkStep','Step of the Wind has a dedicated resolution flow');
has(html,'function useMonkDodge','Patient Defense creates an enforced Dodge effect');
has(html,'movement_bonus_ft:u.speed','Step Dash publishes its movement increase');
has(html,'if(effectFor(mover,"disengaged"))','Disengage suppresses opportunity attacks');
has(html,'needsAttack:true, cost:{ki:1}','fallback Flurry retains its prerequisite and Ki cost');
has(html,'label:"Unarmed Strike", kind:"attack", rng:1, hit:4, dmg:"1d4+3"','fallback Caim has canonical unarmed math');
has(rules,'function requireDamage','damaging actions fail closed');
has(html,'action refused.</b>','malformed damaging actions narrate a visible refusal');

has(rules,'function tollDamage','Toll the Dead target-state die is pure and testable');
has(html,'/toll the dead/i.test(a.label||"")','local and shared save paths inspect Toll the Dead');
has(html,'ForgeCombatRules.tollDamage(a,t).dmg','Toll reads the target’s current authoritative HP before damage');

has(html,'function directAttack','single-target attack confirmation is an explicit action class');
has(html,'CONFIRM_TARGET=tu.unit','board clicks target without rolling');
has(html,'CONFIRM_TARGET=o.unit','initiative clicks target without rolling');
has(html,'forge-target-confirm','targeting has a distinct pre-resolution presentation state');
has(html,'forge:confirmAttack','the HUD owns the explicit final attack commitment');
has(html,'Move to a valid firing origin or choose another target','confirmation preserves the firing-preview workflow');

has(html,'function myUndoableMove','player move undo is derived from shared history');
has(html,'last.kind!=="move_resolved"','undo is available only while the move is still the latest consequence');
has(html,'another action happened after yours','OA or any later consequence correctly requires DM rewind');
has(html,'sess.pipe.undoMove','player undo publishes an ordinary compensating fact');
has(html,'function playerUndoMode','staff Player View can test the player-side undo experience');
has(html,'sess.me.overseer&&!playerUndoMode(sess)','Staff View keeps DM rewind while staff Player View uses the ordinary player undo rule');
has(table,'fgUndoMove','Undo move has its own contextual HUD control');

has(rules,'categoryForHtml','feed channel classification is headless testable');
has(rules,'effectOp','conditions share the persistent effect ledger rather than a local flag');
has(html,'applyLogEconomy();','refresh overlays replay-derived action and movement economy');
has(html,'refreshEffectState(null,true)','condition display rebuilds from replay facts');
console.log("\n",pass,"Phase 1.5g integration checks green");
