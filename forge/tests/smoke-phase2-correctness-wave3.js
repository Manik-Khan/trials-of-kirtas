/* Phase 2 correctness-wave 3 + bridge state smokes · 2026-07-15
   Run: node forge/tests/smoke-phase2-correctness-wave3.js */
"use strict";
const fs=require("fs"),path=require("path");
const R=require("../forge-replay.js");
const D=require("../forge-discovery.js");
const TG=require("../tactics-geometry.js");
const K=require("../forge-kit-derive.js");
const FB=require("../forge-bus.js");
const FP=require("../forge-pipeline.js");
let pass=0,fail=0;const ok=(n,c)=>{c?pass++:fail++;console.log((c?"✓ ":"✗ ")+n);};
const row=(seq,unit,kind,payload)=>({seq,unit,kind,payload:payload||{},created_at:seq});

(async()=>{
  ok("kind-only foe rows normalize to hostile side",R.initialState([{unit:"g",kind:"foe",pos:{c:0,r:0},hp:5}]).units.g.side==="foe");
  ok("monster and hostile aliases normalize to foe",["monster","enemy","hostile","npc-hostile"].every(x=>R.canonicalSide(x)==="foe"));
  ok("unknown and PC aliases remain player side",R.canonicalSide("pc")==="pc"&&R.canonicalSide("hero")==="pc");
  let st=R.initialState([{unit:"p",kind:"pc",pos:{c:0,r:0},hp:5}]);
  R.applyEvent(st,row(1,"__session","edit",{changes:[{add_unit:{unit:"m",kind:"monster",pos:{c:1,r:0},hp:4}}]}));
  ok("reinforcement kind is normalized by replay authority",st.units.m.side==="foe");

  st=R.initialState([{unit:"p",side:"pc",pos:{c:0,r:0},hp:5},{unit:"g",side:"foe",pos:{c:1,r:0},hp:5}]);
  R.applyEvent(st,row(1,"p","prompt",{to:"g",react:"opportunityAttack",timeout:20}));
  R.applyEvent(st,row(2,"g","prompt",{to:"p",react:"shield",timeout:20}));
  ok("replay preserves nested prompt depth",st.pendingPrompts.length===2&&st.pendingPrompt.seq===2);
  R.applyEvent(st,row(3,"p","prompt_answered",{prompt_seq:2,use:true,reaction_kind:"shield"}));
  ok("answering nested prompt restores the outer prompt",st.pendingPrompts.length===1&&st.pendingPrompt.seq===1);
  R.applyEvent(st,row(4,"g","prompt_answered",{prompt_seq:1,use:true,reaction_kind:"opportunityAttack"}));
  ok("answering outer prompt clears the stack",st.pendingPrompts.length===0&&st.pendingPrompt===null);

  st=R.initialState([{unit:"p",side:"pc",pos:{c:0,r:0},hp:5}]);
  R.applyEvent(st,row(1,"__session","edit",{changes:[{connector_state:{id:"bridge-a",state:"closed"}}]}));
  ok("connector state is a replay fact",st.connectorStates["bridge-a"]==="closed");
  R.applyEvent(st,row(2,"__session","edit",{changes:[{connector_state:{id:"bridge-a",state:"nonsense"}}]}));
  ok("invalid connector states are ignored",st.connectorStates["bridge-a"]==="closed");

  const liadan=JSON.parse(fs.readFileSync(path.join(__dirname,"../../data/characters/liadan.json"),"utf8")),lk=K.derive(liadan,{});
  ok("Liadan's live sheet contains Silvery Barbs",liadan.structural.spells["1"].some(s=>s.name==="Silvery Barbs"));
  ok("Forge derives Silvery Barbs with its slot and range",lk.react.silveryBarbs&&lk.react.silveryBarbs.cost.slot1===1&&lk.react.silveryBarbs.range===12);

  const m=TG.makeMap(5,3),idx=(c,r)=>r*5+c;m.occ=new Array(15).fill(0);m.wall[idx(2,1)]=true;m.occ[idx(2,1)]=10;
  let vis=D.visibleFrom(m,{c:0,r:1},TG,{radiusFt:30});
  ok("high wall hides cells beyond it",vis[D.idx(m,3,1)]===0&&vis[D.idx(m,4,1)]===0);
  ok("blocking wall face itself is discoverable",vis[D.idx(m,2,1)]===1);
  m.wall[idx(2,1)]=false;m.occ[idx(2,1)]=0;vis=D.visibleFrom(m,{c:0,r:1},TG,{radiusFt:30});
  ok("doorway opening reveals the straight sight lane",vis[D.idx(m,4,1)]===1);

  const bm=TG.makeMap(5,1);bm.wall.fill(true);bm.h.fill(0);bm.connectors=[{id:"b",kind:"bridge",state:"open",path:[{c:0,r:0,elevationFt:0},{c:1,r:0,elevationFt:0},{c:2,r:0,elevationFt:0},{c:3,r:0,elevationFt:0},{c:4,r:0,elevationFt:0}]}];
  ok("open bridge authorizes movement",TG.stepAllowed(bm,{speed:30},0,0,1,0));
  bm.connectors[0].state="closed";ok("closed bridge path refuses entry",!TG.stepAllowed(bm,{speed:30},0,0,1,0));
  bm.connectors[0].state="broken";ok("broken bridge path refuses entry",!TG.stepAllowed(bm,{speed:30},0,0,1,0));

  const root=path.join(__dirname,".."),html=fs.readFileSync(path.join(root,"topography-test-mock.html"),"utf8"),pipeSrc=fs.readFileSync(path.join(root,"forge-pipeline.js"),"utf8"),boardSrc=fs.readFileSync(path.join(root,"forge-board.js"),"utf8");
  ok("downed units keep a universal recovery shard",html.includes("function makeDownedMarker")&&html.includes("OctahedronGeometry")&&html.includes("recovery shard"));
  ok("downed sprite and top token remain dimmed",html.includes("u.sprite.material.opacity=down?.34:1")&&html.includes("u.topToken.material.opacity=down?.44:1"));
  ok("true despawn uses the force-removal door",html.includes('case "despawn":if(u){ removeToken(u,true)'));
  ok("downed marker motion respects reduced-motion",html.includes("if(!REDUCED){m.rotation.y")&&html.includes("else{m.rotation.y=0"));
  ok("OA and Silvery Barbs compare canonical sides",html.includes("function stateSideOf")&&html.includes("stateSideOf(state,k)===stateSideOf(state,mover)")&&html.includes("stateSideOf(state,k)===aSide"));
  ok("reaction answers name their rule explicitly",html.includes("reaction_kind:prompt.react")&&html.includes("pl.reaction_kind"));
  ok("multiplayer OA resolves through the ordinary nested attack pipeline",html.includes("function resolveOpportunityAttackPrompt")&&html.includes("sess.pipe.attack(u.unit,declared")&&html.includes("declareReaction"));
  ok("pipeline tracks multiple nested waits",pipeSrc.includes("awaitingTokens = []")&&pipeSrc.includes("promise.awaitingToken=token"));
  ok("board restores an outer prompt after nested answer",boardSrc.includes('before.pendingPrompt.seq !== after.pendingPrompt.seq')&&boardSrc.includes('{ t: "prompt", prompt: after.pendingPrompt }'));
  ok("bridge state controls are active and replay-backed",html.includes('id="bridgeStateList"')&&html.includes("connector_state:{id:id,state:next}")&&html.includes("applyConnectorStateReplay"));
  ok("closed and broken bridges render without a false physical deck",html.includes("function renderUnavailableBridgeConnector")&&html.includes("LineDashedMaterial")&&html.includes("clearVerticalConnectorRenderGroup"));
  ok("cache stamps identify the wave-three runtime",html.includes("forge-replay.js?v=fb11")&&html.includes("forge-discovery.js?v=fd5")&&html.includes("forge-pipeline.js?v=fb7")&&html.includes("forge-board.js?v=fb7"));

  // Same-device nested wait: overseer moves a unit, answers the OA as a foe,
  // then handles Shield during the nested attack before resuming movement.
  const roster=[{unit:"caim",side:"pc",pos:{c:0,r:0},hp:20,reacts:["shield"]},{unit:"goblin",side:"foe",pos:{c:1,r:0},hp:8,reacts:["oa"]}];
  const bus=FB.makeMemoryBus({controllers:{},overseer:"dm",now:()=>1});let p,maxDepth=0;
  const reactions=(state,declared,answers)=>{
    if(declared.kind==="move_declared"&&!answers.length&&!state.units.goblin.reactionUsed)return[{to:"goblin",react:"opportunityAttack",context:{mover:"caim",target:"caim"}}];
    if(declared.kind==="attack_declared"&&!answers.length&&!state.units.caim.reactionUsed)return[{to:"caim",react:"shield",context:{attacker:"goblin"}}];
    return[];
  };
  p=FP.makePipeline({conn:bus.connect("dm"),roster,me:{actor:"dm",units:[],overseer:true},reactions,
    onEvent:(r,state)=>{maxDepth=Math.max(maxDepth,(state.pendingPrompts||[]).length);},
    onPrompt:r=>setTimeout(async()=>{
      if(r.payload.react==="opportunityAttack"){
        await p.declareReaction("goblin","opportunityAttack",r.seq,{});
        await p.attack("goblin",{target:"caim",roll:18,hit:true},ans=>({hit:!(ans[0]&&ans[0].payload.use),dmg:6,slot:"free"}));
        await p.answerPrompt("goblin",r.seq,true,{reaction_kind:"opportunityAttack"});
      }else if(r.payload.react==="shield")await p.answerPrompt("caim",r.seq,true,{reaction_kind:"shield",hit:false});
    },0)});
  await p.start();await p.setInitiative(["caim","goblin"]);
  await p.move("caim",[{c:1,r:0},{c:2,r:0}],()=>({final_cell:{c:2,r:0},path:[{c:1,r:0},{c:2,r:0}]}));
  ok("same pipeline can pause outer OA and nested Shield without deadlock",maxDepth===2&&p.state().pendingPrompt===null&&p.state().units.caim.hp===20);
  ok("both nested reactions spend exactly one reaction",p.state().units.goblin.reactionUsed&&p.state().units.caim.reactionUsed);

  console.log(`\n${pass} passed, ${fail} failed`);process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
