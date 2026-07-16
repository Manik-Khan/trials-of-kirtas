#!/usr/bin/env node
/* Forge correctness wave 4: reaction evidence, replayed next-attack advantage,
   target-level flanking, and pre-roll review. */
"use strict";
const fs=require("fs"),path=require("path");
const F=require("../forge-combat-rules.js");
const R=require("../forge-replay.js");
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log((c?"✓ ":"✗ ")+n);};
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const tc=fs.readFileSync(path.join(root,"forge-table-correctness.js"),"utf8");

ok("reaction modal has a dedicated roll-evidence region",html.includes('id="cbPromptEvidence"')&&html.includes("function reactionEvidenceHtml"));
ok("reaction evidence shows raw d20s and marks kept/dropped dice",html.includes('class="'+"'+(i===kept?'kept':'drop')+")&&html.includes("d20Rolls:hs.d20Rolls"));
ok("Silvery Barbs prompt receives the current attack total and Shield forecast",html.includes("attackTotal:attackTotal")&&html.includes("shieldStops:shieldReady")&&html.includes("Shield is also available"));
ok("Shield prompt explains whether it can stop the current result",html.includes("Shield raises the defense to")&&html.includes("This critical still hits. Shield applies only against later attacks"));
ok("local reaction prompts also include the triggering d20 and defense",html.includes('var evidence="d20 "+raw')&&html.includes("vs defense"));

let st=R.initialState([{unit:"cosmere",side:"pc",pos:{c:0,r:0},hp:20},{unit:"g",side:"foe",pos:{c:1,r:0},hp:7}]);
R.applyEvent(st,{seq:1,unit:"liadan",kind:"prompt_answered",payload:{prompt_seq:99,use:true,effects:[{unit:"cosmere",grant_advantage:true,grant_reason:"silvery barbs"}]}});
// A stale answer is intentionally inert, so use an ordinary effect-bearing ability fact
R.applyEvent(st,{seq:2,unit:"liadan",kind:"ability_used",payload:{slot:"free",effects:[{unit:"cosmere",grant_advantage:true,grant_reason:"silvery barbs"}]}});
ok("replay stores Silvery Barbs advantage on the chosen beneficiary",st.units.cosmere.advGrant&&st.units.cosmere.advGrant.reason==="silvery barbs");
R.applyEvent(st,{seq:3,unit:"cosmere",kind:"attack_resolved",payload:{target:"g",hit:false,slot:"action"}});
ok("the next resolved attack consumes the replayed advantage grant",st.units.cosmere.advGrant===null);
ok("browser reconciliation copies advGrant and reactionUsed from replay state",html.includes("function reconcileSharedUnitFacts")&&html.includes("cu.advGrant=su.advGrant")&&html.includes("cu.reacted=!!su.reactionUsed"));
ok("cold boot and every event pass through the shared-unit reconciliation door",html.includes("reconcileSharedUnitFacts(st);")&&html.includes("reconcileSharedUnitFacts(pipe.state());"));
ok("local rewind preserves a next-attack grant",html.includes("advGrant:u.advGrant?JSON.parse")&&html.includes("u.advGrant=su.advGrant?JSON.parse"));

const A={id:"a",side:"pc",c:0,r:1,alive:true},T={id:"t",side:"foe",c:1,r:1,alive:true},B={id:"b",side:"pc",c:2,r:1,alive:true},C={id:"c",side:"pc",c:1,r:0,alive:true};
ok("a third attacker joins a target-level flank",F.isFlanked(C,T,[A,B,C,T],null,()=>true));
ok("advantage mode grants the joining attacker advantage",F.attackRollSources({attacker:C,target:T,action:{kind:"attack",rng:1},distanceFt:5,flanked:F.isFlanked(C,T,[A,B,C,T],null,()=>true),flankingMode:"advantage"}).advantage);
ok("plus-five mode grants the joining attacker +5",F.attackRollSources({attacker:C,target:T,action:{kind:"attack",rng:1},distanceFt:5,flanked:F.isFlanked(C,T,[A,B,C,T],null,()=>true),flankingMode:"plus5"}).attackBonus===5);
ok("a target without an opposite threatening pair is not flanked",!F.isFlanked(C,T,[C,{...A,c:0,r:0},T],null,()=>true));

ok("attack confirmation computes an automatic pre-roll review",html.includes("function attackRollReview")&&html.includes("Bless 1d4")&&html.includes("rollReview:rollReview"));
ok("HUD decorator renders the roll review before Confirm attack",tc.includes("fgRollReview")&&tc.includes("state.rollReview")&&tc.includes("Roll review · "));
ok("cache stamps load the new rules and HUD decorator",html.includes("forge-combat-rules.js?v=fcr3")&&html.includes("forge-table-correctness.js?v=fg7"));

console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
