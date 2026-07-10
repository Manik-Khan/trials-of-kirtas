/* Known-answer smokes for the Battle Forge event protocol (FORGE_PROTOCOL.md).
   CommonJS so the modules' own require() chains resolve.
   Run: node forge/tests/smoke-protocol.js */
const FP = require("../forge-protocol.js");
const FR = require("../forge-replay.js");

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + n); };

// ── §2: the vocabulary is exactly 17 kinds, and there is no turn_started ──
ok("17 event kinds", FP.KINDS.length === 17);
ok("no turn_started (derived, spec §2)", FP.KINDS.indexOf("turn_started") < 0);
ok("all spec kinds present", ["session_started","initiative_rolled","initiative_set",
  "turn_ended","move_declared","move_resolved","attack_declared","attack_resolved",
  "ability_used","prompt","prompt_answered","reaction_declared","chat",
  "override","restore","edit","session_ended"].every(k => FP.KINDS.indexOf(k) >= 0));

// ── envelope validation narrates its failures ──
ok("unknown kind rejected, named",
  FP.validateEvent(FP.makeEvent("caim", "teleported", {})).why.indexOf("teleported") >= 0);
ok("missing unit rejected", FP.validateEvent({ kind: "chat", payload: { text: "hi" } }).ok === false);
ok("missing payload field rejected, named",
  FP.validateEvent(FP.makeEvent("caim", "attack_declared", { target: "foe1" })).why.indexOf("roll") >= 0);
ok("valid event passes", FP.validateEvent(FP.makeEvent("caim", "chat", { text: "hi" })).ok === true);
ok("overseer-only kinds flagged", !!(FP.OVERSEER_ONLY.override && FP.OVERSEER_ONLY.restore &&
  FP.OVERSEER_ONLY.edit && FP.OVERSEER_ONLY.initiative_set));

// ── the bus: MemoryBus mirrors the §1 identity gate ──
const FB = require("../forge-bus.js");
const mkBus = (status) => FB.makeMemoryBus({
  controllers: { "u-alice": ["cosmere"], "u-bob": ["caim"] },
  overseer: "u-dm", status: status || "active", now: () => 1000
});

let bus = mkBus();
const alice = bus.connect("u-alice"), dm = bus.connect("u-dm");
ok("you may write for your own unit",
  alice.publish(FP.makeEvent("cosmere", "chat", { text: "hi" })).ok === true);
const rej = alice.publish(FP.makeEvent("caim", "chat", { text: "imposter" }));
ok("identity gate rejects another's unit, narrated", rej.ok === false && /identity/.test(rej.why));
ok("overseer writes for any unit", dm.publish(FP.makeEvent("goblin1", "attack_declared",
  { target: "caim", roll: 11, mode: "melee" })).ok === true);
ok("overseer-only session events pass via the same gate",
  dm.publish(FP.makeEvent("__session", "edit", { changes: [] })).ok === true &&
  alice.publish(FP.makeEvent("__session", "edit", { changes: [] })).ok === false);
const cheat = alice.publish(FP.makeEvent("cosmere", "edit", { changes: [{ unit: "goblin1", hp: 0 }] }));
ok("GOD MODE by a player is refused even for their own unit", cheat.ok === false && /overseer-only/.test(cheat.why));
ok("player override refused the same way",
  alice.publish(FP.makeEvent("cosmere", "override", { corrects_seq: 1, correction: {} })).ok === false);
ok("invalid envelope never reaches the log",
  alice.publish(FP.makeEvent("cosmere", "prompt", { to: "caim" })).ok === false);

bus.setStatus("ended");
ok("inactive session rejects writes",
  alice.publish(FP.makeEvent("cosmere", "chat", { text: "late" })).ok === false);

// ordering + fan-out + catch-up
bus = mkBus();
const c1 = bus.connect("u-alice"), c2 = bus.connect("u-bob");
const seen = [];
c2.subscribe(r => seen.push(r.seq));
const s1 = c1.publish(FP.makeEvent("cosmere", "chat", { text: "one" })).seq;
const s2 = c2.publish(FP.makeEvent("caim", "chat", { text: "two" })).seq;
ok("seq is insert order", s2 === s1 + 1);
ok("subscribers see every row in order", seen.join(",") === s1 + "," + s2);
ok("fetchAll returns the whole log with actor stamped",
  c1.fetchAll().length === 2 && c1.fetchAll()[0].actor === "u-alice");
