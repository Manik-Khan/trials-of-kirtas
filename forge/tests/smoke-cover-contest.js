/* Known-answer smokes for the Cover Contest (FORGE_COVER_CONTEST.md §8).
   Real modules, MemoryBus twin for the overseer-only gate — headless before
   any network, repo tradition. Run: node forge/tests/smoke-cover-contest.js */
const FP = require("../forge-protocol.js");
const FR = require("../forge-replay.js");
const FB = require("../forge-bus.js");
const FPipe = require("../forge-pipeline.js");
const TG = require("../tactics-geometry.js");

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + n); };
const tick = () => new Promise(r => setTimeout(r, 0));

const ROSTER = [
  { unit: "cosmere", side: "pc",  pos: { c: 1, r: 1 }, hp: 21, reacts: ["shield"] },
  { unit: "goblin2", side: "foe", pos: { c: 8, r: 1 }, hp: 7,  reacts: [] }
];
const row = (seq, unit, kind, payload) => ({ seq, unit, actor: "u-" + unit, kind, payload, created_at: seq });

/* ── §8.6 — the MemoryBus gate twin: the whole overseer-only guarantee ──
   prompt_answered{unit:"__overseer"} is the ruling. A player does not control
   the sentinel, so the identity gate rejects the forgery; the overseer (who
   may write any unit) passes. No new kind, no schema change. */
{
  const bus = FB.makeMemoryBus({ controllers: { "u-alice": ["cosmere"] }, overseer: "u-dm", now: () => 0 });
  const alice = bus.connect("u-alice"), dm = bus.connect("u-dm");
  ok("player may raise the contest (prompt for their own unit)",
    alice.publish(FP.makeEvent("cosmere", "prompt",
      { to: "__overseer", react: "cover", timeout: 20, context: {} })).ok === true);
  const forged = alice.publish(FP.makeEvent("__overseer", "prompt_answered",
    { prompt_seq: 1, use: true, cover: "none", acBonus: 0 }));
  ok("a player forging the ruling is REJECTED by the identity gate",
    forged.ok === false && /identity/.test(forged.why));
  ok("the overseer's identical ruling is ACCEPTED",
    dm.publish(FP.makeEvent("__overseer", "prompt_answered",
      { prompt_seq: 1, use: true, cover: "none", acBonus: 0 })).ok === true);
}

/* ── §8.5 — replay semantics: refresh mid-contest + determinism ── */
{
  const setup = [
    row(1, "__session", "session_started", {}),
    row(2, "__session", "initiative_set", { order: ["cosmere", "goblin2"] })
  ];
  const midContest = setup.concat([
    row(3, "cosmere", "prompt", { to: "__overseer", react: "cover", timeout: 20,
      context: { attacker: "cosmere", target: "goblin2", verdict: { cover: "three-quarters", acBonus: 5 }, culprit: { c: 7, r: 1 } } })
  ]);
  const s = FR.replayLog(ROSTER, midContest);
  ok("refresh mid-contest reconstructs 'waiting on the DM' (pendingPrompt react:cover → __overseer)",
    s.pendingPrompt && s.pendingPrompt.react === "cover" && s.pendingPrompt.to === "__overseer");
  ok("the contest context survives the replay (culprit cell intact)",
    s.pendingPrompt.context.culprit.c === 7 && s.pendingPrompt.context.verdict.acBonus === 5);
  const ruled = midContest.concat([
    row(4, "__overseer", "prompt_answered", { prompt_seq: 3, use: true, cover: "half", acBonus: 2, reason: "narrated crouch" }),
    row(5, "cosmere", "attack_declared", { target: "goblin2", roll: 15, mode: "ranged", cover: 2, hit: true }),
    row(6, "cosmere", "attack_resolved", { target: "goblin2", hit: true, dmg: 4 })
  ]);
  const s2 = FR.replayLog(ROSTER, ruled);
  ok("the ruling clears the prompt and the shot resolves under it",
    s2.pendingPrompt === null && s2.units.goblin2.hp === 3);
  ok("a ruling consumes NO reaction (the sentinel is not a unit)",
    s2.units.cosmere.reactionUsed === false && s2.units.goblin2.reactionUsed === false);
  ok("replay is deterministic (same contest log twice → identical state)",
    JSON.stringify(FR.replayLog(ROSTER, ruled)) === JSON.stringify(FR.replayLog(ROSTER, ruled)));
}

