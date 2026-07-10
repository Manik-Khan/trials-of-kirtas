# Battle Forge — Event Protocol Design
*Design spec, 2026-07-10. Companion to `FORGE_GAME_MODE.md` (rev 2) — this deep-designs
its build step 4, the protocol spine. Rev 2's decisions stand; nothing here relitigates them.*

---

## §1 · Storage & security

Two tables. Append-only: no row is ever updated or deleted; corrections are new events.

```
forge_sessions
  id           uuid pk
  map          jsonb        -- {seed, theme, sliders} → regenerates identical map on every client
  roster       jsonb        -- [{unit, kind:"pc"|"foe", sheet_ref|bestiary_ref}]
  controllers  jsonb        -- {auth_uid: [unit,...]}; overseer marked separately
  status       text         -- staging → active → ended
  created_at   timestamptz

forge_events
  id           bigserial pk -- THE ordering. Insert order IS seq (rev 2). No separate counter.
  session_id   uuid fk
  unit         text         -- which unit the event is about
  actor        uuid         -- auth uid that wrote it. answered_by/forced_by falls out free.
  kind         text         -- §2 vocabulary
  payload      jsonb
  created_at   timestamptz
```

- **RLS = the identity gate plus the privileged-kind guard.** Insert allowed iff `actor` is
  pinned to `auth.uid()` (no impersonation via a spoofed `actor` column) AND session
  `status='active'` AND EITHER the actor is the session's overseer (who may write any kind
  for any unit) OR `unit ∈ controllers[actor]` AND `kind` is not one of the six privileged
  kinds (`session_started`, `initiative_set`, `session_ended`, `override`, `restore`,
  `edit`) — those are overseer-only regardless of unit control. Select for session members.
  **No turn logic in the DB** — turn order is client-UI enforced (no action buttons
  off-turn) + overseer override. Reactions and chat are legitimately out-of-turn writes;
  gating on identity rather than turn is what lets them Just Work. Within those rules a
  hostile client can still publish false facts for units it controls — including `effects`
  payloads that touch other units — and can emit spurious prompts; that is the accepted
  trusted-table trade-off (§9), and the overseer corrects via `override`/`edit`.
- **Fan-out:** realtime `postgres_changes` inserts on `forge_events` filtered by
  `session_id` — same pattern as `feed-bridge.js` / `combatants-backend.js`.
- **Overseer-as-unit needs no special casing.** The overseer clause lets the overseer write
  for any unit; `actor` records that it was them. Timed-out prompts, rolling for the absent,
  force-advancing a turn, GOD MODE — all the same mechanism.
- Ordering within a session: `(session_id, id)`. A conflict resolves by replaying the log.
  **The log wins, always** (rev 2 §8).
- Schema ships as one append-only migration file per repo SQL rules.

## §2 · Event vocabulary — 17 kinds

Every event is a sentence said at the table. State (HP, positions, whose turn, resources,
round) is never stored — it is derived by replaying the log top to bottom.

| kind | said at the table | payload sketch | writer |
|---|---|---|---|
| `session_started` | "We're fighting — map and roster locked." | `{}` (map/roster live on the session row) | overseer |
| `initiative_rolled` | "I rolled a 14." | `{roll}` | each player (own device); overseer for foes/absent |
| `initiative_set` | "Order is: Caim, goblin 2, Cosmere…" | `{order:[unit,...]}` | overseer |
| `turn_ended` | "Done." | `{}` | active player; overseer may force (actor shows who) |
| `move_declared` | "I move along this path." | `{path}` | mover |
| `move_resolved` | "…and arrive." (or stop short) | `{final_cell, interrupted_at?}` | mover |
| `attack_declared` | "I attack goblin 2 — rolled 17." | `{target, roll, adv?, mode}` | attacker |
| `attack_resolved` | "…hits, 9 damage." | `{hit, dmg, effects?}` | attacker |
| `ability_used` | "I cast Healing Word on Caim." | `{ability, targets, roll?, dmg?, effects?}` | actor's controller |
| `prompt` | "Cosmere — that would hit you. Shield?" | `{to, react, context, timeout:20}` | the mid-pipeline device (attacker/mover) |
| `prompt_answered` | "Yes, Shield." / "No." | `{prompt_seq, use:bool, roll?}` | prompted unit's controller; overseer after timeout |
| `reaction_declared` | reactions with no question pending (rare) | `{react, trigger_seq}` | reactor's controller |
| `chat` | anything said between actions | `{text}` | anyone, any time (not turn-gated by design) |
| `override` | "DM says that actually missed." | `{corrects_seq, correction}` | overseer only |
| `restore` | "Rewind to the top of round 2." | `{to_seq, snapshot}` (full board state inline) | overseer only |
| `edit` | GOD MODE: the divine hand | `{changes:[{unit, pos?, hp?, conditions?, typed_roll?, typed_dmg?}]}` | overseer only |
| `session_ended` | "Fight's over." | `{}` | overseer |

