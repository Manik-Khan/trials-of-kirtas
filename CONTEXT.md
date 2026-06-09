# Trials of Kirtas — Combat Page Context

_Last updated: end of the session that **fixed the turn/round bug** (built the
turn/round bridge through the backend seam — see Completed; tested-working,
PENDING M's commit) and **designed Start/End combat + the DM roster picker**
(roadmap #1, model locked except the participant-flag decision M reopened).
Also written but NOT yet run/committed: `schema_delta_disposition.sql` (#2).
Next session, in order: (a) settle #1's participant **flag** (M's call — a
`combatants.in_combat` boolean, not the `-999` sentinel C wrongly drifted to);
(b) run disposition delta + ship its commit; (c) build Start/End combat + picker;
(d) the out-of-turn confirm modal (commit 2). Pending live: turn/round bridge
files (`battle.js`, `combat.html`) and the disposition delta both await M._

## Snapshot

`combat.html` is now a working VTT: token grid, fog, drawings, live cursors, the
battle **HUD** sharing live **HP + conditions** with the map, a DM **Bestiary**
picker that drops 5etools monsters as enemy combatants, per-token **statblock**
panels, a **view-as-player** preview for staff, and a top **initiative strip**
(flag-card chips) driving shared turn order. Canonical = GitHub `main`;
clone/pull before editing; M commits/uploads; never curl the live site.

## Completed (this arc, since the HP bridge)

**Turn/round bridge. [BUILT + node-checked + tested-working by M; PENDING M's
commit — not yet on `main`].** Fixes the crossed turn/round wiring: the HUD's
End Turn used to fake a local marquee round (`_doEndTurn` poked the DOM) and the
strip's `advanceTurn` (correct: ++round only on wrap) never reached the HUD —
two disconnected round counters. Now bridged through the existing backend seam,
same pattern as HP/conditions:
- `battle.js`: `_doEndTurn` calls `backend.advanceTurn?.()` instead of touching
  the marquee (sheet.html keeps the old local behaviour via the fallback path —
  byte-identical). New `window.__battle.setTurn({round, activeKey})` drives the
  marquee from the shared `encounters.round` and resets a character's action
  economy when it *becomes* active (turn start, not End Turn). New module-level
  `let TURN = {round, activeKey}`. `endTurn` gate: if a shared tracker is present
  and it isn't this character's turn, block with a toast (no hijacking the order).
- `combat.html`: `advanceTurn()` added to the HUD backend (calls page-level
  `advanceTurn()`); `activeSourceKey()` + `pushTurnToHud()` helpers forward
  round + whose-turn to the HUD from setActive / rollAll / the encounters
  realtime handler / initial load. No schema change.
- **Locked decisions:** economy resets at turn *start*; only the active char's
  End Turn advances (staff always via Next).
- **Follow-on (commit 2, NOT built):** the friendly out-of-turn confirm modal
  ("It's not your turn — end it anyway?") + the same soft prompt on out-of-turn
  *actions*. Reuses the existing `showEndTurnModal`/`confirmEndTurn` scaffolding.

**3c — conditions bridged.** The HUD's `toggleCond` now persists through a
dedicated `backend.saveConditions(key, arr)` (combat backend writes the
`combatants.conditions` jsonb by row id); `battle.js` seeds + applies conditions
through the existing `combat` payload (load + `applyCombatChange`), and the live
realtime feed forwards `{ hp, conditions }`. Vocabulary was already matched
(8 strings, identical order) — board context-menu and HUD edit the same array.
sheetBackend has no `saveConditions`, so `sheet.html` is byte-identical.

**#3 Phase A — drop a monster.** DM-only **Bestiary** drawer (right slide-out,
reuses compendium's 5etools CDN load + CR parse) searches the bestiary and drops
a monster as a `hidden` enemy combatant at board centre. New columns `ac` +
`statblock` (jsonb **snapshot** of the 5etools entry — self-contained, survives
homebrew). Realtime extended with **INSERT/DELETE** handlers on the existing
channel so new/removed tokens sync live (combatants + encounters confirmed in the
`supabase_realtime` publication). Staff context-menu **Manage** tab gained
**Reveal/Hide** (flips `hidden`) and **Remove** (two-tap). RLS already let staff
insert/delete; no policy change needed.

**#3 Phase B — statblock + art.** Per-token **statblock panel** (right drawer,
opened from Manage → 📖 Stat block) renders `renderMonster` lifted from
compendium (AC/HP/speed/saves/skills/immunities/senses/abilities/traits/actions/
legendary), fed from `c.statblock`. **Monster token art** layered over the
initial-disc fallback via `monsterTokenUrl(c)` (5e.tools token webp; onerror →
initial). Fixed the 5etools markup expander: `{@atk}`/`{@h}` now expand
("Melee Weapon Attack: …"), and the AC `from` clause is run through the cleaner
("15 (leather armor, shield)").

**Player view.** Staff-only **eye toggle** (bottom-left) flips a client-side
`VIEW_AS_PLAYER`. `effectiveStaff() = IS_STAFF && !VIEW_AS_PLAYER` gates all
*visibility* (tokenVisible + hidden-enemy filter, fog veil opacity, token badges,
cursors, Manage tab, DM panels via a `.view-as-player` stage class); real
`IS_STAFF` still gates identity/permission. Visual-only curtain (staff still hold
the data). Entering preview cancels fog painting and closes DM surfaces.

**C1 — initiative & turn tracker.** Top-centre **initiative strip** of
flag-card chips (lifts `npcs.html`'s `portrait-zone` + per-card `burnt-${seed}`
grain filter; portrait zone fills with party art / 5e.tools monster token /
gradient+initial). Active chip enlarges with the gold frame; HP sliver + init
badge. **Rolling:** token context-menu **⚔ Roll initiative** (`1d20 + DEX` —
party from `CHARACTERS[key].combat.initiative`, enemy from `statblock.dex`); DM
**Roll all**; tap-to-edit any init badge (staff anyone, players own/party). **Turn
pointer:** uses the pre-existing `encounters.active_combatant_id` + `round`; DM
**Next ▸** advances + wraps round; syncs via the encounters realtime channel.
Visibility carries from player-view: hidden foes only in the staff strip, and a
`???` chip shows players when a hidden combatant is active. Strip is empty for
players until something's seated.

## Locked data contract / architecture

- **`combatants`** now carries: hp, max_hp, conditions (jsonb), x, y, hidden,
  initiative, side, source_key, size, **ac**, **statblock** (jsonb snapshot).
  Shared live across clients: hp + conditions + x/y + hidden + initiative.
- **Turn state** lives on `encounters` (`active_combatant_id`, `round`) — shared,
  realtime. **No formal encounter "start/end"** yet (see to-dos #1).
- **Statblock = snapshot**, not reference (homebrew-safe; no live fetch to
  render). `ac`/`max_hp`/`size` denormalised so board/HUD never parse jsonb.
- **Column-guard trigger** now lets players change hp/conditions/x/y/**initiative**
  on party rows; owner/side/hidden/max_hp/name/encounter_id stay pinned. Enemies
  stay staff-only (RLS).
- **Backend seam unchanged:** `battle.js` is backend-agnostic; combat backend
  supplies load/save/saveConditions/subscribe. One realtime channel per table
  (never a second `postgres_changes` on `combatants`).

## Files in play

- `combat.html` — bestiary picker, statblock panel + renderer, monster art,
  player-view, initiative strip + rolling + turn pointer, INSERT/DELETE realtime,
  context-menu Reveal/Hide/Remove/Roll-initiative.
- `battle.js` — conditions through the seam (`saveConditions`, seed/apply). HP +
  conditions bridged; otherwise unchanged.
- `schema_v1.sql` — reconciled canonical: combatants has source_key/size/ac/
  statblock; guard trigger allows player `initiative`.
- Deltas (run in Supabase, **not all committed historically** — repo schema kept
  lagging; now reconciled into v1): `schema_delta_shared_hud.sql`,
  `schema_delta_enemies.sql` (ac + statblock), `schema_delta_initiative.sql`
  (guard trigger only — `active_combatant_id` already existed).

## Working rules (carry forward)

`git clone`/pull `main` as canonical before editing; **discuss & get approval
before writing code; lock design before implementing**; for UI changes, mock it
up for approval first (the visualizer is good for this). Small incremental
changes; never touch unrelated code; flag uncertainty; never curl the live site.
Use `var(--font-*)`; card internals hardcoded dark, page-level backgrounds use
theme vars. Verify with `node --check` (for `.html`, extract the inline
`<script>` and check that); recompute line ranges after each edit. **Confirm the
file actually landed** ("nothing to commit" = the new content never reached the
file). M commits/deploys manually; Claude never pushes.

## Open follow-ups / known issues

- **Monster token-art URL unverified.** Chips + tokens derive
  `5e.tools/img/bestiary/tokens/{source}/{name}.webp` with onerror → initial
  fallback. If art doesn't appear, the host hotlink-blocks or the path differs —
  switch to a github img mirror / correct pattern. Statblock panel is unaffected.
- **Strip top position** may need a `top:` nudge vs the combat header.
- **Encounter start/end** is informal — relevant to to-do #1 and to deferred
  HP-reconcile-to-sheet.

## Next up / roadmap

1. **Start/End combat + roster picker (encounter lifecycle + participants). [DESIGNED + mocked; model locked EXCEPT the one open decision below]**
   Root insight: "battle mode" (a *local* HUD toggle, localStorage, never shared)
   and "combat" (shared truth on `encounters`/`combatants`) are different things
   that currently masquerade as one — that's why a player toggling battle mode
   produces no agreement and no shared "combat started" signal. Fix: make
   **Start/End combat a distinct, DM-authoritative, shared** action; battle mode
   stays a personal HUD view.
   - **Lifecycle:** use existing `encounters.status` (`active`/`ended`) — NO
     schema change for this part. End combat → `ended` (row *kept*, not wiped);
     page drops to a quiet intermission; Start (new) combat inserts/seats a fresh
     `active` encounter (reuse last `map_ref` for now; real map picker = #6).
     Strip live for players only while `active`. Ended rows preserved on purpose
     (scoped queries, per-encounter realtime, one-active index only touches
     `active`) → feed HP-reconcile-to-sheet + saved enemy library + free history.
     No auto-delete; optional manual prune only if needed.
   - **Roster picker (DM-only):** Start opens a checklist of the tokens on the
     board, each with a disposition-coloured disc + include checkbox, defaulted
     from disposition/side (party + hostiles checked, neutral bystanders
     unchecked). Bystanders stay on the map but out of the order. Tap to override.
   - **Two roll modes (both, locked):** *Roll for everyone* auto-rolls all
     participants incl. PCs (fast, no prompts). *Players roll their own* auto-rolls
     **only** enemies/NPCs; each participating PC gets a single "Roll for
     initiative" prompt with NO pre-seeded value (one roll, no cherry-picking).
     [The earlier "auto-roll + re-roll" idea was rejected by M — it let a player
     see the auto value AND re-roll = two bites = a boon. Don't reintroduce it.]
   - **Add/remove mid-fight:** token menu "⚔ Roll initiative" = add; add "Remove
     from combat" = clear initiative.
   - **QoL:** on Start, auto-open the HUD for *participating* players only.
   - **>> OPEN DECISION (revisit first next session):** how to represent a chosen
     PC who hasn't rolled yet in *players-roll-their-own* mode. **M wants a
     dedicated participant flag** (e.g. `combatants.in_combat boolean`): then
     `in_combat = true, initiative = null` = "in the fight, hasn't rolled" =
     clean pending state, and `initOrder` keys off the flag, not a null check.
     (C had earlier steered to "participant = has an initiative, no flag" and then
     to a `-999` sentinel hack to fake pending — that was the wrong call; the flag
     M wanted removes the contortion. Reopen and spec the flag properly: schema
     delta + guard pin + `initOrder` using the flag + the pending chip render.)
2. **Token disposition + menu reorder. [LOCKED; `schema_delta_disposition.sql` + `schema_v1.sql` reconciled — delta NOT yet run, combat.html code NOT yet written]**
   (a) New `combatants.disposition` column (`friendly`/`neutral`/`hostile`,
   default `hostile`) — a NEW axis *orthogonal* to `side`. Disposition drives
   ring + initiative-strip border colour (and later C2 target logic); `side`
   stays the permission/control axis. Real PCs keep their `CHAR_COLOR` ring;
   staff-run tokens take the disposition colour (friendly green, neutral gold,
   hostile red — approved). Guard trigger pins `disposition` from players (staff
   call). **Hand-off feature (wanted):** a Manage-tab "Give to players / Reclaim"
   that flips `side` party↔enemy — RLS + the guard then let players move/HP the
   token while its disposition (colour) is unchanged. (b) **Menu reorder: Manage
   becomes the default/first tab, Conditions secondary** (players still only ever
   see Conditions, since Manage is `effectiveStaff()`-gated). Tab registry order =
   display order; trivial swap.
   *Build note:* run the disposition delta first — the roster picker's friend/foe
   defaults read from `disposition` (fall back to `side` until it exists).
3. **Rollable statblock / DM monster HUD (C2).** Make `{@hit}`/`{@damage}`/`{@dc}`
   in the statblock clickable to roll (result local, then a shared roll log).
   **These converge with a per-monster HUD:** clicking an enemy populates a HUD
   like the character battle HUD but driven by the snapshot statblock (monsters
   function like characters — AC/HP/attacks/saves). Lean: reuse `battle.js`'s HUD
   seam with a statblock-backed source rather than a separate widget; rollable
   attacks live in that HUD. Decision to lock: shared HUD vs DM-local; how much of
   the character HUD (slots/economy) applies to monsters.
   **[DECISION LOCKED] Persist the shared roll log** — when we build C2's roll
   log, write it to a `combat_events` (a.k.a. `roll_log`) table from the first
   line, NOT an ephemeral broadcast: one row per event (`encounter_id`, actor,
   `round`, `type` ∈ roll/damage/heal/condition/death/turn/note, jsonb payload).
   Realtime during the fight (the shared feed everyone watches), the archive
   after. This is the *single decision* that makes battle history free — because
   ended encounters are now preserved (#1), persisting the log turns "what
   happened in this battle" into existing data, not a new feature. Hidden-enemy
   events need the same player-view veil the tokens have (players read "the ogre
   strikes", not its to-hit math, until revealed).
3b. **Battle history ↔ chronicle bridge. [planned, separate build]** Link an
   encounter to a session (`encounters.session_id`, essentially) and give the
   chronicle a way to list a session's battles and open one to replay its
   `combat_events` log. Likely two layers: a short readable battle synopsis as the
   chronicle entry, with the raw roll log as drill-down. Possible flourish (the
   chronicle is already rich-text): a "summarize this battle into a chronicle
   entry" action that turns the raw log into prose. Exact join depends on how
   sessions are keyed in `chronicle.html` — read that model when scoping the
   bridge; don't guess now.
4. **max_hp reconciliation** — HUD clamps to `CHARACTERS[key].combat.hpMax`;
   `combatants.max_hp` is row truth. Minor.
5. **Saved enemy library (#3 Phase C).** Reusable / homebrew monster snapshots to
   drop without searching 5etools each time.
6. **Battle map / scene storage.** Map picker + per-encounter scene selection.
7. **Parked tools.** Walls/barriers (edge collision, own table); trap/trigger
   tiles (hidden, banner + zoom on fire, arm/disarm, one-shot/repeatable).
8. **Cinematic combat (parked).** VTT-with-juice: sprite animations / floating
   damage numbers hung off the realtime HP/condition events the bridge emits.
9. **Deferred.** Resources/slots persistence; reconcile HP to sheet at encounter
   end; full sheet→Supabase migration (the strongest driver: combat consuming
   inventory like arrows/potions).

## Character note

The character once named **Tyros Darkstar** is now **Cosmere Runestar** — same
character. Data key `tyros` persists in the sheet files/URLs; the combat/token
layer uses the key **`cosmere`** everywhere (CHARACTERS, PORTRAITS, CHAR_COLOR,
combatant `source_key`), so HUD binding by `source_key` matches `ME.characterKey`.