ok("rows carry created_at from the injected clock", c1.fetchAll()[0].created_at === 1000);

// re-entrant publish: a subscriber that publishes from its callback must not reorder delivery
bus = mkBus();
const cA = bus.connect("u-alice"), cB = bus.connect("u-bob");
const seqOrder = [];
let reacted = false;
cA.subscribe(r => { if (!reacted) { reacted = true; cA.publish(FP.makeEvent("cosmere", "chat", { text: "reply" })); } });
cB.subscribe(r => seqOrder.push(r.seq));
cA.publish(FP.makeEvent("cosmere", "chat", { text: "first" }));
ok("re-entrant publish keeps seq order for every subscriber", seqOrder.join(",") === "1,2");

// ── the pipeline: two clients play a mini-fight over the memory bus ──
const FPipe = require("../forge-pipeline.js");
const tick = () => new Promise(r => setTimeout(r, 0));
const ROSTER = [
  { unit: "caim",    side: "pc",  pos: { c: 1, r: 1 }, hp: 30, reacts: [] },
  { unit: "cosmere", side: "pc",  pos: { c: 2, r: 1 }, hp: 21, reacts: ["shield"] },
  { unit: "goblin1", side: "foe", pos: { c: 8, r: 8 }, hp: 7,  reacts: ["oa"] }
];