- **`unit` on a `prompt` is the asking (acting) unit** — the prompted unit is
  `payload.to`. If `unit` were the prompted unit, the §1 identity gate would reject the
  insert (the asker doesn't control the defender). Same trap as `turn_started`, dodged
  the same way.
- **There is deliberately no `turn_started` event.** Turn start is derived: `initiative_set`
  order + count/position of `turn_ended` events (round increments on wrap). An explicit
  event would need a writer who doesn't control the incoming unit, which the identity gate
  forbids — the derivation avoids both the race and the RLS hole. (Design-review catch.)
- **Declared → resolved, always** — for attacks AND movement, whether or not a reaction
  fires. One replay path; a refresh mid-action lands in a well-defined "declared, awaiting
  resolution" state.
- The log doubles as a **combat journal**: the Chronicle can render a fight recap from it —
  attacks, banter, divine interventions, in order. It literally is the story of the fight.

## §3 · Turn flow

- **Initiative:** fight start → each player's device shows their roll button; taps publish
  `initiative_rolled`. Overseer rolls foes, and rolls for anyone absent (fallback pattern,
  same as prompt timeout). When all in, overseer publishes `initiative_set`; round 1 begins.
- **Active unit:** highlighted on every board; only its controller's device shows action
  buttons (client turn gating). The overseer view always has controls.
- **End/force:** active player taps End Turn → `turn_ended`. Overseer can force-advance;
  the `actor` stamp records it.
- **On deck (client-side, no protocol impact):** the next unit's player gets a "you're on
  deck — start planning" banner; subtle portrait glow table-wide. Pure derivation from
  `initiative_set` + `turn_ended` count.
- **Planned turns (client-side, no protocol impact):** while others act, a player may stage
  a path + target on their own device. Nothing touches the log. At their turn: *"You have a
  plan queued: dash to the ledge, shoot goblin 2. Run it?"* — **Yes** re-validates against
  the current board and executes (publishing ordinary `move_declared`/`attack_declared`…);
  **No** is a normal turn. If the board shifted and the plan is illegal, the prompt says why
  and it becomes a normal turn with the plan shown as an adjustable ghost. **Never
  auto-fires.** (Settled: staged-not-fired; misfire cleanup via rewind is not a substitute.)

## §4 · Reaction pipeline (the schedule risk — rev 2 §8)

Walkthrough — goblin attacks Cosmere, who has Shield:

1. Overseer device publishes `attack_declared {target:"cosmere", roll:19}`.
2. Every client replays it; the shared engine asks: does anyone get a say? The **attacker's
   device** (mid-pipeline, waiting anyway) publishes `prompt {to:"cosmere", react:"shield",
   timeout:20}`. **Exactly one asker per prompt** — no duplicates.
3. Cosmere's tablet shows the modal (big YES/NO, visible countdown); everyone else sees
   *"waiting on Cosmere…"* — the fight visibly holds.
4. Her answer publishes `prompt_answered`; the attacker's pipeline resumes →
   `attack_resolved {hit:false}` (Shield deflect plays everywhere).
5. **Timeout → the same prompt re-targets to the overseer's screen**, who answers as the
   unit. Response event identical in shape; `actor` shows it was the overseer. (Settled
   first, 2026-07-10.)

Details:

- **Chained reactions** (Silvery Barbs → Shield → Hellish Rebuke) resolve one prompt/answer
  pair at a time, in the priority order the topo mock's pipeline already implements. The
  logic ports as-is; only the asking goes over the wire.
- Within a single declared action, each `(unit, reaction)` pair is asked at most once — the
  pipeline enforces it, so a decline can never loop.
- **A refresh can't lose a prompt.** Replay of a log ending in an unanswered prompt
  reconstructs "waiting on X" — the returning device comes back showing the prompt, timer
  adjusted from the prompt's `created_at`.
- **Opportunity attacks — table rulings (M, 2026-07-10):**
  - The reactor is always **asked, never auto-fired** — declining to bait out an OA (to
    protect a friend's spell from Counterspell, etc.) is a legitimate tactic.
  - **An OA never stops movement.** Damage lands at the square where it triggered; the
    mover keeps walking. The move truncates only when the rules themselves stop it: a
    Sentinel-style speed-to-0 effect, or damage dropping the mover to 0 HP. That is what
    `move_resolved.interrupted_at` is for; the default resolution is the full path.
  - **Pre-move warning, mover's side:** before publishing, the mover's device runs the same
    engine check that would generate the prompt and warns: *"Leaving goblin 2's reach — this
    provokes (it still has its reaction). Move anyway?"* Client-side, free.

## §5 · Rewind, retcon, GOD MODE

The multiverse problem (missed concentration check, three turns later): there is **no
technical solution** — the log stores results, not intentions; rolls are facts and players
are humans, so intervening turns cannot be auto-replayed into a changed past. The design
gives the overseer the two tools real tables use, and never pretends otherwise:

- **Rewind (`restore`) = hard branch.** Back to a chosen point; everything after is
  abandoned — **but stays in the log, visible greyed-out as "the previous take."** The
  table replays the branch by hand, consulting the old take (reuse rolls if the DM rules
  so, reroll where the world changed). No auto fast-forward, ever. `restore` carries the
  full board snapshot inline, so a full-log replay applies the branch and then the `restore` erases its effects —
  same final state, one replay path. Display layers grey the branch out; ▶ watch mode
  skips past it.
- **Retcon (`override`) = patch in place.** Inject the missed fact, correct a specific past
  event (`corrects_seq`); the timeline continues. Replay uses the correction. An `override`
  cannot reach behind the latest `restore` — the snapshot already baked the uncorrected
  past; use `edit` to adjust instead.
- **GOD MODE (`edit`) = the divine hand.** Move any unit, set HP/conditions, **type in
  rolls and damage**. Overseer-only via the §1 privileged-kind guard (enforced in RLS and
  the bus twin). This is how the board gets reset after a branch (drag the minis back,
  enter the rolls that stand), and it opens rev 2's deferred physical-dice door early: the
  typed-result payload shape is the one that would later move into the player HUD.
- **Rule of thumb:** small consequences → retcon in place; fight-altering → rewind the
  branch. Which one is a DM ruling, made at the table, not by the software.
- After any of the three, every device keeps replaying the log and lands in the same
  corrected reality. No special sync case.

## §6 · Catch-up: joins, refreshes, drops

- **One rebuild path:** any connecting device fetches the session's events and replays from
  the start. A fight is hundreds of events — milliseconds. **No snapshot machinery in v1**;
  if fights ever rebuild slowly, periodic snapshots can be added later without changing the
  log format. (`restore` snapshots are inline and unaffected.)
- **The player chooses how to arrive:** ⏩ **Jump to now** (replay applies instantly) or
  ▶ **Watch what I missed** (the same replay throttled through the feel layer — moves
  tween, rolls flash, chat scrolls). **Speed control on watch: 1× / 2×**, and ⏩ skips to
  now at any point mid-watch.
- If the fight was waiting on the dropped device (a prompt, their turn), replay
  reconstructs exactly that — the screen comes back showing the prompt or turn HUD. Worst
  case the timeout already fell to the overseer and the log shows the unit was answered-for.

## §7 · Test plan

Honors the repo rule: real functions on the real field; a headless pass is not proof of a
working browser.

- **Swappable transport:** the pipeline talks to a bus interface — Supabase in production,
  an in-memory fake in tests. The full cross-device dance (declare → prompt → answer →
  resolve; timeout → overseer) runs headless in Node **before any network exists**.
- **`forge/tests/smoke-protocol.js`** (known-answer): scripted fight logs → exact expected
  final state. Cases: plain turn; attack + Shield; attack + timed-out prompt; OA mid-move
  (full path, Sentinel stop, 0-HP stop); chained reactions in priority order; override;
  edit; restore mid-log.
- **Replay determinism smokes:** same log twice → identical state. Branch log → corrected
  state, dead branch skipped. Log ending on an unanswered prompt → state says "waiting on
  X" (proves refresh recovery).
- **Then the real thing:** two browser windows on real Supabase (overseer + one player),
  driven by `forge/protocol-harness-mock.html`'s manual 7-step checklist (assign controller
  → start/initiative → move → attack + Shield prompt → timeout fallback → RLS rejection →
  refresh catch-up, cross-checked via `window.__forgeState()` JSON dumps) — to catch the
  browser-integration class of bug the smokes cannot see. A scripted Playwright replay of
  that same checklist is future QA (rev 2 step 7), not yet built.
- The rules engine keeps its existing smokes (83 green + placement/flora/los suites). The
  protocol never re-tests rules; it only ferries their results.

## §8 · Decisions record (this spec, 2026-07-10)

| Question | Decision |
|---|---|
| Prompt timeout | Falls to overseer, who answers **as the unit**; same event shape, `actor` stamps who answered |
| Action shape | **Declared → resolved, always** — attacks and movement both |
| Turn gating | **DB gates identity** (live session + you control the unit; overseer exempt); **client gates turn**; overseer overrides mistakes; privileged kinds (session lifecycle, initiative_set, override, restore, edit) are overseer-only at the DB |
| Catch-up | **Replay the whole log**, no snapshot table in v1; ⏩ jump / ▶ watch at 1×/2× |
| Rewind semantics | Hard branch, abandoned take stays visible; no auto fast-forward — replaying is the table's job |
| Retcon | `override` patches the past in place; small→retcon, fight-altering→branch (DM ruling) |
| GOD MODE | `edit`: overseer moves units, sets HP/conditions, types rolls/damage; opens the physical-dice door |
| OA | Always asked, never auto-fired; never stops movement except Sentinel-style or 0 HP; pre-move provoke warning |
| Planned turns | Client-local staging; yes/no prompt at turn start; re-validated; **never auto-fires** |
| Chat | `chat` event in the same log — live feed + lands in the fight transcript for Chronicle recaps |
| `turn_started` | **Does not exist** — derived from `initiative_set` + `turn_ended` (avoids an RLS hole and a race) |

## §9 · Explicitly out of scope (unchanged from rev 2 §7)

Per-player fog of war · player-side physical-dice entry (door opened via `edit`, HUD later)
· AoE templates · foes readying · reach weapons · intent-level validation · spectator mode.
