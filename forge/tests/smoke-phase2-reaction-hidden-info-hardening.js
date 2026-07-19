#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("path");
const R=require("../forge-replay.js");
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log((c?"✓ ":"✗ ")+n);};
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const derive=fs.readFileSync(path.join(root,"forge-kit-derive.js"),"utf8");
const replay=fs.readFileSync(path.join(root,"forge-replay.js"),"utf8");

ok("reaction spells carry a minimum slot level instead of only a fixed slot1 convention",derive.includes("spellSlotLevel: def.slotLevel")&&html.includes("spellSlotLevel:1, spell:true"));
ok("reaction readiness searches all eligible higher-level spell slots",html.includes("function reactionSpendPlan")&&html.includes("castableSpellSources(u,min)")&&html.includes("function reactReady(u,key)"));
ok("wire reaction readiness reads replay-authoritative resources",html.includes("res:normalizeResourceRecord(su.resources||ku.res||{})"));
ok("reaction answers publish an idempotent resource spend",html.includes("extra.resource_spend=spendPlan.spend")&&html.includes("reactionSpendIdFor(u,prompt.react,prompt.seq)"));
ok("replay applies resource spending from prompt answers",replay.includes("if (p.use) applyResourceSpend(state, row.unit, p.resource_spend, p.resource_spend_id)"));

let st=R.initialState([{unit:"liadan",side:"pc",pos:{c:0,r:0},hp:31,resources:{slot1:0,slot2:2}}]);
R.applyEvent(st,{seq:1,unit:"__session",kind:"prompt",payload:{to:"liadan",react:"silveryBarbs",timeout:20}});
R.applyEvent(st,{seq:2,unit:"liadan",kind:"prompt_answered",payload:{prompt_seq:1,use:true,reaction_kind:"silveryBarbs",resource_spend:{slot2:1},resource_spend_id:"reaction:liadan:silveryBarbs:1"}});
ok("Silvery Barbs can authoritatively spend a second-level slot",st.units.liadan.resources.slot1===0&&st.units.liadan.resources.slot2===1);
R.applyEvent(st,{seq:3,unit:"__session",kind:"prompt",payload:{to:"liadan",react:"silveryBarbs",timeout:20}});
R.applyEvent(st,{seq:4,unit:"liadan",kind:"prompt_answered",payload:{prompt_seq:3,use:true,reaction_kind:"silveryBarbs",resource_spend:{slot2:1},resource_spend_id:"reaction:liadan:silveryBarbs:1"}});
ok("duplicate reaction spend identifiers cannot double-spend",st.units.liadan.resources.slot2===1);

ok("critical Shield copy says the current natural 20 still hits",html.includes("This natural 20 still hits")&&html.includes("Cast for later attacks"));
ok("critical Shield remains available for protection against later attacks",html.includes("if(shieldReady)cands.push")&&html.includes("This critical still hits. Shield applies only against later attacks"));
ok("Silvery Barbs prompt explains Shield cannot stop the critical",html.includes("Shield is also available only for later attacks; it cannot stop this critical hit."));
ok("player roll review omits exact enemy defense",html.includes("hideDefense=!!(discoveryPlayerView()&&t.side==='foe')")&&html.includes("if(!hideDefense)parts.push(\"vs defense \"+defense)"));
ok("reaction evidence redacts exact enemy defense in player presentation",html.includes("hideDefense=!!(discoveryPlayerView()&&target&&target.side==='foe')")&&html.includes("(hideDefense?'':' vs defense '+escapeHtml(defense))"));
ok("player-view event copies strip defense fields while authoritative rows remain intact",html.includes("function redactEnemyDefenseEvent")&&html.includes("delete p.targetAC")&&html.includes("redactEnemyDefenseEvent(viewerFeedEvent(r))"));
ok("cache stamps load the hardened replay, derivation, and presentation files",html.includes("forge-replay.js?v=fb14")&&html.includes("forge-kit-derive.js?v=b10")&&html.includes("forge-table-correctness.js?v=fg8"));

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
