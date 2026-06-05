# Trials of Kirtas — Combat Page Context

_Last updated: end of the session that fixed realtime sync end-to-end, consolidated
the tool rail, added square + free-draw, and shipped live cursors._

## Snapshot

`combat.html` is the live battle-map page (vanilla JS/HTML/CSS, Supabase-backed,
Netlify-hosted at `tok.manikkhan.com`). This session was mostly **debugging why
nothing synced live**, then building on the now-solid foundation. The realtime
stack is healthy: tokens, fog, and drawings all sync live across accounts, and
live cursors are in.

Canonical source = the GitHub repo `main` branch. Always `git clone` / pull
before editing; never diagnose by curling the live Netlify site. M commits/uploads.

## Completed this session

**Realtime was fully broken — three stacked causes, now fixed:**

1. **Missing table GRANTs on `drawings` (the real headline bug).** The table was
   created via raw SQL, which (unlike the Supabase Table Editor) does NOT
   auto-grant table privileges to the API roles. Symptom: `403` +
   `permission denied for table drawings` on both read and write — a GRANT error
   that sits *below* RLS, so perfect RLS policies couldn't help. Fix:
   `grant select, insert, update, delete on public.drawings to anon, authenticated;`
   (RLS still gates; anon has no policies so is still denied at the policy layer).
   This is why shapes never crossed accounts even on refresh.
2. **Realtime socket ran as anon.** `nav.js` created the client and read the
   session but never pushed the JWT onto the realtime connection, so
   postgres_changes (policies scoped `to authenticated`) delivered nothing live
   while REST reads worked — hence "only updates on refresh." Fix in `nav.js`:
   `sb.realtime.setAuth(session.access_token)` right after the session is
   confirmed, **plus** re-applying it on `onAuthStateChange` (token rotates ~hourly;
   without re-applying, the socket silently drops back to anon mid-session).
3. **Publication membership** confirmed: `combatants`, `encounters`, `drawings`
   are all in `supabase_realtime`. `drawings` also set to `replica identity full`
   (so RLS can be evaluated for realtime UPDATE/DELETE).

`schema_drawings.sql` regenerated as the corrected canonical: now includes the
GRANT and the `replica identity full` line so a fresh environment never hits this.

**Fog tool icons corrected.** Pencil = **draw fog (hide map)**, eraser =
**erase fog (reveal map)**. Internal `reveal`/`hide` brush ids and logic unchanged;
only the icon→intent mapping was swapped.

**Tool rail consolidated into groups.** Rail is now **Select / Shapes / Fog**
(Fog staff-only). A group button shows its currently-active member's icon;
clicking it opens the slide-out (`.tool-options`) with the member icons in a row
(`.tool-subrow`) plus that group's options — colour picker for Shapes, brush
size + Reveal-all/Hide-all for Fog. Selecting a member keeps the flyout open and
updates the rail icon. Adding a tool later = one entry in the group's `members`.

**Two new shapes** (both ride the `drawings` table via the `kind` text column —
no schema change):
- **Square / rectangle** (`kind: 'rect'`, geometry `{x,y,w,h}`): tap-and-drag,
  cell-snapped, drags in any direction.
- **Free draw** (`kind: 'pen'`, geometry `{pts: [[col,row],…]}`): true freehand,
  NOT grid-snapped, distance-sampled (>0.12 cell) to keep the point list sane,
  needs ≥2 points to commit. Rendered as an SVG polyline.
- Added `screenToCellF()` — fractional (un-snapped) cell coords, used by both the
  pen and the cursors. `shapeSvg` got `rect` + `pen` cases; placement
  (pointerdown/move/end) generalised to all four shape tools.

**Live cursors.** Ephemeral, no DB. Position via Realtime **Broadcast**
(throttled ~20/sec, board-fractional coords); identity + join/leave via
**Presence**. Each cursor = a coloured arrow + name + a small tool glyph
(○ △ ▢ ✎ …). Name = capitalised `characterKey` (`'cosmere'→'Cosmere'`,
`'vesperian'→'Vesperian'`) or `'DM'` when `characterKey` is null.
- **Visibility:** staff cursors are **hidden from players** (DM can hover over
  secret things without telegraphing); player cursors are visible to all; staff
  see everyone. Filtering is **receive-side** → same "trusted table" tier as fog
  (a player digging in devtools could find a staff position). Hardening = not
  broadcasting staff positions to player sockets, which broadcast can't do
  selectively; deferred.
