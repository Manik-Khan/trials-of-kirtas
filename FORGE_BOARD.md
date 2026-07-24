# Battle Forge — Marrying the Protocol to the Board
*Design spec, 2026-07-10 (brainstorm with M, same day). Companion to `FORGE_GAME_MODE.md`
(this is its build step 6, grown) and `FORGE_PROTOCOL.md` (whose decisions stand — the one
extension here is §6's `edit.add_unit`). Sliced into two bites; this doc specs **bite 1**.*

---

## §0 · The two bites (settled)

Everything M picked stays on the menu; it cooks in two rounds so each lands testable:

- **Bite 1 (this spec):** the marriage. Shared dungeon from the session row, the full turn
  loop on the real board, party.html-style claim screen, live + staged fight creation,
  real sheet stats with **curated starter action bars**, bestiary foes incl. mid-fight
  arrivals, sheet⇄fight live mirror.
- **Bite 2 (own spec later):** the **sheet→actions derivation layer** — every real weapon
  action and spell from the live Soul Shards sheets becomes buttons (slots, resources,
  targeting; the AoE ruling lives there). Plus ▶ watch-what-I-missed catch-up and the
  feel-layer port debts (`CONTEXT_Forge.md` §8 list: badges, hit flash, shake, bob,
  floating damage, flanking/OA/Ready).

Bite 1 swaps in cleanly under bite 2: the starter bar is one small data table the
derivation layer replaces.

## §1 · Decisions record (M, 2026-07-10)

| Question | Decision |
|---|---|
| Milestone shape | **Full turn loop on the board** — initiative, turn gating, End Turn, prompts on the real 3D board; the vertical slice, not a sync-only sandbox |
| Approach | **Marry in place + seam module.** The topo mock stays THE surface; one new translator module (`forge/forge-board.js`); generator rebase lands first, alone |
| Getting in | **party.html arcade select is the claim screen.** Roster filtered to the character panel's **"Campaign Characters" folder** — filter applies **only to the battle select**; party.html as a viewer still shows everyone |
| Hidden characters | Chonkalius (guest) / The Wiz (DM's test) simply aren't in the folder → not in the select. Folder members with no combat sheet stay **greyed, narrated, never dropped** |
| Fight creation | **Both doors from day one:** forge live at the table AND staged prep (same session row, `status='staging'`; overseer-only staged-fights list) |
| Party data | **The combat IS the sheet.** Stats and vitals live from `CharacterData`; fight changes mirror back to the sheet in real time (§5). Action bar = curated starter set (full derivation = bite 2) |
| Foes | **Bestiary now**, through what exists: combat.html's 5etools picker + `saved_monsters` shelf + `monster-actor.js` adapter. Statblocks snapshot into the fight. ★ saves a fight foe back to the shelf |
| Reinforcements | **Mid-fight arrivals in bite 1** via a protocol extension: `edit.add_unit` (§6) |
| Catch-up | ⏩ jump-to-now ships; ▶ watch mode deferred to bite 2 (theater, not fight night) |

## §2 · Architecture — one row, one log, N identical boards

Unchanged from `FORGE_PROTOCOL.md`, now with a board attached:

- `forge_sessions` = the fight's cover sheet: `map {seed, theme, sliders}`, `roster`,
  `controllers`, `status staging→active→ended`.
- `forge_events` = everything said at the table. State is derived by replay. **The log
  wins, always** — a device's own tap renders only when its event comes back. That is the
  whole sync story; refresh lands exactly right for free.
- Every device runs `ForgeEngine.generate(map)` locally — same seed, same dungeon,
  validated (the engine retries invalid maps deterministically).
- **One new module: `forge/forge-board.js`** — the translator, dual-export like its
  siblings, pure logic with render calls injected:
  - *wire → board:* replayed/incoming events become **board verbs** — walk this path,
    set this HP, advance the turn marker, open this prompt.
  - *board → wire:* local taps run the local engine (legality, LoS, provoke warning),
    then publish through `ForgePipeline`; the board mutates on the echo, never on the tap.
- **Local sandbox survives.** No session in the URL → the mock's current single-device
  combat, untouched. The multiplayer path is additive.

Boot recipe (per the harness, `forge/protocol-harness-mock.html`): supabase client →
`ForgeBus.makeSupabaseBus({sb,sessionId}).connect()` → `ForgePipeline.makePipeline({conn,
roster, me, reactions, onPrompt, onEvent, onPromptFallback})` → `catchUp()` → forge-board
translates both ways; `setInterval(pipe.checkTimeouts, 1000)`.

## §3 · Fight lifecycle

**Two doors, one row.**
- *Live:* overseer opens the battle page, dials the dungeon, **Open the table** → session
  row written, `status='staging'`. Players claim. **Start fight** → vitals snapshot (§5),
  `session_started`, initiative.
- *Staged:* same forge controls, **Save for later** → row parks in `staging`. Overseer-only
  **staged fights** list on the battle page: open one at the table, same flow onward.
  (Abandon = flip to `ended`; rows are cheap, events append-only.)

**The knobs get honest.** `map.sliders` stores the *generator's* inputs —
`{roomCount, loopChance, decorDensity, verticality, foes, heightMode}` (ForgeEngine
DEFAULTS keys) — plus `map.seed` and `map.theme` (canonical key: `grass druidic tundra
swamp temple cavern volcanic`). Today's mock sliders that are really *camera* knobs
(height exaggeration `STEP`, grid opacity, prop size) stay **local per device**, never in
the row.

**Claiming.** Battle page with a forming fight → arcade select (the party.html scene the
mock's `#partySelect` already mirrors), cards = session roster ∩ **Campaign Characters
folder** (the roster-layout doc in `character-data.js`: `{folders, order, members}`).
Claimed card shows who took it. Tap → claim. `window.__fightControllers` (badge/seat
color) becomes a *derivation from the row's `controllers`*, not a local invention.

**New SQL (append-only migration, `schema_delta_forge_board.sql`):** players can't write
the session row (`forge_sessions_overseer_write` is overseer-only, correctly). Add
`forge_claim_unit(session_id, unit)` — security-definer RPC: caller is a member; session
not `ended`; unit in roster, kind `pc`, unclaimed → append caller's uid→unit into
`controllers`. Race-safe (row lock): first tap wins, second is told. Claims allowed
mid-fight (a late player takes over their PC from the DM). Unclaim/reassign = overseer
edits `controllers` directly (existing policy). The MemoryBus-style twin of this rule goes
in the test gate (§9).

**Empty seats never block.** Overseer starts anyway; unclaimed units fall to the overseer
(already how the protocol works); their card says **"run by the DM."**

## §4 · The marriage itself

**Step 1, alone, before any netcode: the generator rebase** (closes `CONTEXT_Forge.md`
§5.5). The mock's inlined stale generator (old keys `ancient/molten/frost/grim/verdant`,
`themeKey` hardcoded `'verdant'` at `forge/topography-test-mock.html:1758`) is replaced by
canonical `forge-engine.js` → `forge-dungeon.js` → `map-bridge.js`; wall/prop occluder
heights via `MapBridge.wallFeetFor()` / `propFeet()` — the same table the sight lines use.
The seven canonical biomes drive **both** the dungeon's bones and the LOOK/FLORA skin
(today a chip only repaints). Single-device, verified against the settled-geometry smokes
on real seeds, eyeballed by M, then frozen as the foundation.

**Step 2: `forge/forge-board.js`.**
- *Open a fight:* read row → generate → replay → place tokens where the story says;
  mid-prompt rejoin shows the prompt with the countdown adjusted from its `created_at`.
- *Turn discipline:* action buttons only on the active unit's controller device; everyone
  sees whose turn it is + on-deck glow (pure derivation). Overseer always has controls.
- *Prompts routed per spec §4:* modal + visible countdown **only** on the prompted
  player's device; everyone else "waiting on Cosmere…"; timeout falls to the overseer.
  (The harness pops prompts everywhere; the board must not.)
- *Initiative:* roll button on each player's device (`initiative_rolled`); overseer rolls
  foes/absent; overseer confirms order (`initiative_set`, pre-sorted, one tap).
- *Overseer toolbar v1:* force end turn · correct last event (`override`) · rewind
  (`restore`, tokens jump to the snapshot; the dead branch greys in the feed) · GOD MODE
  (`edit`: drag unit, set HP/conditions, type rolls) · **Add foe** (§6) · end fight.
- *Catch-up:* ⏩ jump-to-now only. ▶ watch = bite 2.
- Cache-stamp every new/changed include (`?v=fb1` etc.) and bump on change — iOS rule.

## §5 · The sheet is the character

M's frame: an RPG's status screen — open it mid-fight and the changes are already there.
One character, two windows.

- **Fight opens from the sheet.** At **Start fight**, the overseer device reads each PC's
  current `CharacterData` vitals and **writes them into the row's roster as facts**
  (starting HP/hpMax/etc.), then publishes `session_started`. Replay reads the roster —
  deterministic even if sheets change later. A party that limped in at half HP fights at
  half HP.
- **Live mirror back.** Whenever replayed state changes a PC's vitals, that unit's
  **controlling device** (overseer for unclaimed) writes the derived value to the sheet —
  `CharacterData.save(key, {vitals})`, **absolute values, never deltas**. Rewind/override/
  GOD MODE just re-set the number; nothing needs un-writing. One writer per unit, no races.
- **During an active fight the board is the pen.** Mid-fight healing happens as fight
  events (so the table sees it); a direct sheet edit during a fight gets overwritten by
  the mirror — the fight log is the live authority until `session_ended`.
- **Between fights nothing changes:** the sheet is boss, as always.
- Mirror failure never stalls a fight: log stays authoritative, mirror retries, small
  "sheet catching up" note. Narrated, per house rule.
- Foes have no sheets; their HP lives only in the fight (their home is §6's shelf).
- **Explicit TEST exception.** A disposable Test Fight persists its presets in
  `map.testFight`, transforms only the roster snapshot at Start fight, and
  never starts or drains the sheet-mirror queue. Campaign rows carry no TEST
  flag, so this exception cannot silently change an ordinary table.

## §6 · Foes — the shelf, the books, and reinforcements

All existing machinery, pointed at the Forge:

- **Pick:** combat.html's DM-only 5etools bestiary picker + the `saved_monsters` shelf
  (`{id,name,statblock,tags}`; custom names, tag chips, CR groups) become the Forge's foe
  picker at forge time. Count/placement uses the engine's foe spawns.
- **Snapshot:** chosen statblocks are **copied into the session roster** — a fight never
  changes because a source file updated.
- **Adapt:** `monster-actor.js` (statblock → `{combat:{ac,hp,speed}, actions:[…]}`, parses
  `{@hit}`/`{@damage}`, degrades gracefully to readable notes) feeds the same engine-actor
  shape PCs use. Its output drives the overseer's foe turn HUD.
- **Save back:** ★ on any fight foe writes it to `saved_monsters` for next time.
- **Mid-fight arrivals — the one protocol extension.** `edit` (GOD MODE, overseer-only —
  privilege already enforced by RLS + the bus twin) learns an optional change:
  `{add_unit: {unit, name, kind:'foe', statblock, pos, disposition?, size?}}`.
  The event carries the **full snapshot inline**, so any replay — late joiner, refresh,
  branch — reconstructs the arrival with no outside dependency. `forge-replay` creates the
  unit (HP from statblock); duplicate `unit` id is rejected with a narrated `why`.
  UX: overseer toolbar **Add foe** → shelf/books → tap a cell → `edit` published.
  No schema change (payload is jsonb); `FORGE_PROTOCOL.md` §2 gains the payload note.

## §7 · Starter action bars (bite 1 only)

One small data table, per PC: their real weapon attack, one signature spell/ability,
Dash, Dodge, End Turn — numbers (to-hit, damage, save DCs) computed from the live sheet.
Reactions go to whoever actually has them; the pipeline already speaks Shield, Silvery
Barbs, Hellish Rebuke. No AoE in the starter set (templates are out of scope; the AoE
ruling belongs to bite 2's derivation layer). This table is scaffolding — bite 2 deletes
it.

## §8 · Failure behavior — everything narrates, nothing diverges

- Refresh/drop → replay lands exactly right (turn HUD, or prompt with adjusted timer).
- Unanswered prompt → 20 s → overseer answers as the unit; `actor` records who.
- Failed publish → nothing moved anywhere (the tap never rendered locally); player sees
  "couldn't reach the table — retry."
- Sheet-mirror failure → fight continues; retry + "sheet catching up" note (§5).
- Claim race → first wins, second told. No combat sheet → greyed card, says why.
- Stale client → pipeline dedups by seq and replays; conflicts resolve by replay.

## §9 · Test plan (repo tradition: real functions, real field)

1. `node --check` everything touched; **all existing suites stay green** (83 forge smokes
   + placement/flora/los + 70 protocol smokes).
2. **Rebase smoke:** the mock's generate path runs canonical `ForgeEngine.generate` over
   real seeds; §4-geometry invariants (`smoke-los-cover.js` cases) hold on the produced
   maps.
3. **`forge/tests/smoke-forge-board.js`** (known-answer): scripted logs → exact expected
   board-verb sequences, headless — move/attack/turn/prompt/timeout/restore/edit/
   `add_unit`/claim-gate cases. The claim rule gets a MemoryBus-style twin so the RLS
   behavior is testable in Node.
4. **Replay cases added** to the protocol smokes: `edit.add_unit` mid-log; arrival then
   `restore` behind it; duplicate-unit rejection.
5. **Mock-first for new faces:** forge-knobs panel, claim screen wiring, turn HUD, prompt
   modal — standalone, M approves the look before wiring.
6. **The proof: two-device field checklist** (harness-style, M drives): forge live →
   claim on tablet → initiative → synced move/attack → Shield modal on the right device
   *only* → timeout falls to overseer → refresh mid-prompt → open a staged fight →
   mid-fight reinforcement → sheet page shows fight damage live → ★ saves a foe.
   M's field report is ground truth.

## §10 · Out of scope (bite 1)

Sheet→actions derivation layer, AoE ruling, ▶ watch catch-up, feel-layer ports (badges,
hit flash, shake, bob, floating damage), flanking/OA/Ready on the board, per-player fog,
spectator mode, Playwright QA (rev 2 step 7). All previously named; none forgotten.

---

## Appendix — Field checklist (bite 1)

§9.6's proof, run by M at the table with two real devices and the live Supabase — the
class of bug the smokes cannot see. Tick each box; M's report is ground truth.

- [ ] **1. Apply `schema_delta_forge_board.sql`** in the Supabase SQL editor, first, before
  anything below. *Expected:* runs clean (idempotent), no error.
- [ ] **2. Forge a fight live** at the table — dial the dungeon, **Open the table**.
  *Expected:* a session row appears, `status='staging'`.
- [ ] **3. Save for later, then open a staged fight** — park a fight in staging, confirm
  it's on the overseer's staged-fights list, open it. *Expected:* same flow onward,
  nothing lost.
- [ ] **4. Claim a PC on the tablet, including a same-PC race** — two devices tap the same
  card together. *Expected:* first tap wins, the loser is told, no double-claim.
- [ ] **5. Folder filter** — check the claim select. *Expected:* Chonkalius and The Wiz are
  absent (no combat sheet); the four-PC party is present.
- [ ] **6. Initiative lobby on both devices.** *Expected:* each player sees their own roll
  button; overseer rolls for foes/absent; the confirmed order matches on every screen.
- [ ] **7. Synced move + attack.** *Expected:* a tap on one device renders (tween/attack)
  on the other device only from the echo — never from the local tap.
- [ ] **8. Shield modal routing.** *Expected:* the modal (with countdown) appears **only**
  on the targeted player's device; every other device, including the overseer, shows a
  "waiting on X" banner.
- [ ] **9. Let a prompt time out.** *Expected:* falls to the overseer's screen, who answers
  as the unit; the event's `actor` stamp shows the overseer answered.
- [ ] **10. Refresh mid-prompt AND refresh mid-turn** (two checks). *Expected:* mid-prompt
  refresh comes back showing the same prompt with the timer adjusted; mid-turn refresh
  comes back showing the turn HUD, no state lost.
- [ ] **11. A foe's turn run by the DM.** *Expected:* the overseer's local action publishes
  and resolves identically on every device.
- [ ] **12. Mid-fight reinforcement** — **Add foe** from the toolbar, place it, slot into
  initiative. *Expected:* the fight resumes at the currently-active unit — no round
  restart.
- [ ] **13. Rewind.** *Expected:* tokens jump to the snapshot; the abandoned branch greys
  out in the feed on every device.
- [ ] **14. Sheet mirror + persistence** (four checks in one pass): the character sheet
  page shows fight damage live; a rewind re-sets the sheet's number too; ★ on a fight foe
  makes it appear on the `saved_monsters` shelf in `combat.html`; and a fight opened on a
  wounded PC starts at their true (not full) HP.
