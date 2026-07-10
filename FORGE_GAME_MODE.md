# Battle Forge — Game Mode Design
*Brainstorm output, 2026-07-09 (rev 2). Decision record + architecture + build order.*
*Goal: BG3-grade interactive tactical combat, played as a real game of 5e at the table.*
*Build step 4 (the protocol spine) is deep-designed in **`FORGE_PROTOCOL.md`** (2026-07-10).*

---

## 1 · Decisions made (settled — do not relitigate)

| Question | Decision |
|---|---|
| Who looks at what | **Every player fully controls their character on their own device.** The DM runs the overseer view from the admin side. |
| Who rolls | **Players tap to roll on their own device.** The roll happens there; the result travels inside the event as a fact. No physical-dice entry mode in v1 (the design leaves the door open: an event can carry an entered result instead of a generated one). |
| Where the rules run | **The same engine ships to every browser.** ToK has no compute server — Netlify serves files, Supabase provides Postgres, auth, and realtime. So the acting player's client resolves their own action (movement legality, range, LoS, cover, their roll) using the same TG module everyone loaded, and publishes the outcome as events. |
| Authority | **The overseer (DM, admin side) holds override** — foes, rewind, adjudication (readied triggers, disposition, disputes). Player actions do not route through the overseer's machine; nobody's computer is "the server." |
| Supabase's job | Ordering (event `seq`), persistence (append-only event log), fan-out (realtime channels), late-join snapshots. Not rules resolution. |

## 2 · Client roles

**Player device (tablet/phone — touch-first):**
- Their character's turn HUD: move telegraph, action buttons, resource pips, tap-to-roll.
- Resolves their own actions with the shared engine; publishes events; sees everyone's rolls in the feed.
- **Receives reaction prompts** (Shield, Silvery Barbs, opportunity attacks, readied releases) addressed to their character, mid-pipeline.
- Full board view, free camera. (Per-player fog/LoS deferred — §7.)

**Overseer device (desktop, admin side):**
- Runs foe turns locally with the same engine; publishes foe events.
- Initiative transport, rewind (overseer-only), readied-trigger release row, manual overrides.
- Can spot-correct any bad event (override event supersedes it in the log).

## 3 · Protocol sketch

Append-only event log; events are facts, state is derived by replaying them in order:

```
forge_sessions   id · map_seed · roster · status · created_at
forge_events     id · session_id · seq · actor · unit · kind · payload · created_at
```

- The acting client resolves and **publishes events** directly:
  `{seq:184, unit:"cosmere", kind:"moved", path:[...], provoked:["foe2"]}`
  `{seq:185, unit:"cosmere", kind:"attacked", target:"foe2", roll:17, adv:"flank", hit:true, dmg:9}`
- `seq` comes from insert order — Postgres is the single ordering point, which is all the "referee" a turn-based game needs. Turn gating (only the active unit's controller may publish action events) blocks out-of-turn writes.
- **Reaction pause:** the attacker's client emits `{kind:"prompt", to:"cosmere", react:"shield", timeout:20}` and waits; Cosmere's device answers with a response event; the attacker's pipeline resumes. Timeout falls back to the overseer so a sleeping tablet can't hang the fight.
- Rewind = overseer publishes a `restore` event with a snapshot ref; every client rebuilds. The existing snapshot format already serializes what's needed.
- Late join / refresh = latest snapshot + replay the tail.

## 4 · What already exists vs what's new

**Ports directly:** the whole rules engine (TG, reactions, flanking, OAs, Ready, rewind), feel layer, directional sprites, biome rigs, snapshot format, Supabase auth + realtime patterns (`combatants-backend.js`, `feed-bridge.js`), Soul Shards data via `CharacterData`, bestiary import.

**New builds:**
1. Event protocol + replay loop (the spine).
2. Player-scoped HUD (a cut of the combat HUD, touch-first).
3. Cross-device reaction prompts (the hard part).
4. Session lifecycle: create fight → players claim characters (`__fightControllers` already anticipates this) → start.

## 5 · Vertical slice (first playable)

One fight: real party of 4 from live sheets, bestiary goblins, one biome. Players on tablets move, attack, roll, and answer reaction prompts; overseer runs foes, triggers a readied action, rewinds once to prove sync. No fog, no AoE templates, nothing beyond what the mock does today.

## 6 · Build order

1. **Look pass** (mock, no netcode): N8AO + selective bloom + tilt-shift composer (`postprocessing@6.39.2`), torch glow sprites, CSS grain/vignette.
2. **Generator rebase**: topo mock's stale inlined generator → canonical `forge-dungeon.js` pipeline. Before netcode, so the map layer stops being a fork.
3. **De-mock data**: CHAR kits ← Soul Shards sheets (`CharacterData`); foes ← bestiary. Sheet → engine-actions derivation layer.
4. ~~**Protocol + replay loop**~~ — **DONE, out of order, 2026-07-10.** Shipped as
   `forge/forge-protocol.js` / `forge-replay.js` / `forge-bus.js` / `forge-pipeline.js` +
   `schema_delta_forge.sql`, spec'd in `FORGE_PROTOCOL.md`, 70 protocol smokes green.
   **Field-verified same night** on two real browsers via `forge/protocol-harness-mock.html`:
   movement, attacks, cross-device Shield prompt (changed a hit to a miss), duplicate-answer
   guard observed working live. The board-less part of step 5 came with it.
5. **Reactions + readied over the wire.** ~~The cross-device pipeline pause~~ — pause is
   built and field-verified (step 4). Remaining: **readied actions**, and prompt UX per
   design (player device gets the modal; overseer sees "waiting on X" and inherits only on
   the 20s timeout — the harness crudely pops both, the real HUD must not).
6. **Marry protocol to the board** *(recommended next)*: generator rebase (was step 2 —
   topo mock's stale inlined generator → canonical `forge-dungeon.js`), `{seed,theme,sliders}`
   from the session row so two devices render the identical dungeon, tokens driven by the
   event log. Starts de-mock of CHAR kits (was step 3).
7. **Look pass** (was step 1 — still mock-first, still owed): N8AO + selective bloom +
   tilt-shift composer (`postprocessing@6.39.2`), torch glow sprites, CSS grain/vignette.
   Lands best on a board that is already multiplayer.
8. **Player HUD touch polish**; party sprite sheets for Caim / Cosmere / Líadan; the
   character-claim lobby (replaces the harness's uid-paste assign box).
9. **QA harness**: `window.__forgeState()` (shipped in the harness) + a local Playwright
   replay script — catches the browser-integration class of bug before handover.

## 7 · Deferred (explicitly, so it doesn't creep)

- Per-player fog of war / LoS-scoped vision (`occ[]` makes it possible; very BG3; after the slice works).
- Physical-dice entry mode (an event carrying an entered result).
- AoE templates / `drawings`-table integration on the 3D board.
- Foes readying; reach weapons (`reachOf()` is the door); mounted/flying movement.
- Intent-level validation (overseer or edge-function spot-checks) — trusted clients are the right weight for a home table.
- Spectator mode.

## 8 · Risks, named

- **The cross-device reaction pause is the schedule risk.** Everything else is porting; this is new distributed behavior. Build it isolated (step 5) with the timeout-to-overseer fallback from day one.
- **Divergence**: a stale client publishing from old state. Mitigations: turn gating, `seq` ordering, events carry the `seq` they were computed against, and any conflict resolves by replaying the log — the log wins, always.
- **Touch**: the mock is mouse-first; the player HUD needs 44px+ targets and zero hover-dependent affordances.