/* ── §8.7 — culprit highlight: real geometry, known map ── */
{
  // a 7 ft wall at (6,6) beside the target, diagonal shot past it: the centre
  // eye-line clips the wall (culprit names it) while corner lines stay live
  const map = TG.makeMap(12, 10);
  map.occ = new Array(12 * 10).fill(0);
  map.occ[6 * 12 + 6] = 7;
  const a = { c: 10, r: 7 }, b = { c: 5, r: 6 };
  const v = TG.losVerdict(map, a, b);
  const at = TG.losRay(map, a, b, v.eye).at;
  ok("known map: the wall grades three-quarters, shot still live",
    v.cover === "three-quarters" && v.canTarget === true);
  ok("losRay along the verdict's eye names the wall cell (6,6)",
    at && at.c === 6 && at.r === 6);
  // a 4.5 ft boulder clips only the FEET lines: the eye-to-eye ray clears it,
  // so there is no single blocker to light — the card narrates instead
  const map2 = TG.makeMap(12, 3);
  map2.occ = new Array(12 * 3).fill(0);
  map2.occ[1 * 12 + 7] = 4.5;
  const v2 = TG.losVerdict(map2, { c: 1, r: 1 }, { c: 8, r: 1 });
  const at2 = TG.losRay(map2, { c: 1, r: 1 }, { c: 8, r: 1 }, v2.eye).at;
  ok("boulder: three-quarters from feet-corner clips, centre ray clear → culprit null (card narrates 'partial cover from the angle')",
    v2.cover === "three-quarters" && at2 === null);
}

