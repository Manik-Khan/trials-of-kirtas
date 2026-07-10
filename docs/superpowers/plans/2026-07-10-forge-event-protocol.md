# Battle Forge Event Protocol — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the multiplayer event-protocol spine from `FORGE_PROTOCOL.md` — append-only event log, replay-derived state, swappable transport, acting-client pipeline with cross-device reaction prompts — fully proven headless before Supabase.

**Architecture:** Four dual-export modules under `forge/` (vocabulary → reducer → bus → pipeline), each testable in Node with known-answer smokes. The bus interface has two implementations: an in-memory fake that mirrors the SQL identity gate (tests) and a Supabase-backed one (production). State is never stored; it is derived by replaying the log.

**Tech Stack:** Vanilla JS (UMD dual-export, ES5 style in modules), Node for smokes, Supabase (Postgres + RLS + realtime) for transport, one append-only SQL migration.

## Global Constraints

- **NEVER `git commit` or `git push`** (CLAUDE.md hard rule 1). Every "Commit" step in the normal template is replaced by a **Validate** step: `node --check` each touched file + run the affected smokes + record the pass count. M deploys by hand.
- Every `.js` you touch or create passes `node --check` before you claim anything.
- Modules under `forge/` use the UMD dual-export pattern (browser `window.*` + Node `module.exports`) exactly as `forge/forge-engine.js:17-23` does, and ES5 style (`var`, `function`). Smokes may use modern JS (existing smokes do).
- Smokes are known-answer and extract/exercise the **real** functions — never synthetic stand-ins (CLAUDE.md hard rule 3).
- Event vocabulary is **exactly the 17 kinds** in `FORGE_PROTOCOL.md` §2. There is **no `turn_started`** event — turn start is derived.
- The reducer replays **facts**; it never re-runs rules. Rules (LoS, reach, legality) stay in `forge/tactics-geometry.js` and the callers.
- SQL is one new append-only file at repo root; never rewrite an applied migration.
- Any HTML page including these modules cache-stamps them: `<script src="forge/forge-protocol.js?v=fp1">`, bumped on change.
- Out of scope for this plan (later build steps): the player HUD, on-deck banner, planned-turn UI, pre-move OA warning UI, ▶/⏩ watch-mode playback, porting the topo mock's real reaction-candidate rules, and the Playwright QA harness (rev 2 build step 7). The pipeline exposes the hooks they will consume.

---

### Task 1: Event vocabulary module (`forge-protocol.js`)

**Files:**
- Create: `forge/forge-protocol.js`
- Test: `forge/tests/smoke-protocol.js` (started here, grows through Task 8)

**Interfaces:**
- Produces: `ForgeProtocol.KINDS` (array of 17 strings), `ForgeProtocol.OVERSEER_ONLY` (object set), `ForgeProtocol.makeEvent(unit, kind, payload) → {unit, kind, payload}`, `ForgeProtocol.validateEvent(ev) → {ok:true} | {ok:false, why:string}`.

- [ ] **Step 1: Write the failing test**

Create `forge/tests/smoke-protocol.js`:

```js
/* Known-answer smokes for the Battle Forge event protocol (FORGE_PROTOCOL.md).
   CommonJS so the modules' own require() chains resolve.
   Run: node forge/tests/smoke-protocol.js */
const FP = require("../forge-protocol.js");

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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node forge/tests/smoke-protocol.js`
Expected: FAIL — `Cannot find module '../forge-protocol.js'`

- [ ] **Step 3: Write the module**

Create `forge/forge-protocol.js`:

```js
/* ── forge-protocol.js ────────────────────────────────────────────────
   Battle Forge event VOCABULARY (FORGE_PROTOCOL.md §2). Every event is a
   fact said at the table; state is derived by replaying them in order.
   17 kinds. No turn_started — turn start is derived (spec §2).
   Dual export: browser (window.ForgeProtocol) + node.                    */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeProtocol = api;
})(typeof self !== "undefined" ? self : this, function () {

  var KINDS = [
    "session_started", "initiative_rolled", "initiative_set", "turn_ended",
    "move_declared", "move_resolved", "attack_declared", "attack_resolved",
    "ability_used", "prompt", "prompt_answered", "reaction_declared", "chat",
    "override", "restore", "edit", "session_ended"
  ];

  /* enforced by the bus/RLS identity gate, listed here for UI greying */
  var OVERSEER_ONLY = {
    session_started: 1, initiative_set: 1, session_ended: 1,
    override: 1, restore: 1, edit: 1
  };

  /* required payload fields per kind — presence checks on facts, not rules */
  var REQ = {
    initiative_rolled: ["roll"], initiative_set: ["order"],
    move_declared: ["path"], move_resolved: ["final_cell"],
    attack_declared: ["target", "roll"], attack_resolved: ["hit"],
    ability_used: ["ability", "targets"],
    prompt: ["to", "react", "timeout"], prompt_answered: ["prompt_seq", "use"],
    reaction_declared: ["react", "trigger_seq"],
    chat: ["text"], override: ["corrects_seq", "correction"],
    restore: ["to_seq", "snapshot"], edit: ["changes"]
  };

  function makeEvent(unit, kind, payload) {
    return { unit: unit, kind: kind, payload: payload || {} };
  }

  function validateEvent(ev) {
    if (!ev || typeof ev !== "object") return { ok: false, why: "not an object" };
    if (KINDS.indexOf(ev.kind) < 0) return { ok: false, why: "unknown kind: " + ev.kind };
    if (typeof ev.unit !== "string" || !ev.unit) return { ok: false, why: "missing unit" };
    var req = REQ[ev.kind] || [];
    for (var i = 0; i < req.length; i++)
      if (ev.payload == null || ev.payload[req[i]] === undefined)
        return { ok: false, why: ev.kind + " missing payload." + req[i] };
    return { ok: true };
  }

  return { KINDS: KINDS, OVERSEER_ONLY: OVERSEER_ONLY, makeEvent: makeEvent, validateEvent: validateEvent };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node forge/tests/smoke-protocol.js`
Expected: `8 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-protocol.js && node --check forge/tests/smoke-protocol.js`
Expected: no output (both parse). Record the smoke pass count.

---

