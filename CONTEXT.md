# Trials of Kirtas — Combat Page Context

_Last updated: end of the session that added combat to the nav and built the
HUD↔combat **HP bridge** (steps 1–3) end-to-end — the HUD now shares live HP with
the map's tokens. Conditions are NOT bridged yet (next: 3c)._

## Snapshot

`combat` is now in the site nav, and the battle HUD (`battle.js`) now runs on
`combat.html` sharing live state with the map. **HP is fully bridged:** it reads
on open, writes on adjust, persists across refresh, syncs live across sessions,
and works for any party character via the HUD's built-in switcher. Conditions are
the next piece. Canonical = GitHub `main`; clone/pull before editing; M
commits/uploads; never curl the live site to diagnose.

## Completed this session

**#1 — combat added to the nav.** One entry in `nav.js` `PAGES`
(`{ label: 'Combat', path: 'combat.html' }`). Nav has no role-gating mechanism and
every role needs combat, so it's ungated; `combat.html` was already fully wired
(nav-root, theme.css, nav.js, waits on `window.__tok.sb`) — it was just missing
from `PAGES`.

**#2 — HUD↔combat bridge, HP loop complete.** Built in increments:

- **Seam (`battle.js`).** Persistence is now pluggable. `sheetBackend` holds the
  prior behavior verbatim (CharacterStore-or-fetch to
  `/.netlify/functions/character`, character-keyed, debounced, SHA-managed) and is
  the default, so `sheet.html` and every other page are byte-identical in
  behavior. `window.__battle.useBackend(b)` swaps the backend. The realtime
  subscription was refactored into `applyCombatChange` + `bindRealtime()` so a
  backend swap re-subscribes; `useBackend` re-binds realtime **and** re-pulls the
  active character if the HUD is open (covers the resume flow). `battle.js` is now
  backend-agnostic and makes zero Supabase calls itself.
- **Combat backend (`combat.html`).** Loads `characters.js` + `battle.js`, then
  hands the HUD a Supabase combatants backend. The HUD attaches for **everyone**
  (no `characterKey` gate — staff included), defaults to the viewer's own
  character if they have one, and binds to the **selected** character via
  `source_key` (the HUD switcher is the live control). `load` reads HP from the
  in-memory `COMBS` array; `save` writes by row **`id`** (robust — not a fragile
  multi-column match); live-in **piggybacks combat.html's existing
  `combat-`+ENC.id channel** via a stashed `HUD_ONCHANGE` callback invoked from
  the combatant-UPDATE handler.
- **Shared-HUD RLS.** `combatants_player_update` loosened from
  `owner = my_profile_id()` to `side = 'party'`, so any authenticated user can
  drive any party character. The `combatants_guard_columns` trigger still pins
  owner/side/structural fields, so players can still only change hp/conditions/x/y;
  enemies stay staff-only (not `side='party'`). `owner` is no longer load-bearing.
  Delta: `schema_delta_shared_hud.sql` (run in Supabase); `schema_v1.sql` updated
  to match.

Verified live end-to-end: HP reads on open, writes on +/- (update returns the row,
no error), persists across hard refresh, syncs to other sessions without a
refresh, and works switching across vesperian / liadan / caim.

## Locked data contract (the forks)

- **Shared:** only `hp` and `conditions` (both already columns on `combatants`).
  Resources, spell slots, turn economy, concentration stay HUD-local in-memory.
- **Binding:** by `source_key` (character key: cosmere/caim/liadan/vesperian). The
  character HUD is for **party characters only**; enemies use the on-board context
  menu for hp/conditions (any token).
- **HP truth:** the combatants row is the live truth during combat;
  `CHARACTERS[key].combat.hpMax` is the seed/clamp. Durable across weeks because
  every edit hits the Supabase row immediately (an unfinished fight just stays an
  active encounter). Reconcile-to-sheet-at-encounter-end is deferred (no formal
  encounter "end" yet).

## Architecture / patterns

- **Two stores, bridged client-side.** The character *sheet* lives in a GitHub
  JSON file behind `/.netlify/functions/character` (character-keyed, slow,
  SHA-gated, not realtime; stores hp but NOT conditions). The *combatant row*
  lives in Supabase (per-encounter, realtime, RLS; hp + conditions + x/y). They
  can't see each other — the browser is the only connector. The bridge links them
  at chosen moments (seed on create, optional reconcile at end), never via
  continuous dual-write (two backends of different speed desync).
- **Backend seam.** `battle.js` talks to one `backend` ({ load, save, subscribe });
  each page supplies its own. Swapping must re-bind realtime + re-pull (done in
  `useBackend`).
