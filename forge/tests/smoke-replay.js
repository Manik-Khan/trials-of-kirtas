/* Replay determinism + derivation smokes (FORGE_PROTOCOL.md §7).
   Run: node forge/tests/smoke-replay.js */
const FR = require("../forge-replay.js");

let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + n); };

const ROSTER = [
  { unit: "caim",    side: "pc",  pos: { c: 1, r: 1 }, hp: 30, reacts: [] },
  { unit: "cosmere", side: "pc",  pos: { c: 2, r: 1 }, hp: 21, reacts: ["shield"] },
  { unit: "goblin1", side: "foe", pos: { c: 8, r: 8 }, hp: 7,  reacts: ["oa"] }
];
const row = (seq, unit, kind, payload) => ({ seq, unit, actor: "u-" + unit, kind, payload, created_at: seq });

// ── setup & turn derivation: no turn_started event, ever ──
const setup = [
  row(1, "__session", "session_started", {}),
  row(2, "caim", "initiative_rolled", { roll: 18 }),
  row(3, "cosmere", "initiative_rolled", { roll: 12 }),
  row(4, "__session", "initiative_set", { order: ["caim", "goblin1", "cosmere"] })
];
let s = FR.replayLog(ROSTER, setup);
ok("session goes active", s.status === "active");
ok("initiative rolls recorded", s.rolls.caim === 18 && s.rolls.cosmere === 12);
ok("round 1, caim active — derived, not stored", FR.round(s) === 1 && FR.activeUnit(s) === "caim");

s = FR.replayLog(ROSTER, setup.concat([row(5, "caim", "turn_ended", {})]));
ok("turn_ended advances the derived pointer", FR.activeUnit(s) === "goblin1");

const wrap = setup.concat([row(5, "caim", "turn_ended", {}), row(6, "goblin1", "turn_ended", {}),
  row(7, "cosmere", "turn_ended", {})]);
s = FR.replayLog(ROSTER, wrap);
ok("round increments on wrap", FR.round(s) === 2 && FR.activeUnit(s) === "caim");

// reaction refreshes at the start of your turn (5e)
const spent = FR.replayLog(ROSTER, setup);
spent.units.goblin1.reactionUsed = true;
FR.applyEvent(spent, row(5, "caim", "turn_ended", {}), null);
ok("reaction refreshes when your turn starts", spent.units.goblin1.reactionUsed === false);

ok("units carry roster facts", s.units.cosmere.reacts.indexOf("shield") >= 0 &&
  s.units.goblin1.hp === 7 && s.units.caim.maxHp === 30);

// ── actions: declared → resolved, always (spec §2); facts only ──
const fight = setup.concat([
  row(5, "caim", "move_declared", { path: [{ c: 1, r: 1 }, { c: 2, r: 2 }, { c: 3, r: 3 }] }),
  row(6, "caim", "move_resolved", { final_cell: { c: 3, r: 3 } }),
  row(7, "caim", "attack_declared", { target: "goblin1", roll: 17, mode: "melee" }),
  row(8, "caim", "attack_resolved", { hit: true, dmg: 5 })
]);
s = FR.replayLog(ROSTER, fight);
ok("resolved move lands the unit", s.units.caim.pos.c === 3 && s.units.caim.pos.r === 3);
ok("resolved hit applies damage", s.units.goblin1.hp === 2);
ok("no pending action after resolution", s.pendingAction === null);

const declaredOnly = FR.replayLog(ROSTER, fight.slice(0, -1));
ok("mid-attack refresh: declared, awaiting resolution",
  declaredOnly.pendingAction && declaredOnly.pendingAction.kind === "attack" &&
  declaredOnly.pendingAction.target === "goblin1");

// a miss applies nothing
s = FR.replayLog(ROSTER, fight.slice(0, -1).concat([row(8, "caim", "attack_resolved", { hit: false })]));
ok("a miss leaves hp alone", s.units.goblin1.hp === 7);

// interrupted movement (Sentinel / dropped-to-0 — spec §4: OA never stops movement otherwise)
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "caim", "move_declared", { path: [{ c: 1, r: 1 }, { c: 2, r: 2 }, { c: 3, r: 3 }] }),
  row(6, "caim", "move_resolved", { final_cell: { c: 3, r: 3 }, interrupted_at: { c: 2, r: 2 } })
]));
ok("interrupted_at stops the mover there", s.units.caim.pos.c === 2 && s.units.caim.pos.r === 2);

// dropping to 0 downs, healing revives; abilities carry effects
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "goblin1", "attack_declared", { target: "cosmere", roll: 19, mode: "melee" }),
  row(6, "goblin1", "attack_resolved", { hit: true, dmg: 25 }),
  row(7, "caim", "ability_used", { ability: "healing_word", targets: ["cosmere"],
    effects: [{ unit: "cosmere", heal: 4 }] })
]));
ok("overkill floors at 0 and downs", s.units.cosmere.downed === false && s.units.cosmere.hp === 4);
ok("hp never exceeds max", FR.replayLog(ROSTER, setup.concat([
  row(5, "caim", "ability_used", { ability: "healing_word", targets: ["caim"],
    effects: [{ unit: "caim", heal: 99 }] })])).units.caim.hp === 30);

// self-contained facts: an explicit target survives an interleaved declared event
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "caim", "attack_declared", { target: "goblin1", roll: 17, mode: "melee" }),
  row(6, "cosmere", "move_declared", { path: [{ c: 2, r: 1 }, { c: 2, r: 2 }] }), // overwrites pendingAction
  row(7, "caim", "attack_resolved", { target: "goblin1", hit: true, dmg: 3 })
]));
ok("attack_resolved with explicit target ignores stale pendingAction", s.units.goblin1.hp === 4);