### Task 2: Reducer — state shape, setup & turn flow (`forge-replay.js`)

**Files:**
- Create: `forge/forge-replay.js`
- Test: `forge/tests/smoke-replay.js` (started here, grows through Task 4)

**Interfaces:**
- Consumes: `ForgeProtocol` (Task 1).
- Produces: `ForgeReplay.initialState(roster) → state`, `ForgeReplay.activeUnit(state) → unit|null`, `ForgeReplay.round(state) → number`, `ForgeReplay.applyEvent(state, row, corrections) → state` (mutates), `ForgeReplay.replayLog(roster, rows) → state`, `ForgeReplay.snapshot(state) → deep JSON copy`.
- Row shape everywhere: `{seq, unit, actor, kind, payload, created_at}`. Roster entry: `{unit, side:"pc"|"foe", pos:{c,r}, hp, maxHp?, reacts?:[]}`.
- State shape (the contract later tasks and the HUD rely on): `{status, units:{[unit]:{side, pos:{c,r}, hp, maxHp, conditions:[], reacts:[], reactionUsed, downed}}, rolls:{}, initiative:[]|null, turnsEnded, pendingAction, pendingPrompt, chat:[], lastSeq}`.

- [ ] **Step 1: Write the failing test**

Create `forge/tests/smoke-replay.js`:

```js
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

console.log("\n" + pass + " passed, " + fail + " failed");
process.exitCode = fail ? 1 : 0;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node forge/tests/smoke-replay.js`
Expected: FAIL — `Cannot find module '../forge-replay.js'`

- [ ] **Step 3: Write the module**

Create `forge/forge-replay.js`:

```js
/* ── forge-replay.js ──────────────────────────────────────────────────
   Battle Forge REDUCER (FORGE_PROTOCOL.md). State is never stored — it is
   derived by replaying the event log top to bottom. This module applies
   FACTS; it never re-runs rules (rules live in tactics-geometry and the
   acting client). Turn start is DERIVED: initiative_set order + count of
   turn_ended (spec §2 — an explicit turn_started would break the identity
   gate). Dual export: browser (window.ForgeReplay) + node.                */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var api = factory(FP);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeReplay = api;
})(typeof self !== "undefined" ? self : this, function (FP) {

  function initialState(roster) {
    var units = {};
    (roster || []).forEach(function (u) {
      units[u.unit] = {
        side: u.side, pos: { c: u.pos.c, r: u.pos.r },
        hp: u.hp, maxHp: (u.maxHp != null ? u.maxHp : u.hp),
        conditions: [], reacts: (u.reacts || []).slice(),
        reactionUsed: false, downed: false
      };
    });
    return {
      status: "staging", units: units, rolls: {}, initiative: null,
      turnsEnded: 0, pendingAction: null, pendingPrompt: null,
      chat: [], lastSeq: 0
    };
  }

  function activeUnit(state) {
    if (!state.initiative || state.status !== "active") return null;
    return state.initiative[state.turnsEnded % state.initiative.length];
  }
  function round(state) {
    if (!state.initiative) return 0;
    return Math.floor(state.turnsEnded / state.initiative.length) + 1;
  }

  /* applyEvent mutates state. `corrections` maps seq → corrected payload
     (pre-scanned overrides — Task 4). Unknown kinds are ignored, narrated. */
  function applyEvent(state, row, corrections) {
    var p = row.payload || {};
    if (corrections && corrections[row.seq]) p = Object.assign({}, p, corrections[row.seq]);
    switch (row.kind) {
      case "session_started": state.status = "active"; break;
      case "initiative_rolled": state.rolls[row.unit] = p.roll; break;
      case "initiative_set":
        state.initiative = p.order.slice(); state.turnsEnded = 0;
        Object.keys(state.units).forEach(function (k) { state.units[k].reactionUsed = false; });
        break;
      case "turn_ended": {
        state.turnsEnded++;
        var next = activeUnit(state);   // reaction refreshes at the start of your turn
        if (next && state.units[next]) state.units[next].reactionUsed = false;
        state.pendingAction = null;
        break;
      }
      case "session_ended": state.status = "ended"; break;
      default:
        if (FP.KINDS.indexOf(row.kind) < 0)
          console.warn("[forge-replay] unknown kind ignored: " + row.kind);
        break;                          // remaining kinds land in Tasks 3–4
    }
    state.lastSeq = row.seq;
    return state;
  }

  function replayLog(roster, rows) {
    var state = initialState(roster);
    rows.forEach(function (row) { applyEvent(state, row, null); });
    return state;
  }

  function snapshot(state) { return JSON.parse(JSON.stringify(state)); }

  return {
    initialState: initialState, activeUnit: activeUnit, round: round,
    applyEvent: applyEvent, replayLog: replayLog, snapshot: snapshot
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node forge/tests/smoke-replay.js`
Expected: `7 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-replay.js && node --check forge/tests/smoke-replay.js && node forge/tests/smoke-protocol.js`
Expected: parses clean; protocol smoke still `8 passed, 0 failed`.

---

### Task 3: Reducer — actions, declared → resolved, effects

**Files:**
- Modify: `forge/forge-replay.js` (add cases to the `applyEvent` switch, add two helpers)
- Test: `forge/tests/smoke-replay.js` (append)

**Interfaces:**
- Produces: `applyEvent` handles `move_declared/move_resolved/attack_declared/attack_resolved/ability_used`. Effects list contract (used by every damaging/healing payload): `effects: [{unit, dmg?, heal?, add_condition?, remove_condition?}]`. `move_resolved.payload = {final_cell:{c,r}, interrupted_at?:{c,r}}` — when `interrupted_at` is present the unit stops there (Sentinel / dropped to 0, spec §4).

- [ ] **Step 1: Write the failing tests** — append to `forge/tests/smoke-replay.js` (above the final `console.log`):