- **Realtime: one channel per table.** Reuse combat.html's existing
  `combat-`+ENC.id channel and feed the HUD from its UPDATE handler. Do NOT open a
  second `postgres_changes` channel on the same table — it proved unreliable (live
  updates silently didn't arrive).
- **Long-term.** Unifying the sheet into Supabase (single source of truth,
  Foundry-style "linked actor") is the clean end state but a separate, larger
  project; this seam is its first stone. Combat consuming inventory items
  (arrows/potions) is the strongest driver for that migration — defer until then.

## Files in play this session

- `nav.js` — combat added to `PAGES`.
- `battle.js` — pluggable backend seam (`sheetBackend` default, `useBackend`,
  `applyCombatChange`/`bindRealtime`). Now backend-agnostic.
- `combat.html` — loads characters.js + battle.js; combatants backend (load via
  `COMBS`, save by `id`, live-in via `HUD_ONCHANGE` in the existing channel); HUD
  attaches for all, binds by `source_key`.
- `schema_v1.sql` — canonical: player-update policy is now `side = 'party'`.
- `schema_delta_shared_hud.sql` — idempotent delta (already run in Supabase).

## Working rules (carry forward)

`git clone`/pull `main` as canonical before editing; discuss & get approval before
writing code; small incremental changes; never touch unrelated code; flag
uncertainty; never curl the live Netlify site to diagnose; use `var(--font-*)`,
not hardcoded fonts; card internals hardcoded dark (`#1a1a1a`), page-level
backgrounds use theme vars. Verify edits with `node --check` (for `.html`, extract
the inline `<script>`…`</script>` and check that); recompute script bounds after
edits since line ranges shift.

- **Confirm the file actually landed (NEW — cost us a whole stretch this session).**
  After committing, verify the file in the repo/deploy is the intended latest:
  search the committed file on github.com for a known marker string, and/or check
  a runtime marker in the browser console
  (`[...document.scripts].some(s => s.textContent.includes('<marker>'))`). Git
  reporting **"nothing to commit"** means the staged file is *identical* to HEAD —
  that is a red flag the new content never reached the file (a stale/duplicate
  download, e.g. Chrome's `combat (1).html` suffix trap, or a re-served stale
  copy), NOT a successful no-op. When sharing files back, point the share at the
  freshly edited working file, not a previously-exported copy.

## Next up / roadmap

1. **#2 conditions (3c) — the next piece.** Bring conditions across the seam.
   Needs: combatants backend load/save/subscribe for `conditions`; a small
   `battle.js` `toggleCond` persist (it currently saves nothing — conditions are
   in-memory only today, stored nowhere); and reconciling the HUD's condition
   vocabulary with combat.html's **eight on-board condition badges** + the existing
   context-menu conditions writer (~line 1189) so both edit the same
   `combatants.conditions` array consistently.
2. **max_hp reconciliation** — the HUD clamps HP to `CHARACTERS[key].combat.hpMax`;
   `combatants.max_hp` is the row truth. Minor, deferred.
3. **#3 monsters into an encounter.** Saved **enemy library** and/or **5etools
   JSON search** to drop a monster in; plus a **DM-only enemy/monster slide panel**
   (stat block: AC / attacks / saves / abilities, fed by 5etools — same source as
   items/compendium). Open fork: store a *reference* to the 5etools entry (lean,
   looked up live) vs a *snapshot* statblock jsonb on the row (survives homebrew
   edits).
4. **Battle map / scene storage.** Map picker + per-encounter scene selection.
5. **Parked tools.** Wall / barrier tool (edge-based client-side collision,
   open/closed state, own table); trap / trigger tiles (region types tile/area/
   row/column; hidden from players; on trigger → banner + zoom-to-coordinate;
   per-trigger staff toggle ON = visible + auto-fire / OFF = staff-only marker;
   arm/disarm + one-shot vs repeatable).
6. **Cinematic combat idea (parked).** Suikoden/Fire Emblem-style presentation.
   Decision: **VTT-with-juice** (sprite animations / floating damage numbers hung
   off the realtime HP/condition events the bridge already emits) is feasible and
   additive — the discrete "HP changed" event is the trigger, no Phaser/React
   needed. A full **SRPG engine** (software adjudicates combat) is a different
   project and crosses the VTT→game line. Artwork is the bottleneck. The bridge
   underlies every version, so no bridge work is wasted.
7. **Deferred.** Resources/slots persistence (new columns/table); reconcile HP to
   the sheet at encounter end; full sheet→Supabase migration.

## Character note

In this campaign the character once named **Tyros Darkstar** is now **Cosmere
Runestar** — same character, new name. Data key `tyros` is preserved in the sheet
files/URLs; display strings use "Cosmere." In the combat/token layer the
character key is **`cosmere`** (CHARACTERS, PORTRAITS, CHAR_COLOR, and combatant
`source_key` all use `cosmere`, not `tyros`), so HUD binding by `source_key`
matches `ME.characterKey` cleanly.