// ── prompts: unit on a prompt is the ASKING unit (spec §2, identity gate) ──
const promptLog = setup.concat([
  row(5, "goblin1", "attack_declared", { target: "cosmere", roll: 19, mode: "melee" }),
  row(6, "goblin1", "prompt", { to: "cosmere", react: "shield", timeout: 20, context: { roll: 19 } })
]);
s = FR.replayLog(ROSTER, promptLog);
ok("log ending on a prompt reconstructs 'waiting on X' (spec §6)",
  s.pendingPrompt && s.pendingPrompt.to === "cosmere" && s.pendingPrompt.asker === "goblin1" &&
  s.pendingPrompt.created_at === 6);

s = FR.replayLog(ROSTER, promptLog.concat([
  row(7, "cosmere", "prompt_answered", { prompt_seq: 6, use: true }),
  row(8, "goblin1", "attack_resolved", { hit: false })
]));
ok("answered prompt clears, spends the reaction, shield turns the hit",
  s.pendingPrompt === null && s.units.cosmere.reactionUsed === true && s.units.cosmere.hp === 21);

// OA damage rides in prompt_answered.effects; mover keeps walking (M's ruling, spec §4)
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "caim", "move_declared", { path: [{ c: 1, r: 1 }, { c: 6, r: 6 }] }),
  row(6, "caim", "prompt", { to: "goblin1", react: "oa", timeout: 20, context: { target_unit: "caim" } }),
  row(7, "goblin1", "prompt_answered", { prompt_seq: 6, use: true, roll: 15,
    effects: [{ unit: "caim", dmg: 4 }] }),
  row(8, "caim", "move_resolved", { final_cell: { c: 6, r: 6 } })
]));
ok("OA hits en route, move completes anyway", s.units.caim.hp === 26 &&
  s.units.caim.pos.c === 6 && s.units.goblin1.reactionUsed === true);

// chat is part of the fight's story
s = FR.replayLog(ROSTER, setup.concat([row(5, "cosmere", "chat", { text: "bait the OA!" })]));
ok("chat lands in the transcript", s.chat.length === 1 && s.chat[0].unit === "cosmere");

// ── override: retcon in place — replay uses the correction (spec §5) ──
s = FR.replayLog(ROSTER, fight.concat([
  row(9, "__session", "override", { corrects_seq: 8, correction: { hit: true, dmg: 2 } })
]));
ok("override rewrites the past fact", s.units.goblin1.hp === 5);

// ── edit: GOD MODE — direct state patch incl. typed numbers (spec §5) ──
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "__session", "edit", { changes: [
    { unit: "goblin1", pos: { c: 4, r: 4 }, hp: 3 },
    { unit: "caim", conditions: ["prone"] }
  ] })
]));
ok("edit moves units, sets hp, sets conditions", s.units.goblin1.pos.c === 4 &&
  s.units.goblin1.hp === 3 && s.units.caim.conditions[0] === "prone");

// ── restore: hard branch — snapshot erases the dead branch's effects (spec §5) ──
const preBranch = FR.replayLog(ROSTER, fight);           // goblin1 at 2 hp
const branchLog = fight.concat([
  row(9, "caim", "attack_declared", { target: "goblin1", roll: 20, mode: "melee" }),
  row(10, "caim", "attack_resolved", { hit: true, dmg: 2 }),   // the take being abandoned
  row(11, "__session", "restore", { to_seq: 8, snapshot: FR.snapshot(preBranch) })
]);
s = FR.replayLog(ROSTER, branchLog);
ok("restore resets to the snapshot — dead branch erased", s.units.goblin1.hp === 2 &&
  s.units.goblin1.downed === false);

// ── determinism (spec §7): same log twice → identical state ──
ok("replay is deterministic", JSON.stringify(FR.replayLog(ROSTER, branchLog)) ===
  JSON.stringify(FR.replayLog(ROSTER, branchLog)));

// F2: a duplicate answer (player answered after the overseer already did) is inert
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "goblin1", "attack_declared", { target: "cosmere", roll: 19, mode: "melee" }),
  row(6, "goblin1", "prompt", { to: "cosmere", react: "shield", timeout: 20, context: {} }),
  row(7, "cosmere", "prompt_answered", { prompt_seq: 6, use: true }),
  row(8, "cosmere", "prompt_answered", { prompt_seq: 6, use: true, effects: [{ unit: "caim", dmg: 4 }] })
]));
ok("duplicate prompt_answered is inert", s.units.caim.hp === 30 && s.pendingPrompt === null);
// F2: an answer arriving after a restore erased the prompt is inert
const preP = FR.replayLog(ROSTER, setup);
s = FR.replayLog(ROSTER, setup.concat([
  row(5, "caim", "move_declared", { path: [{ c: 1, r: 1 }, { c: 6, r: 6 }] }),
  row(6, "caim", "prompt", { to: "goblin1", react: "oa", timeout: 20, context: {} }),
  row(7, "__session", "restore", { to_seq: 4, snapshot: FR.snapshot(preP) }),
  row(8, "goblin1", "prompt_answered", { prompt_seq: 6, use: true, effects: [{ unit: "caim", dmg: 4 }] })
]));
ok("answer after a restore erased the prompt is inert", s.units.caim.hp === 30);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