```js
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
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `node forge/tests/smoke-replay.js`
Expected: the 7 Task-2 cases pass; the 8 new cases FAIL (✗).

- [ ] **Step 3: Implement** — in `forge/forge-replay.js`, add two helpers above `applyEvent`:

```js
  function applyDamage(u, dmg) { u.hp = Math.max(0, u.hp - dmg); u.downed = (u.hp === 0); }
  function applyEffects(state, effects) {
    (effects || []).forEach(function (e) {
      var u = state.units[e.unit]; if (!u) return;
      if (e.dmg) applyDamage(u, e.dmg);
      if (e.heal) { u.hp = Math.min(u.maxHp, u.hp + e.heal); if (u.hp > 0) u.downed = false; }
      if (e.add_condition && u.conditions.indexOf(e.add_condition) < 0) u.conditions.push(e.add_condition);
      if (e.remove_condition) u.conditions = u.conditions.filter(function (c) { return c !== e.remove_condition; });
    });
  }
```

and add these cases to the `applyEvent` switch (before `default:`):

```js
      case "move_declared":
        state.pendingAction = { kind: "move", unit: row.unit, path: p.path, seq: row.seq };
        break;
      case "move_resolved": {
        var mv = state.units[row.unit];
        var stop = p.interrupted_at || p.final_cell;
        if (mv && stop) mv.pos = { c: stop.c, r: stop.r };
        state.pendingAction = null;
        break;
      }
      case "attack_declared":
        state.pendingAction = { kind: "attack", unit: row.unit, target: p.target, roll: p.roll, seq: row.seq };
        break;
      case "attack_resolved": {
        if (p.hit && state.pendingAction && state.units[state.pendingAction.target])
          applyDamage(state.units[state.pendingAction.target], p.dmg || 0);
        applyEffects(state, p.effects);
        state.pendingAction = null;
        break;
      }
      case "ability_used":
        applyEffects(state, p.effects);
        break;
```

- [ ] **Step 4: Run to verify all pass**

Run: `node forge/tests/smoke-replay.js`
Expected: `15 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-replay.js && node --check forge/tests/smoke-replay.js`
Expected: clean. Record the pass count.

---

### Task 4: Reducer — prompts, chat, override / restore / edit

**Files:**
- Modify: `forge/forge-replay.js` (remaining switch cases; override pre-scan in `replayLog`)
- Test: `forge/tests/smoke-replay.js` (append)

**Interfaces:**
- Produces: full 17-kind reducer. `replayLog` pre-scans `override` events into a `corrections` map (seq → corrected payload) and substitutes at apply time — an incoming live `override`/`restore` therefore requires the caller to re-run `replayLog` (the pipeline does this, Task 7). `state.pendingPrompt = {seq, asker, to, react, timeout, context, created_at}`.

- [ ] **Step 1: Write the failing tests** — append to `forge/tests/smoke-replay.js`:

```js
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
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `node forge/tests/smoke-replay.js`
Expected: Task 2–3 cases pass; the 8 new FAIL.

- [ ] **Step 3: Implement** — add the remaining cases to the switch in `forge/forge-replay.js`:

```js
      case "prompt":
        state.pendingPrompt = {
          seq: row.seq, asker: row.unit, to: p.to, react: p.react,
          timeout: p.timeout, context: p.context || null, created_at: row.created_at
        };
        break;
      case "prompt_answered": {
        if (p.use && state.units[row.unit]) state.units[row.unit].reactionUsed = true;
        applyEffects(state, p.effects);
        state.pendingPrompt = null;
        break;
      }
      case "reaction_declared":
        if (state.units[row.unit]) state.units[row.unit].reactionUsed = true;
        applyEffects(state, p.effects);
        break;
      case "chat":
        state.chat.push({ unit: row.unit, text: p.text, seq: row.seq });
        break;
      case "override": break;   // consumed by replayLog's pre-scan, not at position
      case "restore": {
        var snap = JSON.parse(JSON.stringify(p.snapshot));
        Object.keys(state).forEach(function (k) { delete state[k]; });
        Object.assign(state, snap);
        break;
      }
      case "edit":
        (p.changes || []).forEach(function (ch) {
          var t = state.units[ch.unit]; if (!t) return;
          if (ch.pos) t.pos = { c: ch.pos.c, r: ch.pos.r };
          if (ch.hp != null) { t.hp = Math.max(0, Math.min(t.maxHp, ch.hp)); t.downed = (t.hp === 0); }
          if (ch.conditions) t.conditions = ch.conditions.slice();
        });
        break;
```

and replace `replayLog` with the pre-scanning version:

```js
  /* Pre-scan overrides (seq → correction), then replay in order. A restore
     resets state to its snapshot mid-replay — the dead branch is applied and
     then erased, one replay path (spec §5). */
  function replayLog(roster, rows) {
    var corrections = {};
    rows.forEach(function (row) {
      if (row.kind === "override") corrections[row.payload.corrects_seq] = row.payload.correction;
    });
    var state = initialState(roster);
    rows.forEach(function (row) { applyEvent(state, row, corrections); });
    return state;
  }
```

- [ ] **Step 4: Run to verify all pass**

Run: `node forge/tests/smoke-replay.js`
Expected: `23 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-replay.js && node --check forge/tests/smoke-replay.js && node forge/tests/smoke-protocol.js`
Expected: clean; both suites green. Record counts.

---

### Task 5: Memory bus with the identity gate (`forge-bus.js`)

**Files:**
- Create: `forge/forge-bus.js`
- Test: `forge/tests/smoke-protocol.js` (append)

**Interfaces:**
- Consumes: `ForgeProtocol.validateEvent`.
- Produces: `ForgeBus.makeMemoryBus({controllers, overseer, status?, now?}) → {setStatus(s), connect(actor) → conn}`. A **conn** is the transport contract every later consumer uses: `conn.publish(ev) → {ok, seq?|why?}` (may be sync or a Promise — callers must `Promise.resolve()` it), `conn.subscribe(fn(row))`, `conn.fetchAll() → rows` (may be a Promise). Rows are `{seq, unit, actor, kind, payload, created_at}`. The memory bus **mirrors the §1 SQL identity gate** so smokes prove the same rule RLS enforces.

- [ ] **Step 1: Write the failing tests** — append to `forge/tests/smoke-protocol.js`:

```js
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node forge/tests/smoke-protocol.js`
Expected: Task-1 cases pass; then FAIL at `Cannot find module '../forge-bus.js'`.

- [ ] **Step 3: Write the module**

Create `forge/forge-bus.js`:

```js
/* ── forge-bus.js ─────────────────────────────────────────────────────
   Battle Forge TRANSPORT (FORGE_PROTOCOL.md §1/§7). The pipeline talks to
   a bus; Supabase in production (Task 9 adds makeSupabaseBus), an
   in-memory fake here for headless smokes. The memory bus MIRRORS the SQL
   identity gate: live session AND (overseer OR you control the unit).
   Keep the gate logic in step with schema_delta_forge.sql.
   Dual export: browser (window.ForgeBus) + node.                          */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var api = factory(FP);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgeBus = api;
})(typeof self !== "undefined" ? self : this, function (FP) {

  function makeMemoryBus(opts) {
    opts = opts || {};
    var controllers = opts.controllers || {};
    var overseer = opts.overseer || null;
    var status = opts.status || "active";
    var now = opts.now || function () { return Date.now(); };
    var log = [], subs = [], nextSeq = 1;

    /* mirror of the RLS insert policy in schema_delta_forge.sql */
    function gate(actor, ev) {
      if (status !== "active") return "session not active";
      if (actor === overseer) return null;
      var mine = controllers[actor] || [];
      if (mine.indexOf(ev.unit) < 0) return "identity gate: " + actor + " does not control " + ev.unit;
      return null;
    }

    return {
      setStatus: function (s) { status = s; },
      connect: function (actor) {
        return {
          actor: actor,
          publish: function (ev) {
            var v = FP.validateEvent(ev);
            if (!v.ok) return { ok: false, why: v.why };
            var why = gate(actor, ev);
            if (why) return { ok: false, why: why };
            var row = { seq: nextSeq++, unit: ev.unit, actor: actor, kind: ev.kind,
                        payload: ev.payload || {}, created_at: now() };
            log.push(row);
            subs.forEach(function (fn) { fn(row); });
            return { ok: true, seq: row.seq };
          },
          subscribe: function (fn) { subs.push(fn); },
          fetchAll: function () { return log.slice(); }
        };
      }
    };
  }

  return { makeMemoryBus: makeMemoryBus };
});
```

- [ ] **Step 4: Run to verify all pass**

Run: `node forge/tests/smoke-protocol.js`
Expected: `19 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-bus.js && node --check forge/tests/smoke-protocol.js`
Expected: clean. Record the count.

---

### Task 6: Pipeline — actions over the bus, catch-up (`forge-pipeline.js`)

**Files:**
- Create: `forge/forge-pipeline.js`
- Test: `forge/tests/smoke-protocol.js` (append)

**Interfaces:**
- Consumes: `ForgeProtocol`, `ForgeReplay`, a bus **conn** (Task 5 contract).
- Produces: `ForgePipeline.makePipeline(deps) → pipe` where `deps = {conn, roster, me:{actor, units:[], overseer:bool}, reactions?, now?, onPrompt?, onPromptFallback?, onEvent?}`. Pipe API (exact — later tasks and the HUD build against it):
  - `pipe.state() → state` · `pipe.events() → rows` · `pipe.activeUnit() → unit|null` · `pipe.stateAt(seq) → state` · `pipe.catchUp() → Promise<state>`
  - `pipe.move(unit, path, resolveFacts)` / `pipe.attack(unit, facts, resolveFacts)` — `resolveFacts(answers) → resolution payload`; `answers` is the array of `prompt_answered` rows collected mid-action (empty when nothing reacted). **The caller's rules layer computes the resolution; the pipeline ferries facts.**
  - `pipe.rollInitiative(unit, roll)` · `pipe.endTurn(unit)` · `pipe.useAbility(unit, facts)` · `pipe.chat(unit, text)` · `pipe.answerPrompt(unit, promptSeq, use, extra?)`
  - Overseer: `pipe.start()` · `pipe.setInitiative(order)` · `pipe.override(seq, correction)` · `pipe.restoreTo(toSeq)` · `pipe.edit(changes)` · `pipe.end()` · `pipe.checkTimeouts()`
  - All action methods return `Promise<{ok, seq?|why?}>`. Session-level events use unit `"__session"` (only the overseer passes the gate for it — no special casing).
- `deps.reactions(state, declaredRow, answersSoFar) → [{to, react, context}]` — the reaction-candidate hook. **This plan wires the mechanism; the real candidate rules port from the topo mock in build step 5.** Smokes inject simple candidate functions.

- [ ] **Step 1: Write the failing tests** — append to `forge/tests/smoke-protocol.js`:

```js
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

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exitCode = fail ? 1 : 0;
})();
```

Also **delete** the old final `console.log(...)`/`process.exitCode` pair from the file's tail — the async block above now owns it.

- [ ] **Step 2: Run to verify it fails**

Run: `node forge/tests/smoke-protocol.js`
Expected: earlier cases pass; FAIL at `Cannot find module '../forge-pipeline.js'`.

- [ ] **Step 3: Write the module**

Create `forge/forge-pipeline.js`:

```js
/* ── forge-pipeline.js ────────────────────────────────────────────────
   Battle Forge acting-client PIPELINE (FORGE_PROTOCOL.md §3–§6). Wraps a
   bus connection: keeps a live replayed state, publishes this client's
   actions as declared → resolved pairs, asks reaction prompts mid-action
   and waits for the answers (exactly one asker per prompt — the device
   already mid-pipeline). Rules stay with the caller: resolveFacts()
   computes resolutions; deps.reactions() names candidates. This module
   ferries facts. Dual export: browser (window.ForgePipeline) + node.      */
(function (root, factory) {
  var FP = (typeof require !== "undefined") ? require("./forge-protocol.js") : root.ForgeProtocol;
  var FR = (typeof require !== "undefined") ? require("./forge-replay.js") : root.ForgeReplay;
  var api = factory(FP, FR);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ForgePipeline = api;
})(typeof self !== "undefined" ? self : this, function (FP, FR) {

  function makePipeline(deps) {
    var conn = deps.conn, roster = deps.roster;
    var now = deps.now || function () { return Date.now(); };
    var reactions = deps.reactions || function () { return []; };
    var events = [];
    var state = FR.initialState(roster);
    var awaiting = null;   // {promptSeq, resolve} — this client asked and is paused

    function controlsUnit(u) { return !!deps.me.overseer || deps.me.units.indexOf(u) >= 0; }

    function rebuild() { state = FR.replayLog(roster, events); }

    function ingest(row) {
      events.push(row);
      if (row.kind === "override" || row.kind === "restore") rebuild();  // corrections rewrite the past
      else FR.applyEvent(state, row, null);
      if (row.kind === "prompt" && controlsUnit(row.payload.to) && deps.onPrompt) deps.onPrompt(row);
      if (row.kind === "prompt_answered" && awaiting && row.payload.prompt_seq === awaiting.promptSeq) {
        var done = awaiting; awaiting = null; done.resolve(row);
      }
      if (deps.onEvent) deps.onEvent(row, state);
    }
    conn.subscribe(ingest);

    function publish(unit, kind, payload) {
      var ev = FP.makeEvent(unit, kind, payload);
      var v = FP.validateEvent(ev);
      if (!v.ok) return Promise.resolve({ ok: false, why: v.why });
      return Promise.resolve(conn.publish(ev));
    }

    /* ask each candidate one at a time, in order (spec §4: chained prompts).
       The awaiting token is claimed BEFORE the prompt publishes, so an
       instant answer on a synchronous bus cannot slip past the pause. */
    function ask(unit, cand) {
      return new Promise(function (resolve) {
        var token = { promptSeq: null, resolve: resolve };
        awaiting = token;
        publish(unit, "prompt", { to: cand.to, react: cand.react,
          context: cand.context || {}, timeout: 20 })
          .then(function (r) {
            if (!r.ok) { awaiting = null; resolve(null); return; }
            token.promptSeq = r.seq;
          });
      });
    }
    function askAll(unit, declaredRow) {
      var answers = [], asked = {};
      function next() {
        var cands = reactions(state, declaredRow, answers) || [];
        var c = null;
        for (var i = 0; i < cands.length; i++) {   // never re-ask the same (to, react):
          var key = cands[i].to + "|" + cands[i].react;   // a declined prompt must not loop
          if (!asked[key]) { c = cands[i]; asked[key] = true; break; }
        }
        if (!c) return Promise.resolve(answers);
        return ask(unit, c).then(function (a) { answers.push(a); return next(); });
      }
      return next();
    }

    function act(unit, declareKind, declarePayload, resolveKind, resolveFacts) {
      return publish(unit, declareKind, declarePayload).then(function (r) {
        if (!r.ok) return r;
        var declaredRow = { seq: r.seq, unit: unit, kind: declareKind, payload: declarePayload };
        return askAll(unit, declaredRow).then(function (answers) {
          return publish(unit, resolveKind, resolveFacts(answers));
        });
      });
    }

    return {
      state: function () { return state; },
      events: function () { return events.slice(); },
      activeUnit: function () { return FR.activeUnit(state); },
      stateAt: function (seq) {
        return FR.replayLog(roster, events.filter(function (e) { return e.seq <= seq; }));
      },
      catchUp: function () {
        return Promise.resolve(conn.fetchAll()).then(function (all) {
          events = all.slice(); rebuild(); return state;
        });
      },

      move: function (unit, path, resolveFacts) {
        return act(unit, "move_declared", { path: path }, "move_resolved", resolveFacts);
      },
      attack: function (unit, facts, resolveFacts) {
        // resolutions are self-contained facts: carry the declared target so
        // replay never depends on the shared pendingAction slot
        return act(unit, "attack_declared", facts, "attack_resolved", function (answers) {
          return Object.assign({ target: facts.target }, resolveFacts(answers));
        });
      },
      useAbility: function (unit, facts) { return publish(unit, "ability_used", facts); },
      rollInitiative: function (unit, roll) { return publish(unit, "initiative_rolled", { roll: roll }); },
      endTurn: function (unit) { return publish(unit, "turn_ended", {}); },
      chat: function (unit, text) { return publish(unit, "chat", { text: text }); },
      answerPrompt: function (unit, promptSeq, use, extra) {
        return publish(unit, "prompt_answered",
          Object.assign({ prompt_seq: promptSeq, use: !!use }, extra || {}));
      },

      /* overseer tools — the bus identity gate is the enforcement */
      start: function () { return publish("__session", "session_started", {}); },
      setInitiative: function (order) { return publish("__session", "initiative_set", { order: order }); },
      override: function (seq, correction) {
        return publish("__session", "override", { corrects_seq: seq, correction: correction });
      },
      restoreTo: function (toSeq) {
        var snap = FR.replayLog(roster, events.filter(function (e) { return e.seq <= toSeq; }));
        return publish("__session", "restore", { to_seq: toSeq, snapshot: FR.snapshot(snap) });
      },
      edit: function (changes) { return publish("__session", "edit", { changes: changes }); },
      end: function () { return publish("__session", "session_ended", {}); },

      /* timeout watch — the overseer device calls this on a UI tick; a stale
         prompt re-targets to the overseer's screen (spec §4.5) */
      checkTimeouts: function () {
        var p = state.pendingPrompt;
        if (p && deps.me.overseer && p.created_at != null &&
            now() - p.created_at > p.timeout * 1000) {
          if (deps.onPromptFallback) deps.onPromptFallback(p);
          return p;
        }
        return null;
      }
    };
  }

  return { makePipeline: makePipeline };
});
```

- [ ] **Step 4: Run to verify all pass**

Run: `node forge/tests/smoke-protocol.js`
Expected: `28 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/forge-pipeline.js && node --check forge/tests/smoke-protocol.js && node forge/tests/smoke-replay.js`
Expected: clean; both suites green. Record counts.

---

### Task 7: Pipeline — the cross-device reaction pause

**Files:**
- Modify: none (mechanism landed in Task 6 — this task proves the schedule-risk behavior end-to-end)
- Test: `forge/tests/smoke-protocol.js` (append inside the async block, before its final `console.log`)

**Interfaces:**
- Consumes: everything above. Injected reaction-candidate functions stand in for the build-step-5 rules port.

- [ ] **Step 1: Write the failing tests** — append inside the async block:

```js
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
```

- [ ] **Step 2: Run to verify the new cases fail**

Run: `node forge/tests/smoke-protocol.js`
Expected: prior 28 pass; new cases fail or hang — a hang here means the pause/resume race, which the awaiting-token order in Task 6 exists to prevent. (If it hangs, that is a FAIL: kill it and fix before proceeding.)