- **Geometry:** the cursor overlay (`.rt-cursors`) lives in `stage` (NOT `boardEl`),
  so it's constant screen-size, not board-scaled. Positions are projected with
  `cellToScreen()` (the algebraic inverse of `screenToCellF`) and re-projected in
  `applyTransform()` (covers pan / zoom / fit / resize). Cursor scale is clamped
  to `[0.5, 1.0]` of zoom (transform-origin at the arrow tip) so labels shrink
  when zoomed out but stay constant when zoomed in.
- **Cleanup:** Presence `leave` removes a cursor on tab close; a 5s sweep also
  drops any cursor idle >12s (covers ungraceful disconnects).

## Architecture decisions / patterns

- **Drawings:** `kind` + `geometry` jsonb + `color` + `owner`. RLS read-all,
  owner-or-staff write. **Must have table GRANTs to anon+authenticated** (RLS
  does the gating) — the lesson of this session for any raw-SQL Supabase table.
- **Realtime checklist** for any synced table: in the `supabase_realtime`
  publication + the socket authenticated via `setAuth` + `replica identity full`
  for clean UPDATE/DELETE under RLS.
- **Cursors:** broadcast (ephemeral) for fast-changing position; presence for
  membership; receive-side visibility filtering; overlay in `stage`,
  inverse-projected, NOT parented to the board.

## Files in play

- `combat.html` — tool-rail consolidation, square + free-draw, live cursors,
  fog-icon fix. (Diagnostic `[rt]` logs were added then removed; build is clean.)
- `nav.js` — realtime `setAuth` fix (+ refresh re-apply).
- `schema_drawings.sql` — corrected canonical (GRANT + replica identity).
- One-time DB actions already RUN in Supabase: the `drawings` grant, publication
  membership, replica identity. (Re-running `schema_drawings.sql` is idempotent.)

## Working rules (carry forward)

`git clone`/pull `main` as canonical before editing; discuss & get approval
before writing code; small incremental changes; never touch unrelated code; flag
uncertainty; never curl the live Netlify site to diagnose; use `var(--font-*)`,
not hardcoded fonts; card internals hardcoded dark (`#1a1a1a`), page-level
backgrounds use theme vars. Verify edits with `node --check` on the inline script
+ brace/paren balance after large changes. Note: the editor's line ranges shift
after edits — recompute the `<script>`…`</script>` bounds before extracting.

## Next up / roadmap (this is the new-session scope)

1. **Add the combat page to the main nav** (`nav.js` pages list — small, the
   natural first move). Profile shape exposed via `window.__tok`:
   `{ id, userId, email, role, characterKey }`, role ∈
   `overseer | dm | player`, characterKey ∈ `cosmere | caim | liadan | vesperian | null`.
2. **HUD ↔ combat bridge** (the big one). `battle.js` is the single-character HUD
   (HP / conditions / actions / spells / resources) and is NOT loaded on
   `combat.html`. Goal: bring the HUD onto the combat page sharing the map's
   state, so a character's HUD HP/conditions = the same Supabase `combatants` row
   as its token. M's steer: "contain as much as possible in the HUD; it's the
   bridge." Folds in the parked HUD→sheet write bug.
3. **Monsters / enemies into an encounter.** Two angles, possibly both: a saved,
   reusable **enemy library** (a "folder" of presets to add quickly) and/or
   **quick search through the 5etools JSON** (same data source already used for
   items) to drop a monster into the encounter.
4. **Battle map / scene storage.** A library of maps/scenes to pick from when
   building the combat page (map picker + per-encounter scene selection).
5. **Parked tools M was keen on:** a **wall / barrier** tool (DM draws walls that
   block token movement until opened — edge-based, client-side collision matching
   the fog trust tier, walls carry open/closed state, own table); and **trap /
   trigger tiles** (region types: tile / area / row / column; hidden from players;
   on trigger → banner + zoom-to-coordinate; per-trigger **staff toggle**: ON =
   visible to all + auto-fires, OFF = staff-only marker; arm/disarm + one-shot vs
   repeatable).
6. **Deferred:** multi-cell token footprint for Large+ (corner-vs-center anchor
   decision); token style as personal/per-profile prefs; cursor rate tuning
   (currently 20/sec) if it ever needs nudging.

## Character note

In this campaign the character once named **Tyros Darkstar** is now **Cosmere
Runestar** — same character, new name. Data key `tyros` is preserved across files
and URLs; only display strings use "Cosmere." `characters.js` uses
`KEY_FILE = { cosmere: 'tyros' }` to read the existing `tyros.json` transparently.
(Live-cursor labels derive from `characterKey`, which is `'cosmere'` → "Cosmere".)