(async () => {
  let clock = 0;
  const bus2 = FB.makeMemoryBus({
    controllers: { "u-alice": ["cosmere"], "u-bob": ["caim"] },
    overseer: "u-dm", now: () => clock
  });
  const mkPipe = (actor, units, overseer, extra) => FPipe.makePipeline(Object.assign({
    conn: bus2.connect(actor), roster: ROSTER,
    me: { actor, units, overseer: !!overseer }, now: () => clock
  }, extra || {}));

  const dmP = mkPipe("u-dm", [], true);
  const bobP = mkPipe("u-bob", ["caim"]);

  await dmP.start();
  await bobP.rollInitiative("caim", 18);
  await dmP.rollInitiative("goblin1", 9);
  await dmP.setInitiative(["caim", "goblin1", "cosmere"]);
  ok("both clients replayed to the same active unit",
    bobP.activeUnit() === "caim" && dmP.activeUnit() === "caim");

  // a move with no reaction candidates: declared → resolved, always
  await bobP.move("caim", [{ c: 1, r: 1 }, { c: 3, r: 3 }], () => ({ final_cell: { c: 3, r: 3 } }));
  ok("move lands on every client", dmP.state().units.caim.pos.c === 3);
  ok("declared and resolved both in the log", dmP.events().filter(e =>
    e.kind === "move_declared" || e.kind === "move_resolved").length === 2);

  // an attack with no reactions
  await bobP.attack("caim", { target: "goblin1", roll: 17, mode: "melee" },
    () => ({ hit: true, dmg: 5 }));
  ok("attack resolves and damages on every client", dmP.state().units.goblin1.hp === 2);

  await bobP.endTurn("caim");
  ok("turn advances everywhere", bobP.activeUnit() === "goblin1" && dmP.activeUnit() === "goblin1");

  // late join: a fresh client catches up from the log alone (spec §6)
  const aliceP = mkPipe("u-alice", ["cosmere"]);
  await aliceP.catchUp();
  ok("late joiner rebuilds identical state", JSON.stringify(aliceP.state()) ===
    JSON.stringify(dmP.state()));

  // overseer tools ride the same pipe
  await dmP.edit([{ unit: "goblin1", hp: 7, pos: { c: 5, r: 5 } }]);
  ok("GOD MODE edit lands everywhere", aliceP.state().units.goblin1.hp === 7 &&
    bobP.state().units.goblin1.pos.c === 5);
  await dmP.override(dmP.events().find(e => e.kind === "attack_resolved").seq,
    { hit: true, dmg: 1 });
  ok("override triggers a rebuild with the correction",
    // hp: 7 (edit is later in the log than the corrected attack; edit wins on replay)
    aliceP.state().units.goblin1.hp === 7 && dmP.state().lastSeq === aliceP.state().lastSeq);
  const snapSeq = dmP.events()[dmP.events().length - 1].seq;
  await bobP.chat("caim", "branch incoming");
  await dmP.restoreTo(snapSeq);
  ok("restore branches; chat after the snapshot is erased from state",
    dmP.state().chat.every(c => c.text !== "branch incoming"));

  // the race guard: an instant same-stack answer on the memory bus cannot slip past the pause
  const busR = FB.makeMemoryBus({ controllers: { "u-alice": ["cosmere"] }, overseer: "u-dm", now: () => 0 });
  const dmR = FPipe.makePipeline({ conn: busR.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true },
    reactions: (st, d) => (d.kind === "attack_declared" && !st.units[d.payload.target].reactionUsed)
      ? [{ to: d.payload.target, react: "shield", context: {} }] : [] });
  const aliceR = FPipe.makePipeline({ conn: busR.connect("u-alice"), roster: ROSTER,
    me: { actor: "u-alice", units: ["cosmere"], overseer: false },
    onPrompt: r => { aliceR.answerPrompt("cosmere", r.seq, true); } });   // synchronous, same call stack
  await dmR.start(); await dmR.setInitiative(["goblin1", "cosmere", "caim"]);
  const resR = await dmR.attack("goblin1", { target: "cosmere", roll: 19, mode: "melee" },
    a => (a.length && a[0] && a[0].payload.use) ? { hit: false } : { hit: true, dmg: 6 });
  ok("synchronous answer cannot deadlock the asker; Shield still lands",
    resR && resR.ok === true && dmR.state().units.cosmere.hp === 21 &&
    dmR.state().units.cosmere.reactionUsed === true);

  // ── the schedule risk: attack + Shield across two devices (spec §4) ──
  clock = 0;
  const bus3 = FB.makeMemoryBus({
    controllers: { "u-alice": ["cosmere"] }, overseer: "u-dm", now: () => clock
  });
  const shieldCandidates = (st, declared, answers) =>
    ((!answers || !answers.length) &&              // honor answersSoFar: a decline must not re-prompt
     declared.kind === "attack_declared" && st.units[declared.payload.target] &&
     st.units[declared.payload.target].reacts.indexOf("shield") >= 0 &&
     !st.units[declared.payload.target].reactionUsed)
      ? [{ to: declared.payload.target, react: "shield", context: { roll: declared.payload.roll } }]
      : [];
  let alicePrompt = null;
  const dm3 = FPipe.makePipeline({ conn: bus3.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true }, now: () => clock,
    reactions: shieldCandidates });
  const alice3 = FPipe.makePipeline({ conn: bus3.connect("u-alice"), roster: ROSTER,
    me: { actor: "u-alice", units: ["cosmere"], overseer: false }, now: () => clock,
    onPrompt: r => { alicePrompt = r; } });
  await dm3.start(); await dm3.setInitiative(["goblin1", "cosmere", "caim"]);

  const atkP = dm3.attack("goblin1", { target: "cosmere", roll: 19, mode: "melee" },
    answers => (answers.length && answers[0] && answers[0].payload.use)
      ? { hit: false } : { hit: true, dmg: 6 });
  await tick();
  ok("the prompt reached the defender's device mid-attack",
    alicePrompt && alicePrompt.payload.to === "cosmere");
  ok("the whole table is visibly waiting", alice3.state().pendingPrompt !== null &&
    dm3.state().pendingPrompt !== null);
  await alice3.answerPrompt("cosmere", alicePrompt.seq, true);
  await atkP;
  ok("Shield turned the hit — attacker resolved from the answer",
    dm3.state().units.cosmere.hp === 21 && dm3.state().units.cosmere.reactionUsed === true);
  ok("declared, prompt, answered, resolved — all four facts in the log",
    ["attack_declared", "prompt", "prompt_answered", "attack_resolved"].every(k =>
      dm3.events().some(e => e.kind === k)));

  // ── timeout falls to the overseer, who answers AS the unit (spec §4.5) ──
  // Fresh bus: on bus3 Cosmere already SPENT her reaction on Shield, so a second
  // attack correctly generates no prompt (5e reaction economy — caught in execution).
  // No alice device here at all: her tablet is "asleep"; the prompt goes unanswered.
  clock = 0;
  let fallback = null;
  const busT = FB.makeMemoryBus({ controllers: { "u-alice": ["cosmere"] },
    overseer: "u-dm", now: () => clock });
  const dmT = FPipe.makePipeline({ conn: busT.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true }, now: () => clock,
    reactions: shieldCandidates });
  const dmWatch = FPipe.makePipeline({ conn: busT.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true }, now: () => clock,
    onPromptFallback: p => { fallback = p; } });
  await dmT.start(); await dmT.setInitiative(["goblin1", "cosmere", "caim"]);
  const atkT = dmT.attack("goblin1", { target: "cosmere", roll: 22, mode: "melee" },
    answers => (answers.length && answers[0] && answers[0].payload.use)
      ? { hit: false } : { hit: true, dmg: 6 });
  await tick();
  clock = 21000;                                   // 20s timer expires
  ok("stale prompt surfaces on the overseer's screen", dmWatch.checkTimeouts() !== null &&
    fallback && fallback.to === "cosmere");
  await dmWatch.answerPrompt("cosmere", dmWatch.state().pendingPrompt.seq, false);
  await atkT;
  ok("overseer's answer resumed the attacker's pipeline; actor stamps who answered",
    dmT.state().units.cosmere.hp === 15 &&
    dmT.events().filter(e => e.kind === "prompt_answered").pop().actor === "u-dm");

  // ── OA: asked never auto-fired; damage en route; mover keeps walking ──
  clock = 0;
  const oaCandidates = (st, declared, answers) =>
    (declared.kind === "move_declared" && !answers.length &&
     !st.units.goblin1.reactionUsed) ? [{ to: "goblin1", react: "oa",
       context: { target_unit: declared.unit } }] : [];
  let dmPrompt = null;
  const bus4 = FB.makeMemoryBus({ controllers: { "u-bob": ["caim"] },
    overseer: "u-dm", now: () => clock });
  const bob4 = FPipe.makePipeline({ conn: bus4.connect("u-bob"), roster: ROSTER,
    me: { actor: "u-bob", units: ["caim"], overseer: false }, now: () => clock,
    reactions: oaCandidates });
  const dm4 = FPipe.makePipeline({ conn: bus4.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true }, now: () => clock,
    onPrompt: r => { dmPrompt = r; } });
  await dm4.start(); await dm4.setInitiative(["caim", "goblin1", "cosmere"]);

  const moveP = bob4.move("caim", [{ c: 1, r: 1 }, { c: 6, r: 6 }],
    answers => ({ final_cell: { c: 6, r: 6 } }));   // M's ruling: OA never stops the move
  await tick();
  ok("OA prompt reached the foe's controller", dmPrompt && dmPrompt.payload.react === "oa");
  await dm4.answerPrompt("goblin1", dmPrompt.seq, true,
    { roll: 15, effects: [{ unit: "caim", dmg: 4 }] });
  await moveP;
  ok("OA hit en route; the mover arrived anyway (spec §4)",
    dm4.state().units.caim.hp === 26 && dm4.state().units.caim.pos.c === 6);

  // F1: catch-up merges with live-ingested rows instead of replacing (no loss, no double-apply)
  const rows1 = [
    { seq: 1, unit: "__session", actor: "u-dm", kind: "session_started", payload: {}, created_at: 0 },
    { seq: 2, unit: "__session", actor: "u-dm", kind: "initiative_set", payload: { order: ["caim", "goblin1", "cosmere"] }, created_at: 0 },
    { seq: 3, unit: "caim", actor: "u-bob", kind: "attack_declared", payload: { target: "goblin1", roll: 17, mode: "melee" }, created_at: 0 },
    { seq: 4, unit: "caim", actor: "u-bob", kind: "attack_resolved", payload: { target: "goblin1", hit: true, dmg: 5 }, created_at: 0 }
  ];
  let sub1 = null;
  const fakeConn = {
    publish: () => ({ ok: false, why: "read-only fake" }),
    subscribe: fn => { sub1 = fn; },
    fetchAll: () => Promise.resolve(rows1.slice(0, 4))   // fetch snapshot: seqs 1-4
  };
  const lateP = FPipe.makePipeline({ conn: fakeConn, roster: ROSTER, me: { actor: "u-x", units: [], overseer: false } });
  sub1(rows1[3]);                                        // live row arrives BEFORE catchUp completes (overlap)
  sub1({ seq: 5, unit: "caim", actor: "u-bob", kind: "turn_ended", payload: {}, created_at: 0 });  // and one the fetch missed
  await lateP.catchUp();
  ok("catch-up merges: overlap applied once, missed row kept", lateP.state().units.goblin1.hp === 2 &&
    lateP.activeUnit() === "goblin1" && lateP.events().length === 5);
  sub1(rows1[3]);                                        // realtime redelivery of a known seq
  ok("redelivered seq is dropped", lateP.events().length === 5 && lateP.state().units.goblin1.hp === 2);

  // chained prompts: two different candidates resolve one at a time, in order
  const busC = FB.makeMemoryBus({ controllers: { "u-alice": ["cosmere"], "u-bob": ["caim"] }, overseer: "u-dm", now: () => 0 });
  const chainCands = (st, d, answers) => {
    if (d.kind !== "attack_declared") return [];
    if (!answers.length) return [{ to: "cosmere", react: "silvery_barbs", context: {} }];
    if (answers.length === 1) return [{ to: "caim", react: "protection", context: {} }];
    return [];
  };
  const dmC = FPipe.makePipeline({ conn: busC.connect("u-dm"), roster: ROSTER,
    me: { actor: "u-dm", units: [], overseer: true }, now: () => 0, reactions: chainCands });
  const aC = FPipe.makePipeline({ conn: busC.connect("u-alice"), roster: ROSTER,
    me: { actor: "u-alice", units: ["cosmere"], overseer: false },
    onPrompt: r => { aC.answerPrompt("cosmere", r.seq, false); } });
  const bC = FPipe.makePipeline({ conn: busC.connect("u-bob"), roster: ROSTER,
    me: { actor: "u-bob", units: ["caim"], overseer: false },
    onPrompt: r => { bC.answerPrompt("caim", r.seq, false); } });
  await dmC.start(); await dmC.setInitiative(["goblin1", "cosmere", "caim"]);
  await dmC.attack("goblin1", { target: "cosmere", roll: 15, mode: "melee" }, () => ({ hit: true, dmg: 2 }));
  const chainKinds = dmC.events().filter(e => e.kind === "prompt" || e.kind === "prompt_answered")
    .map(e => e.kind + ":" + (e.payload.react || e.payload.prompt_seq));
  ok("two chained prompts resolve sequentially", dmC.events().filter(e => e.kind === "prompt").length === 2 &&
    dmC.events().filter(e => e.kind === "prompt_answered").length === 2 &&
    dmC.state().units.cosmere.hp === 19);

  // ── supabase bus exposes the same conn contract (shape check; RLS is live-tested) ──
  const fakeSb = {
    from: () => ({ insert: () => ({ select: () => ({ single: () =>
      Promise.resolve({ data: { id: 1 }, error: null }) }) }),
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
    channel: () => ({ on: function () { return this; }, subscribe: () => {} })
  };
  const sConn = FB.makeSupabaseBus({ sb: fakeSb, sessionId: "s1" }).connect();
  ok("supabase conn matches the bus contract",
    typeof sConn.publish === "function" && typeof sConn.subscribe === "function" &&
    typeof sConn.fetchAll === "function");
  ok("supabase publish resolves {ok, seq}",
    (await sConn.publish(FP.makeEvent("caim", "chat", { text: "hi" }))).seq === 1);

  // ── edit.add_unit (FORGE_BOARD.md §6) ──
  (function(){
    var roster=[{unit:"caim",side:"pc",pos:{c:1,r:1},hp:24}];
    var rows=[
      {seq:1,kind:"session_started",unit:"__session",payload:{}},
      {seq:2,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob9",name:"Goblin 9",side:"foe",pos:{c:5,r:5},hp:7,statblock:{name:"Goblin"}}}]}},
      {seq:3,kind:"attack_resolved",unit:"caim",payload:{target:"gob9",hit:true,dmg:3}}
    ];
    var st=FR.replayLog(roster,rows);
    ok("add_unit creates the unit", !!st.units.gob9);
    ok("added unit takes damage", st.units.gob9.hp===4);
    ok("added unit carries statblock", st.units.gob9.statblock && st.units.gob9.statblock.name==="Goblin");
    // duplicate is inert
    var st2=FR.replayLog(roster, rows.concat([{seq:4,kind:"edit",unit:"__session",payload:{changes:[{add_unit:{unit:"gob9",pos:{c:0,r:0},hp:99}}]}}]));
    ok("duplicate add_unit ignored", st2.units.gob9.hp===4);
    // arrival then restore behind it: snapshot had no gob9 → gob9 gone after restore
    var snap=FR.replayLog(roster, rows.slice(0,1));
    var st3=FR.replayLog(roster, rows.concat([{seq:5,kind:"restore",unit:"__session",payload:{to_seq:1,snapshot:FR.snapshot(snap)}}]));
    ok("restore behind arrival erases it", !st3.units.gob9);
  })();

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