- [ ] **Step 3: Implementation**

None expected — Task 6 built the mechanism. If any case fails, fix `forge/forge-pipeline.js` (most likely suspects: the awaiting-token claim order in `ask()`, or `checkTimeouts()` clock math). Do not touch the reducer for pipeline failures.

- [ ] **Step 4: Run to verify all pass**

Run: `node forge/tests/smoke-protocol.js`
Expected: `35 passed, 0 failed`

- [ ] **Step 5: Validate**

Run: `node --check forge/tests/smoke-protocol.js && node forge/tests/smoke-replay.js && node forge/tests/smoke-forge-engine.js`
Expected: all green (engine smoke proves no collateral damage). Record all counts.

---

### Task 8: SQL migration (`schema_delta_forge.sql`)

**Files:**
- Create: `schema_delta_forge.sql` (repo root, append-only, like `schema_delta_feed.sql` etc.)

**Interfaces:**
- Produces: `forge_sessions` + `forge_events` tables whose columns match the Task 5 row contract exactly (`id` ↔ `seq`), RLS policies that are the SQL twin of `makeMemoryBus`'s `gate()`, realtime publication.

- [ ] **Step 1: Write the migration**

Create `schema_delta_forge.sql`:

```sql
-- schema_delta_forge.sql — Battle Forge event protocol (FORGE_PROTOCOL.md §1)
-- Append-only event log: state is derived by replay; rows are never updated
-- or deleted. RLS = the IDENTITY GATE only — no turn logic in the DB.
-- Twin of the gate() in forge/forge-bus.js: keep them in step.

create table if not exists forge_sessions (
  id          uuid primary key default gen_random_uuid(),
  overseer    uuid not null,
  map         jsonb not null,                     -- {seed, theme, sliders}
  roster      jsonb not null,                     -- [{unit, kind, sheet_ref|bestiary_ref}]
  controllers jsonb not null default '{}'::jsonb, -- {auth_uid: [unit,...]}
  status      text not null default 'staging'
              check (status in ('staging','active','ended')),
  created_at  timestamptz not null default now()
);

create table if not exists forge_events (
  id          bigint generated always as identity primary key, -- insert order IS seq
  session_id  uuid not null references forge_sessions(id),
  unit        text not null,
  actor       uuid not null default auth.uid(),
  kind        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists forge_events_session on forge_events (session_id, id);

alter table forge_sessions enable row level security;
alter table forge_events  enable row level security;

-- session members: the overseer or anyone in controllers
create policy forge_sessions_select on forge_sessions for select using (
  overseer = auth.uid() or controllers ? auth.uid()::text
);
create policy forge_sessions_overseer_write on forge_sessions for all using (
  overseer = auth.uid()
) with check (overseer = auth.uid());

create policy forge_events_select on forge_events for select using (
  exists (select 1 from forge_sessions s where s.id = session_id
          and (s.overseer = auth.uid() or s.controllers ? auth.uid()::text))
);

-- THE identity gate (spec §1): live session AND (overseer OR you control the unit).
-- No update/delete policies exist: the log is append-only by construction.
create policy forge_events_insert on forge_events for insert with check (
  exists (select 1 from forge_sessions s where s.id = session_id
          and s.status = 'active'
          and (s.overseer = auth.uid()
               or s.controllers -> auth.uid()::text ? forge_events.unit))
);

alter publication supabase_realtime add table forge_events;
```

- [ ] **Step 2: Verify**

No headless runner for SQL here. Verification checklist against the spec, line by line:
- `id bigint identity` = seq (spec §1 "insert order IS seq") ✓
- insert policy checks `status='active'` + overseer-or-controls-unit, nothing about turns ✓
- no update/delete policies → append-only ✓
- `actor default auth.uid()` → answered_by/forced_by derivable ✓
- realtime publication on `forge_events` ✓

Flag in the deploy note: **M runs this in the Supabase SQL editor** (staging first if available). If `supabase_realtime` publication doesn't exist on the project, the last line errors — then enable realtime for `forge_events` via the dashboard instead.

---

### Task 9: Supabase bus + browser harness mock

**Files:**
- Modify: `forge/forge-bus.js` (add `makeSupabaseBus`)
- Create: `forge/protocol-harness-mock.html` (standalone mock — CLAUDE.md hard rule 6: mock-first, never straight to a real page)
- Test: `forge/tests/smoke-protocol.js` (append: contract-shape check), then a manual two-window protocol

**Interfaces:**
- Produces: `ForgeBus.makeSupabaseBus({sb, sessionId}) → {connect() → conn}` — same conn contract as the memory bus (`publish` and `fetchAll` return Promises; RLS is the gate, so `publish` maps a Postgres error to `{ok:false, why}`). Harness page exposes `window.__forgeState() → JSON string of pipe.state()` (rev 2 step-7 QA hook).

- [ ] **Step 1: Add `makeSupabaseBus`** to `forge/forge-bus.js`, after `makeMemoryBus`, and export it:

```js
  /* Production transport. Same conn contract as the memory bus; the §1 RLS
     policies are the gate. deps: {sb: Supabase client, sessionId: uuid}    */
  function makeSupabaseBus(deps) {
    var sb = deps.sb, sid = deps.sessionId;
    return {
      connect: function () {
        return {
          publish: function (ev) {
            var v = FP.validateEvent(ev);
            if (!v.ok) return Promise.resolve({ ok: false, why: v.why });
            return sb.from("forge_events")
              .insert({ session_id: sid, unit: ev.unit, kind: ev.kind, payload: ev.payload || {} })
              .select("id").single()
              .then(function (res) {
                if (res.error) return { ok: false, why: res.error.message };
                return { ok: true, seq: res.data.id };
              });
          },
          subscribe: function (fn) {
            sb.channel("forge:" + sid)
              .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "forge_events",
                  filter: "session_id=eq." + sid },
                function (msg) {
                  var r = msg.new;
                  fn({ seq: r.id, unit: r.unit, actor: r.actor, kind: r.kind,
                       payload: r.payload, created_at: Date.parse(r.created_at) });
                })
              .subscribe();
          },
          fetchAll: function () {
            return sb.from("forge_events").select("*")
              .eq("session_id", sid).order("id", { ascending: true })
              .then(function (res) {
                if (res.error) { console.warn("[forge-bus] fetchAll:", res.error.message); return []; }
                return res.data.map(function (r) {
                  return { seq: r.id, unit: r.unit, actor: r.actor, kind: r.kind,
                           payload: r.payload, created_at: Date.parse(r.created_at) };
                });
              });
          }
        };
      }
    };
  }
```

