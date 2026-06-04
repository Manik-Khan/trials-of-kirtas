# Trials of Kirtas — Combat Page Context

_Last updated: end of the session that built fog of war + the drawing tools._

## Snapshot

`combat.html` is the live battle-map page (vanilla JS/HTML/CSS, Supabase-backed,
Netlify-hosted). This session took it from "tokens + conditions" to a working
DM/player tabletop surface: per-token conditions and size, fog of war, and a
shared drawing layer (AoE templates), all real-time synced. The standalone
**battle HUD (`battle.js`) is a separate track** and is *not* yet wired into
`combat.html` (see "Next up").

Canonical source = the GitHub repo `main` branch. Always `git clone` / pull
before editing; never diagnose by curling the live Netlify site.

## Completed this session

**Context menu → tabbed, role-aware.** Long-press / right-click a token opens
`openCtxMenu`, now a small tab registry. Tabs: **Conditions** (everyone) and
**Manage** (staff only). Single visible tab renders as a plain sub-label; the
tab bar appears at 2+. Future tabs slot into the `tabs` array with a
`show: () => …` gate.

**Token size (Manage tab).** Staff-only per-creature size
(Tiny→Gargantuan), shared in the DB, realtime-synced. v1 = centered **visual
scale only** (no multi-cell footprint occupancy — that is deliberately deferred;
the open question is corner-vs-center anchoring for Large+). Needs
`schema_size.sql` run in Supabase (adds `combatants.size`, pins it staff-only in
the column guard).

**Mobile touch fixes.**
- iOS long-press "Save Image" callout suppressed on tokens (`-webkit-touch-callout`
  etc. were only on `.board-map`; now on `.token`/`.token img`).
- Ghost-drag after long-press fixed: opening the menu disarms the drag
  (`mode='menu'`, `dragId=null`).
- Stuck one-finger-pinch fixed: first finger of a fresh gesture clears stranded
  pointers (`e.isPrimary → pointers.clear()`), plus capture release +
  `lostpointercapture` cleanup.

**Fog of war.** Backend already existed (`encounters.revealed_cells` jsonb,
staff-write RLS, realtime). Client work: a mask-based SVG veil
(`fogSvg`/`redrawFog`), **feathered edges** (Gaussian blur), a round **brush with
adjustable radius** (`FOG.size`), reveal/hide, Reveal-all/Hide-all. Players see
solid cover; DM sees a translucent shroud. Tokens in fog are **auto-hidden from
players** (cheap client-side tier — `tokenVisible()`; your own token always
shows). Fresh encounters start fully fogged (`revealed_cells = []`).

**UI restructure.**
- **Display** moved to a right **slide-out drawer** (compendium pattern):
  `⚙ Display` tab opens it, backdrop / `✕` closes. No longer a static dropdown.
- **Left persistent tool rail** (`buildToolRail`): **Select / Circle / Cone**
  for everyone; **Pencil (reveal) / Eraser (hide)** appended for staff. Selecting
  a tool IS the on/off (no more "paint fog" checkbox). Each tool opens its options
  in a contextual **slide-out** (`.tool-options`) — fog brush options, or the
  draw colour picker.

**Drawings layer (shapes / spell templates).** New `drawings` table
(`schema_drawings.sql`). **Everyone can draw their own**; staff manage all —
enforced by RLS (`owner = my_profile_id()` / `is_staff()`), mirroring the
combatants ownership model. Tools: **Circle** (radius) and **Cone** (5e shape:
far-end width = length). Place by **tap-and-drag** (snapped to whole cells).
Full-spectrum **colour picker**, per-user, changeable anytime; each shape captures
the current colour + owner. **Remove** via the Select tool: a `✕` handle appears
on shapes you may delete (your own, or all if staff). Shapes render **below fog**
(hidden in the dark) and **below tokens**. Realtime via the `drawings` table.

## Architecture decisions locked

- **Personal vs shared:** anything with table-wide meaning is **shared** in the DB
  (token size, fog, drawings, position, HP, conditions). Purely cosmetic
  per-viewer prefs (e.g. token render style) are **personal** — to be stored as a
  small per-profile JSON blob keyed by character. Personal prefs are the *easy*
  kind of persistence (single-writer, no realtime). Token-style-as-personal is a
  **future** pass (mechanism renders locally already; just needs persisting).
- **Fog token concealment = cheap/cosmetic tier** (client skips rendering fogged
  tokens). A player could see positions in devtools; accepted for a trusted table.
  Secure tier (RLS-filtered by fog position + combatants refetch on fog change)
  is **deferred**.
- **Layer order:** map → grid → drawings → fog → tokens → measure (DOM order;
  draw/fog layers are `pointer-events: none`, painting handled on the stage).

## Data model touched

- `combatants.size` (text, default 'medium', staff-only via column guard) — see
  `schema_size.sql`.
- `encounters.revealed_cells` (jsonb `[[x,y],…]`) — pre-existing; now driven by fog.
- `drawings` table (id, encounter_id, owner, kind, geometry jsonb, color,
  created_at) — see `schema_drawings.sql`. RLS: read-all; owner-or-staff write.
  Added to the `supabase_realtime` publication.

## Files in play

- `combat.html` — all client work above. Commit it.
- `schema_size.sql` — run in Supabase (token size + guard pin).
- `schema_drawings.sql` — run in Supabase (drawings table + RLS + realtime).
  **Regenerated clean (ASCII, idempotent)** after a load/parse issue with the
  earlier copy; safe to re-run even after a partial attempt.

Nothing has been pushed — M commits/pushes.

## Working rules (carry forward)

`git clone`/pull `main` as canonical before editing; discuss & get approval
before writing code; small incremental changes; never touch unrelated code; flag
uncertainty; never curl the live Netlify site to diagnose; use `var(--font-*)`,
not hardcoded fonts; card internals hardcoded dark (`#1a1a1a`), page-level
backgrounds use theme vars. Verify edits with `node --check` on the inline script
+ brace/paren balance after large changes.

## Next up / open threads

1. **Verify the regenerated `schema_drawings.sql` runs.** If the page still won't
   load, capture the exact browser-console error (or Supabase SQL error) — that
   pinpoints it immediately.
2. **Playtest the drawing tools** in two browsers (DM + player): place circle/cone,
   colour, `✕`-delete, and confirm both placement and deletion sync. Watch one
   desktop edge: a mouse pan that releases on a `✕` could register as delete
   (touch is fine); add a movement guard if it bites.
3. **More shapes** on the same rail: rectangle, line (cheap additions).
4. **HUD ↔ combat bridge** (the big separate track): `battle.js` (single-character
   HUD — HP/conditions/actions/spells/resources) is NOT loaded on `combat.html`
   and shares no state with the map. Goal: the HUD's HP/conditions for a character
   = the same Supabase combatant row as the token. Decision leaning: bring the HUD
   onto the combat page sharing the map's state (M confirmed "contain as much as
   possible in the HUD; it's the bridge"). Folds in the parked HUD→sheet write bug.
5. **Multi-cell token footprint** for Large+ (size currently visual-only) — needs
   the corner-vs-center anchoring decision.
6. **Token style as personal/per-profile** persistence (the deferred personal-prefs
   slice).
