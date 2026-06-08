# Trials of Kirtas — Combat Page Context

_Last updated: end of the session that bridged **conditions** (3c), built
**monsters into encounters** (drop / delete / reveal + statblock panel + token
art), added a staff **player-view** preview, and shipped the **initiative & turn
tracker** (Phase C1). Next: rollable statblock / monster HUD (C2)._

## Snapshot

`combat.html` is now a working VTT: token grid, fog, drawings, live cursors, the
battle **HUD** sharing live **HP + conditions** with the map, a DM **Bestiary**
picker that drops 5etools monsters as enemy combatants, per-token **statblock**
panels, a **view-as-player** preview for staff, and a top **initiative strip**
(flag-card chips) driving shared turn order. Canonical = GitHub `main`;
clone/pull before editing; M commits/uploads; never curl the live site.

## Completed (this arc, since the HP bridge)

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

1. **Initiative tracker only in combat / hide toggle.** The strip should appear
   only when a fight is on (and/or a manual show/hide toggle, useful regardless).
   Needs a notion of "in combat" — candidate: `encounters.status` or a dedicated
   flag / the presence of any seated initiative + an explicit start/end.
2. **Token disposition + menu reorder.** (a) Choose hostile / neutral / friendly
   per token (right-click toggle) — drives ring colour / strip side / target
   logic. (b) **Reorder the context menu: Manage becomes the default/first tab,
   Conditions secondary** (statblocks > conditions in usage). Trivial swap.
3. **Rollable statblock / DM monster HUD (C2).** Make `{@hit}`/`{@damage}`/`{@dc}`
   in the statblock clickable to roll (result local, then a shared roll log).
   **These converge with a per-monster HUD:** clicking an enemy populates a HUD
   like the character battle HUD but driven by the snapshot statblock (monsters
   function like characters — AC/HP/attacks/saves). Lean: reuse `battle.js`'s HUD
   seam with a statblock-backed source rather than a separate widget; rollable
   attacks live in that HUD. Decision to lock: shared HUD vs DM-local; how much of
   the character HUD (slots/economy) applies to monsters.
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