Change the module's return to: `return { makeMemoryBus: makeMemoryBus, makeSupabaseBus: makeSupabaseBus };`

- [ ] **Step 2: Contract-shape smoke** — append to `forge/tests/smoke-protocol.js` inside the async block:

```js
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
```

Run: `node forge/tests/smoke-protocol.js` → Expected: `37 passed, 0 failed`

- [ ] **Step 3: Build the harness mock**

Create `forge/protocol-harness-mock.html` — standalone, no deps beyond the four modules + supabase-js from CDN. Contents:

```html
<!doctype html>
<meta charset="utf-8">
<title>Forge protocol harness</title>
<style>
  body { font: 14px/1.4 monospace; background: #14110e; color: #d8cdb8; margin: 16px; }
  button { font: inherit; margin: 2px; min-height: 44px; min-width: 44px; }
  #log { white-space: pre-wrap; border-top: 1px solid #4a3f30; margin-top: 12px; padding-top: 8px; }
  .warn { color: #d08a4a; }
</style>
<h3>Battle Forge — protocol harness (mock)</h3>
<div id="who" class="warn">connecting…</div>
<div id="controls"></div>
<div id="log"></div>
<script src="forge-protocol.js?v=fp1"></script>
<script src="forge-replay.js?v=fr1"></script>
<script src="forge-bus.js?v=fb1"></script>
<script src="forge-pipeline.js?v=fpl1"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
/* Two-window harness: open ?role=overseer in one window, ?role=player&unit=cosmere
   in another (different logged-in users). ?session=<uuid> joins an existing one.
   Every failure narrates into #log (CLAUDE.md: failures must narrate). */
(function () {
  var qs = new URLSearchParams(location.search);
  var logEl = document.getElementById("log");
  function say(s, warn) {
    var d = document.createElement("div"); if (warn) d.className = "warn";
    d.textContent = s; logEl.prepend(d);
  }
  // Reuse the site's supabase config: same URL/key pair the live pages use.
  // Paste them here when testing; the harness never ships to a real page.
  var SUPA_URL = qs.get("url") || "", SUPA_KEY = qs.get("key") || "";
  if (!SUPA_URL || !SUPA_KEY) { say("pass ?url=&key= (supabase project url + anon key) — harness idle", 1); return; }
  var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  var ROSTER = [
    { unit: "caim", side: "pc", pos: { c: 1, r: 1 }, hp: 30, reacts: [] },
    { unit: "cosmere", side: "pc", pos: { c: 2, r: 1 }, hp: 21, reacts: ["shield"] },
    { unit: "goblin1", side: "foe", pos: { c: 8, r: 8 }, hp: 7, reacts: ["oa"] }
  ];
  var role = qs.get("role") || "overseer", unit = qs.get("unit") || "cosmere";

  async function main() {
    var auth = await sb.auth.getUser();
    if (!auth.data || !auth.data.user) { say("not logged in — sign in on the live site first, same browser profile", 1); return; }
    var uid = auth.data.user.id;
    var sessionId = qs.get("session");
    if (!sessionId) {
      if (role !== "overseer") { say("player windows need ?session=<uuid> from the overseer window", 1); return; }
      var ins = await sb.from("forge_sessions").insert({
        overseer: uid, map: { seed: 7, theme: "grass", sliders: {} },
        roster: ROSTER, controllers: {}, status: "active"
      }).select("id").single();
      if (ins.error) { say("session create failed: " + ins.error.message, 1); return; }
      sessionId = ins.data.id;
      say("SESSION " + sessionId + " — open a player window with ?session=" + sessionId);
    }
    document.getElementById("who").textContent = role + " · " + (role === "overseer" ? "(all units)" : unit) + " · session " + sessionId;

    var conn = window.ForgeBus.makeSupabaseBus({ sb: sb, sessionId: sessionId }).connect();
    var pipe = window.ForgePipeline.makePipeline({
      conn: conn, roster: ROSTER,
      me: { actor: uid, units: role === "overseer" ? [] : [unit], overseer: role === "overseer" },
      reactions: function (st, declared) {   // stand-in candidates (real rules: build step 5)
        if (declared.kind !== "attack_declared") return [];
        var t = st.units[declared.payload.target];
        return (t && t.reacts.indexOf("shield") >= 0 && !t.reactionUsed)
          ? [{ to: declared.payload.target, react: "shield", context: { roll: declared.payload.roll } }] : [];
      },
      onPrompt: function (row) {
        if (confirm(row.payload.to + " — " + row.payload.react + "? (roll " +
            (row.payload.context && row.payload.context.roll) + ")"))
          pipe.answerPrompt(row.payload.to, row.seq, true);
        else pipe.answerPrompt(row.payload.to, row.seq, false);
      },
      onPromptFallback: function (p) { say("TIMEOUT → overseer: answer " + p.react + " for " + p.to, 1); },
      onEvent: function (row, st) {
        say("#" + row.seq + " " + row.unit + " " + row.kind + " " + JSON.stringify(row.payload));
      }
    });
    await pipe.catchUp();
    say("caught up — lastSeq " + pipe.state().lastSeq);
    window.__forgeState = function () { return JSON.stringify(pipe.state()); };

    var C = document.getElementById("controls");
    function btn(label, fn) {
      var b = document.createElement("button"); b.textContent = label;
      b.onclick = function () { fn().then(function (r) { if (r && r.ok === false) say("REJECTED: " + r.why, 1); }); };
      C.appendChild(b);
    }
    if (role === "overseer") {
      btn("start", function () { return pipe.start(); });
      btn("initiative", function () { return pipe.setInitiative(["caim", "goblin1", "cosmere"]); });
      btn("goblin attacks cosmere (19)", function () {
        return pipe.attack("goblin1", { target: "cosmere", roll: 19, mode: "melee" },
          function (a) { return (a.length && a[0] && a[0].payload.use) ? { hit: false } : { hit: true, dmg: 6 }; });
      });
      btn("GOD MODE: goblin hp 3", function () { return pipe.edit([{ unit: "goblin1", hp: 3 }]); });
      btn("force end turn", function () { return pipe.endTurn(pipe.activeUnit() || "caim"); });
    } else {
      btn("move to (3,3)", function () {
        return pipe.move(unit, [{ c: 2, r: 1 }, { c: 3, r: 3 }],
          function () { return { final_cell: { c: 3, r: 3 } }; });
      });
      btn("end turn", function () { return pipe.endTurn(unit); });
      btn("write for CAIM (should be REJECTED)", function () { return pipe.chat("caim", "imposter"); });
    }
    btn("chat", function () { return pipe.chat(role === "overseer" ? "goblin1" : unit, "hello from " + role); });
    setInterval(function () { pipe.checkTimeouts(); }, 1000);
  }
  main();
})();
</script>
```