/* ── §8.1/.2/.3/.4 — the live flow over the bus: pause, ruling, timeout, total ── */
(async () => {
  let clock = 0;
  const mk = () => {
    const bus = FB.makeMemoryBus({ controllers: { "u-alice": ["cosmere"] }, overseer: "u-dm", now: () => clock });
    const prompts = [];
    const dmP = FPipe.makePipeline({ conn: bus.connect("u-dm"), roster: ROSTER,
      me: { actor: "u-dm", units: [], overseer: true }, now: () => clock,
      onPrompt: r => prompts.push(r) });
    const aliceHeard = [];
    const aliceP = FPipe.makePipeline({ conn: bus.connect("u-alice"), roster: ROSTER,
      me: { actor: "u-alice", units: ["cosmere"] }, now: () => clock,
      onPrompt: r => aliceHeard.push(r) });
    return { bus, dmP, aliceP, prompts, aliceHeard };
  };

  // §8.1 contest → ruling → declare carries the ruled cover → resolve applies it
  {
    const { dmP, aliceP, prompts, aliceHeard } = mk();
    await dmP.start(); await dmP.setInitiative(["cosmere", "goblin2"]);
    const pending = aliceP.contestCover("cosmere",
      { attacker: "cosmere", target: "goblin2", verdict: { cover: "three-quarters", acBonus: 5 }, culprit: { c: 7, r: 1 } });
    await tick();
    ok("the contest routes to the overseer device ONLY (controlsUnit('__overseer'))",
      prompts.length === 1 && prompts[0].payload.react === "cover" && aliceHeard.length === 0);
    ok("every device is paused on the same pendingPrompt",
      dmP.state().pendingPrompt && dmP.state().pendingPrompt.react === "cover");
    await dmP.answerPrompt("__overseer", prompts[0].seq, true, { cover: "half", acBonus: 2, reason: "he's half out of the hollow" });
    const ans = await pending;
    ok("the asker's pause resolves with the ruling", ans && ans.payload.cover === "half" && ans.payload.acBonus === 2);
    // the pipeline bakes the ruling into the declared payload (spec §3.4)
    await aliceP.attack("cosmere", { target: "goblin2", roll: 15, mode: "ranged", cover: ans.payload.acBonus, hit: true },
      () => ({ hit: true, dmg: 4 }));
    const decl = dmP.events().find(e => e.kind === "attack_declared");
    ok("attack_declared carries the ruled cover inline", decl && decl.payload.cover === 2);
    ok("the shot resolves under the ruling on every device", dmP.state().units.goblin2.hp === 3);
    ok("the optional reason rides the ruling fact for the log",
      dmP.events().find(e => e.kind === "prompt_answered").payload.reason === "he's half out of the hollow");
  }

  // §8.2 timeout → the geometry default stands, no ruling event needed
  {
    const { dmP, aliceP } = mk();
    await dmP.start(); await dmP.setInitiative(["cosmere", "goblin2"]);
    const ans = await aliceP.contestCover("cosmere",
      { attacker: "cosmere", target: "goblin2", verdict: { cover: "none", acBonus: 0 }, culprit: null }, 15);
    ok("no ruling within the window → contestCover resolves null (the grid stands)", ans === null);
    // a LATE ruling is inert: the awaiting token was abandoned
    const p = dmP.state().pendingPrompt;
    await dmP.answerPrompt("__overseer", p.seq, true, { cover: "total" });
    await tick();
    ok("a late ruling clears the stale prompt but pauses nothing",
      dmP.state().pendingPrompt === null && aliceP.state().pendingPrompt === null);
  }

  // §8.3 total = no shot: no attack_declared ever lands; the turn continues
  {
    const { dmP, aliceP, prompts } = mk();
    await dmP.start(); await dmP.setInitiative(["cosmere", "goblin2"]);
    const pending = aliceP.contestCover("cosmere",
      { attacker: "cosmere", target: "goblin2", verdict: { cover: "three-quarters", acBonus: 5 }, culprit: { c: 7, r: 1 } });
    await tick();
    await dmP.answerPrompt("__overseer", prompts[0].seq, true, { cover: "total", acBonus: null });
    const ans = await pending;
    ok("ruling 'total' reaches the asker", ans.payload.cover === "total");
    // the caller (mock) declares nothing on total — assert the log agrees
    ok("no attack_declared in the log; target untouched",
      dmP.events().every(e => e.kind !== "attack_declared") && dmP.state().units.goblin2.hp === 7);
    await aliceP.endTurn("cosmere");
    ok("the turn continues after a total ruling", dmP.activeUnit() === "goblin2");
  }

  // §8.4 door (b): past-shot re-rule is an override on attack_resolved (existing machinery)
  {
    const { dmP, aliceP } = mk();
    await dmP.start(); await dmP.setInitiative(["cosmere", "goblin2"]);
    await aliceP.attack("cosmere", { target: "goblin2", roll: 15, mode: "ranged", cover: 0, hit: true },
      () => ({ hit: true, dmg: 5 }));
    ok("shot landed under the grid verdict", dmP.state().units.goblin2.hp === 2);
    const res = dmP.events().find(e => e.kind === "attack_resolved");
    await dmP.override(res.seq, { hit: false, dmg: 0 });   // re-ruled to total after the fact → the hit never happened
    ok("override re-rules the past shot; replay heals the damage",
      dmP.state().units.goblin2.hp === 7 && aliceP.state().units.goblin2.hp === 7);
  }

  console.log(`\n${pass}/${pass + fail} passed${fail ? `  — ${fail} FAILED` : ""}\n`);
  process.exitCode = fail ? 1 : 0;
})();