- [ ] **Step 4: Validate headless, then in the browser**

Run: `node --check forge/forge-bus.js && node forge/tests/smoke-protocol.js && node forge/tests/smoke-replay.js`
Expected: clean, `37 passed` + `23 passed`.

Browser (M or a supervised session, after the SQL is applied): open two windows — `forge/protocol-harness-mock.html?role=overseer&url=…&key=…` and `…?role=player&unit=cosmere&session=<id>&url=…&key=…` with **two different logged-in users**. Manual checklist:
1. Overseer: start → initiative. Player window shows both events in its log.
2. Player: move — both windows show declared + resolved.
3. Overseer: "goblin attacks cosmere" — the **player** window gets the confirm(); answering yes resolves the attack as a miss in **both** windows.
4. Let a prompt sit 20s — overseer window logs the TIMEOUT fallback line.
5. Player: "write for CAIM" — REJECTED by RLS, narrated. **This is the live proof of the identity gate.**
6. Refresh the player window mid-fight → it catches up to the same `__forgeState()`. Compare: run `JSON.parse(__forgeState()).lastSeq` in both consoles — equal.

---

### Task 10: Docs + full-suite validation + deploy note

**Files:**
- Modify: `CONTEXT_Forge.md` (§2 file map — add four module rows + the two new smokes), `forge/README.md` (one short "protocol" section pointing at `FORGE_PROTOCOL.md`)

**Interfaces:** none — documentation and the final gate.

- [ ] **Step 1: Update `CONTEXT_Forge.md` §2** — append to the file-map table:

```markdown
| `forge/forge-protocol.js` | event vocabulary: 17 kinds, envelope validation. No `turn_started` — derived | canonical |
| `forge/forge-replay.js` | reducer: log → state. Facts only, never rules. Override pre-scan, restore branch, GOD-MODE edit | canonical |
| `forge/forge-bus.js` | transport: MemoryBus (headless, mirrors the RLS identity gate) + SupabaseBus | canonical |
| `forge/forge-pipeline.js` | acting-client pipeline: declared→resolved, cross-device prompts, timeout→overseer | canonical |
| `forge/protocol-harness-mock.html` | two-window Supabase harness, `__forgeState()` dump | mock |
```

- [ ] **Step 2: Update `forge/README.md`** — add at the end:

```markdown
## Protocol (multiplayer spine)

`forge-protocol.js → forge-replay.js → forge-bus.js → forge-pipeline.js`.
Design: `FORGE_PROTOCOL.md` (repo root). State is derived by replaying the
append-only `forge_events` log; the bus is swappable (memory in smokes,
Supabase live); RLS enforces identity only — turn order is client-gated.
Smokes: `tests/smoke-protocol.js`, `tests/smoke-replay.js`.
```

- [ ] **Step 3: Full-suite gate**

Run, from repo root:
```
node --check forge/forge-protocol.js && node --check forge/forge-replay.js && \
node --check forge/forge-bus.js && node --check forge/forge-pipeline.js && \
node forge/tests/smoke-protocol.js && node forge/tests/smoke-replay.js && \
node forge/tests/smoke-forge-engine.js && node forge/tests/smoke-los-cover.js && \
node forge/tests/smoke-placement.js && node forge/tests/smoke-flora.js
```
Expected: every file parses; every suite reports `0 failed`. Paste all counts.

- [ ] **Step 4: Deploy note for M**

One line per file:
```
forge/forge-protocol.js, forge/forge-replay.js, forge/forge-bus.js,
forge/forge-pipeline.js, forge/protocol-harness-mock.html → forge/ ;
forge/tests/smoke-protocol.js, forge/tests/smoke-replay.js → forge/tests/ ;
schema_delta_forge.sql → repo root, THEN run its contents in the Supabase SQL
editor ; CONTEXT_Forge.md, forge/README.md → repo root/forge (doc updates).
```

---

## Self-Review (performed while writing)

- **Spec coverage:** §1 → Tasks 5/8 · §2 → Tasks 1–4 (17 kinds, no turn_started, prompt-unit rule exercised by the identity-gate smokes) · §3 → Tasks 2/6 (on-deck / planned-turn / pre-move-warning UI are explicitly out of scope — client HUD, later build steps; the hooks exist: `state()`, `activeUnit()`, `onPrompt`) · §4 → Tasks 4/7 incl. both of M's OA rulings · §5 → Tasks 4/6 (override, restore w/ inline snapshot via `stateAt`/`restoreTo`, GOD-MODE edit incl. typed numbers riding `prompt_answered.roll`/`edit`) · §6 → `catchUp()` + refresh case in Task 9's browser checklist (▶/⏩ playback UI is out of scope; the replay loop it throttles is `applyEvent`, already event-by-event) · §7 → the whole test ladder (memory bus before network, determinism, pending-prompt recovery, two-browser harness).
- **Type consistency:** row shape `{seq, unit, actor, kind, payload, created_at}` and conn contract `{publish, subscribe, fetchAll}` are identical across Tasks 5/6/9; state shape declared once in Task 2 and consumed unchanged after.
- **Placeholder scan:** no TBDs; every code step carries the actual code; the only deferred work is named with its owning build step.
